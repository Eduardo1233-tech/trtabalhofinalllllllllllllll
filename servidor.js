// ============================================================
// API E-COMMERCE - Node.js + Express + MySQL
// Todas as rotas exigidas (AV1, AV2 e AV3) estão implementadas aqui.
// ============================================================
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "segredo-local-trocar-em-producao";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "8h";
const SALT_ROUNDS = 10;

app.use(cors({ exposedHeaders: ["X-Total-Count"] }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ------------------------------------------------------------
// Utilitários
// ------------------------------------------------------------
function erro(res, status, msg) {
  return res.status(status).json({ msg });
}

function texto(valor, tamanhoMax = 255) {
  return typeof valor === "string" ? valor.trim().slice(0, tamanhoMax) : "";
}

function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function inteiroPositivo(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

function flagProxy(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// Ordenação permitida (whitelist evita SQL injection)
const ORDENACOES = {
  "menor preco": "preco ASC, id ASC",
  "menor_preco": "preco ASC, id ASC",
  "preco-asc": "preco ASC, id ASC",
  asc: "preco ASC, id ASC",
  "maior preco": "preco DESC, id DESC",
  "maior_preco": "preco DESC, id DESC",
  "preco-desc": "preco DESC, id DESC",
  desc: "preco DESC, id DESC",
  nome: "nome ASC, id ASC",
  id: "id ASC",
};

// ------------------------------------------------------------
// Middleware de autenticação (JWT) - usado nas rotas protegidas
// ------------------------------------------------------------
function autenticar(req, res, next) {
  const cabecalho = req.headers.authorization || "";
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7).trim() : null;

  if (!token) return erro(res, 401, "Token não informado. Faça login.");

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.cliente = { id: payload.id, nome: payload.nome };
    return next();
  } catch {
    return erro(res, 401, "Token inválido ou expirado. Faça login novamente.");
  }
}

// ------------------------------------------------------------
// AV1 - Cadastro de cliente
// ------------------------------------------------------------
app.post("/cliente", async (req, res) => {
  const nome = texto(req.body.nome, 100);
  const cpf = texto(req.body.cpf, 14);
  const celular = texto(req.body.celular, 15);
  const email = texto(req.body.email, 100).toLowerCase();
  const senha = typeof req.body.senha === "string" ? req.body.senha : "";

  if (nome.length < 3) return erro(res, 400, "Informe um nome com pelo menos 3 caracteres.");
  if (cpf.length < 11) return erro(res, 400, "CPF inválido.");
  if (celular.length < 10) return erro(res, 400, "Celular inválido.");
  if (!emailValido(email)) return erro(res, 400, "E-mail inválido.");
  if (senha.length < 6) return erro(res, 400, "A senha deve ter pelo menos 6 caracteres.");

  try {
    const [existentes] = await db.pool.query(
      "SELECT id FROM cliente WHERE email = ? OR cpf = ? LIMIT 1",
      [email, cpf]
    );
    if (existentes.length > 0) {
      return erro(res, 409, "E-mail ou CPF já cadastrado.");
    }

    const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);
    const [resultado] = await db.pool.query(
      "INSERT INTO cliente (nome, cpf, celular, email, senha) VALUES (?, ?, ?, ?, ?)",
      [nome, cpf, celular, email, senhaHash]
    );

    return res.status(201).json({
      msg: "Cliente cadastrado com sucesso.",
      cliente: { id: resultado.insertId, nome, email },
    });
  } catch (e) {
    console.error("POST /cliente:", e);
    return erro(res, 500, "Erro ao cadastrar cliente.");
  }
});

// ------------------------------------------------------------
// AV1 - Login (devolve o JWT)
// ------------------------------------------------------------
app.post("/login", async (req, res) => {
  const email = texto(req.body.email, 100).toLowerCase();
  const senha = typeof req.body.senha === "string" ? req.body.senha : "";

  if (!email || !senha) return erro(res, 400, "Informe e-mail e senha.");

  try {
    const [linhas] = await db.pool.query(
      "SELECT id, nome, email, senha FROM cliente WHERE email = ? LIMIT 1",
      [email]
    );
    if (linhas.length === 0) return erro(res, 401, "E-mail ou senha inválidos.");

    const cliente = linhas[0];
    const senhaConfere = await bcrypt.compare(senha, cliente.senha);
    if (!senhaConfere) return erro(res, 401, "E-mail ou senha inválidos.");

    const token = jwt.sign(
      { id: cliente.id, nome: cliente.nome },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    return res.json({
      msg: "Login realizado com sucesso.",
      token,
      id: cliente.id,
      nome: cliente.nome,
      email: cliente.email,
    });
  } catch (e) {
    console.error("POST /login:", e);
    return erro(res, 500, "Erro ao realizar login.");
  }
});

// ------------------------------------------------------------
// AV1 - Perfil do cliente (protegido)
// ------------------------------------------------------------
app.get("/cliente/perfil", autenticar, async (req, res) => {
  try {
    const [linhas] = await db.pool.query(
      "SELECT id, nome, cpf, celular, email FROM cliente WHERE id = ? LIMIT 1",
      [req.cliente.id]
    );
    if (linhas.length === 0) return erro(res, 404, "Cliente não encontrado.");
    return res.json(linhas[0]);
  } catch (e) {
    console.error("GET /cliente/perfil:", e);
    return erro(res, 500, "Erro ao buscar perfil.");
  }
});

// ------------------------------------------------------------
// AV2 - Consulta de produtos com filtro
// Query: nome (ou busca), categoria, preco_min, preco_max,
//        ordem (ou ordenacao), pagina, limite
// ------------------------------------------------------------
app.get("/produto", async (req, res) => {
  const where = [];
  const valores = [];

  const nome = texto(req.query.nome || req.query.busca, 150);
  const categoria = texto(req.query.categoria, 100);
  const precoMin = Number(req.query.preco_min);
  const precoMax = Number(req.query.preco_max);

  if (nome) {
    where.push("(nome LIKE ? OR descricao LIKE ? OR categoria LIKE ?)");
    const like = `%${nome}%`;
    valores.push(like, like, like);
  }
  if (categoria) {
    where.push("categoria LIKE ?");
    valores.push(`%${categoria}%`);
  }
  if (req.query.preco_min !== undefined && Number.isFinite(precoMin) && precoMin >= 0) {
    where.push("preco >= ?");
    valores.push(precoMin);
  }
  if (req.query.preco_max !== undefined && Number.isFinite(precoMax) && precoMax >= 0) {
    where.push("preco <= ?");
    valores.push(precoMax);
  }

  const clausulaWhere = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const ordemChave = String(req.query.ordem || req.query.ordenacao || "").trim().toLowerCase();
  const ordemSql = ORDENACOES[ordemChave] || "id ASC";

  const pagina = inteiroPositivo(req.query.pagina) || 1;
  const limite = Math.min(inteiroPositivo(req.query.limite) || 50, 100);
  const offset = (pagina - 1) * limite;

  try {
    const [totalLinhas] = await db.pool.query(
      `SELECT COUNT(*) AS total FROM produto ${clausulaWhere}`,
      valores
    );
    const [produtos] = await db.pool.query(
      `SELECT id, nome, categoria, preco, descricao, imagem,
              CONCAT('/produto/', id, '/imagem') AS caminho_img
       FROM produto ${clausulaWhere}
       ORDER BY ${ordemSql}
       LIMIT ? OFFSET ?`,
      [...valores, limite, offset]
    );

    res.setHeader("X-Total-Count", String(totalLinhas[0].total));
    return res.json(produtos);
  } catch (e) {
    console.error("GET /produto:", e);
    return erro(res, 500, "Erro ao consultar produtos.");
  }
});

// ------------------------------------------------------------
// AV3 - Imagem do produto vinda do servidor
// A URL da imagem fica no banco (Google Drive ou outro host externo).
// GET redireciona (ou faz proxy com ?proxy=1) para essa URL.
// ------------------------------------------------------------
app.get("/produto/:id/imagem", async (req, res) => {
  const id = inteiroPositivo(req.params.id);
  if (!id) return erro(res, 400, "ID de produto inválido.");

  try {
    const [linhas] = await db.pool.query("SELECT nome, imagem FROM produto WHERE id = ? LIMIT 1", [id]);
    if (linhas.length === 0) return erro(res, 404, "Produto não encontrado.");

    const url = linhas[0].imagem;
    if (!url) return erro(res, 404, "Produto sem imagem.");

    if (req.query.proxy === "1") {
      // Proxy opcional: o navegador nunca acessa o host externo diretamente
      const respostaExterna = await fetch(url);
      if (!respostaExterna.ok || !respostaExterna.body) {
        return erro(res, 502, "Não foi possível carregar a imagem externa.");
      }
      res.setHeader("Content-Type", respostaExterna.headers.get("content-type") || "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return respostaExterna.body.pipeTo(
        new WritableStream({
          write(chunk) { res.write(chunk); },
          close() { res.end(); },
        })
      );
    }

    return res.redirect(302, url);
  } catch (e) {
    console.error("GET /produto/:id/imagem:", e);
    return erro(res, 500, "Erro ao carregar imagem.");
  }
});

// AV3 - Vincula/troca a URL da imagem (Google Drive) de um produto
app.put("/produto/:id/imagem", async (req, res) => {
  const id = inteiroPositivo(req.params.id);
  const url = texto(req.body.imagem, 1000);

  if (!id) return erro(res, 400, "ID de produto inválido.");
  if (!flagProxy(url)) return erro(res, 400, "Informe uma URL http(s) válida para a imagem.");

  try {
    const [linhas] = await db.pool.query("SELECT id FROM produto WHERE id = ? LIMIT 1", [id]);
    if (linhas.length === 0) return erro(res, 404, "Produto não encontrado.");

    await db.pool.query("UPDATE produto SET imagem = ? WHERE id = ?", [url, id]);
    return res.json({
      msg: "Imagem vinculada ao produto.",
      produto: { id, imagem: url, caminho_img: `/produto/${id}/imagem` },
    });
  } catch (e) {
    console.error("PUT /produto/:id/imagem:", e);
    return erro(res, 500, "Erro ao vincular imagem.");
  }
});

// ------------------------------------------------------------
// AV3 - Cadastro de compra (JWT obrigatório + lista de produtos)
// ------------------------------------------------------------
app.post("/compra", autenticar, async (req, res) => {
  const itensRecebidos = req.body.itens;

  if (!Array.isArray(itensRecebidos) || itensRecebidos.length === 0) {
    return erro(res, 400, "A compra deve conter ao menos um item.");
  }

  // Valida e soma itens repetidos
  const itensValidados = new Map();
  for (const item of itensRecebidos) {
    const produtoId = inteiroPositivo(item && item.id);
    const quantidade = inteiroPositivo(item && item.quantidade);
    if (!produtoId || !quantidade) {
      return erro(res, 400, "Cada item precisa de 'id' e 'quantidade' positivos.");
    }
    itensValidados.set(produtoId, (itensValidados.get(produtoId) || 0) + quantidade);
  }

  let conexao;
  try {
    conexao = await db.pool.getConnection();
    await conexao.beginTransaction();

    const itensCompra = [];
    let total = 0;

    for (const [produtoId, quantidade] of itensValidados) {
      const [linhas] = await conexao.query(
        "SELECT id, nome, preco FROM produto WHERE id = ? LIMIT 1 FOR UPDATE",
        [produtoId]
      );
      if (linhas.length === 0) {
        await conexao.rollback();
        return erro(res, 404, `Produto ${produtoId} não encontrado.`);
      }

      const produto = linhas[0];
      const precoUnitario = Number(produto.preco);
      const subtotal = precoUnitario * quantidade;
      total += subtotal;
      itensCompra.push({
        produto_id: produto.id,
        nome: produto.nome,
        quantidade,
        preco_unitario: precoUnitario,
        subtotal,
      });
    }

    const [compra] = await conexao.query(
      "INSERT INTO compra (cliente_id, total) VALUES (?, ?)",
      [req.cliente.id, total.toFixed(2)]
    );
    const compraId = compra.insertId;

    for (const item of itensCompra) {
      await conexao.query(
        "INSERT INTO item_compra (compra_id, produto_id, quantidade, preco_unitario) VALUES (?, ?, ?, ?)",
        [compraId, item.produto_id, item.quantidade, item.preco_unitario]
      );
    }

    await conexao.commit();
    return res.status(201).json({
      msg: "Compra realizada com sucesso.",
      compra: {
        id: compraId,
        cliente_id: req.cliente.id,
        total: Number(total.toFixed(2)),
        itens: itensCompra,
      },
    });
  } catch (e) {
    if (conexao) {
      try { await conexao.rollback(); } catch { /* rollback falho */ }
    }
    console.error("POST /compra:", e);
    return erro(res, 500, "Erro ao registrar compra.");
  } finally {
    if (conexao) conexao.release();
  }
});

// ------------------------------------------------------------
// AV3 - Consulta das compras do usuário logado (protegido)
// ------------------------------------------------------------
app.get("/compra", autenticar, async (req, res) => {
  try {
    const [compras] = await db.pool.query(
      "SELECT id, data_compra, total FROM compra WHERE cliente_id = ? ORDER BY data_compra DESC, id DESC",
      [req.cliente.id]
    );

    const resultado = [];
    for (const compra of compras) {
      const [itens] = await db.pool.query(
        `SELECT i.produto_id, p.nome, p.imagem, i.quantidade, i.preco_unitario,
                (i.quantidade * i.preco_unitario) AS subtotal
         FROM item_compra i
         JOIN produto p ON p.id = i.produto_id
         WHERE i.compra_id = ?
         ORDER BY i.id ASC`,
        [compra.id]
      );
      resultado.push({
        id: compra.id,
        data_compra: compra.data_compra,
        total: Number(compra.total),
        itens,
      });
    }
    return res.json(resultado);
  } catch (e) {
    console.error("GET /compra:", e);
    return erro(res, 500, "Erro ao consultar compras.");
  }
});

// ------------------------------------------------------------
// Arquivos estáticos do front-end (mesmo servidor, mesma origem)
// ------------------------------------------------------------
const arquivosPublicos = [
  "index.html", "login.html", "cadastro.html", "carrinho.html",
  "perfil.html", "compras.html", "style.css",
  "api.js", "pages.js", "index.js", "carrinho.js", "perfil.js", "compras.js",
];

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
arquivosPublicos.forEach((arquivo) => {
  app.get(`/${arquivo}`, (req, res) => res.sendFile(path.join(__dirname, arquivo)));
});

// JSON inválido
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && "body" in err) {
    return erro(res, 400, "JSON inválido.");
  }
  return next(err);
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`API + site rodando em http://localhost:${PORT}`);
  });
}
