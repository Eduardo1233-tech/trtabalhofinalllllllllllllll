// Teste de integração das rotas do e-commerce.
// Uso: npm start (em outro terminal) && npm test
// Ou:  API_URL=http://localhost:3000 npm test
const BASE = (process.env.API_URL || "http://localhost:3000").replace(/\/$/, "");
const assert = require("node:assert/strict");

let passou = 0;
function ok(mensagem) {
  passou++;
  console.log("  ✓ " + mensagem);
}

async function req(caminho, opcoes = {}) {
  const headers = { "Content-Type": "application/json" };
  if (opcoes.token) headers.Authorization = "Bearer " + opcoes.token;

  const resposta = await fetch(BASE + caminho, {
    method: opcoes.method || "GET",
    headers,
    body: opcoes.body === undefined ? undefined : JSON.stringify(opcoes.body),
    redirect: opcoes.redirect || "follow",
  });

  const texto = await resposta.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* HTML ou vazio */ }
  return { status: resposta.status, json, texto, headers: resposta.headers };
}

async function rodar() {
  console.log("Testando API em " + BASE + "\n");

  // Site servido pela API
  let r = await req("/");
  assert.equal(r.status, 200);
  assert.match(r.texto, /Produtos/);
  ok("GET / serve o front-end");

  // AV2 - produtos e filtros
  r = await req("/produto");
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.json) && r.json.length >= 13);
  assert.ok(r.json[0].caminho_img && r.json[0].imagem);
  assert.ok(r.json.every((p) => p.categoria !== "processador" && !/processador|ryzen|intel/i.test(p.nome)));
  ok("GET /produto lista só produtos da loja, com URL de imagem vinda do servidor");

  const imagemOriginal = r.json[0].imagem;

  r = await req("/produto?busca=" + encodeURIComponent("luva"));
  assert.equal(r.status, 200);
  assert.ok(r.json.length >= 2 && r.json.every((p) => /luva/i.test(p.nome)));
  ok("GET /produto?busca filtra por nome");

  r = await req("/produto?categoria=kimono&preco_min=290&ordem=menor_preco");
  assert.equal(r.status, 200);
  assert.ok(r.json.length >= 2 && r.json.every((p) => p.categoria === "kimono" && Number(p.preco) >= 290));
  assert.ok(Number(r.json[0].preco) <= Number(r.json[1].preco));
  ok("GET /produto filtra categoria/preço e ordena por menor preço");

  r = await req("/produto?ordenacao=" + encodeURIComponent("maior preco") + "&limite=3");
  assert.equal(r.status, 200);
  assert.equal(r.json.length, 3);
  assert.ok(Number(r.json[0].preco) >= Number(r.json[1].preco));
  ok("GET /produto aceita 'ordenacao=maior preco' do front-end");

  // AV3 - imagem
  r = await req("/produto/1/imagem", { redirect: "manual" });
  assert.equal(r.status, 302);
  assert.match(r.headers.get("location"), /^https?:\/\//);
  ok("GET /produto/:id/imagem redireciona para imagem externa");

  r = await req("/produto/999999/imagem", { redirect: "manual" });
  assert.equal(r.status, 404);
  ok("GET /produto/:id/imagem retorna 404 para produto inexistente");

  r = await req("/produto/1/imagem", { method: "PUT", body: { imagem: "url-invalida" } });
  assert.equal(r.status, 400);
  ok("PUT /produto/:id/imagem valida a URL");

  // AV1 - cadastro, duplicidade e login
  const email = "teste.automático." + Date.now() + "@email.com";
  const cliente = {
    nome: "Cliente Teste", cpf: String(Date.now()).slice(-11),
    celular: "(42)99999-9999", email, senha: "senha123",
  };
  r = await req("/cliente", { method: "POST", body: cliente });
  assert.equal(r.status, 201, r.texto);
  ok("POST /cliente cadastra cliente com senha criptografada");

  r = await req("/cliente", { method: "POST", body: cliente });
  assert.equal(r.status, 409);
  ok("POST /cliente bloquea e-mail duplicado");

  r = await req("/login", { method: "POST", body: { email, senha: "errada" } });
  assert.equal(r.status, 401);
  ok("POST /login rejeita senha inválida");

  r = await req("/login", { method: "POST", body: { email: "eduardo@gmail.com", senha: "123456" } });
  assert.equal(r.status, 200, r.texto);
  assert.ok(r.json.token);
  const token = r.json.token;
  ok("POST /login devolve JWT");

  // AV1 - perfil protegido
  r = await req("/cliente/perfil");
  assert.equal(r.status, 401);
  ok("GET /cliente/perfil exige JWT");

  r = await req("/cliente/perfil", { token });
  assert.equal(r.status, 200);
  assert.equal(r.json.email, "eduardo@gmail.com");
  assert.equal(r.json.senha, undefined);
  ok("GET /cliente/perfil retorna dados sem a senha");

  // AV3 - compras
  r = await req("/compra", { method: "POST", body: { itens: [{ id: 1, quantidade: 2 }] } });
  assert.equal(r.status, 401);
  ok("POST /compra exige JWT");

  r = await req("/compra", { method: "POST", body: { itens: [{ id: 1, quantidade: 0 }] }, token });
  assert.equal(r.status, 400);
  ok("POST /compra valida a lista de produtos");

  r = await req("/compra", {
    method: "POST",
    body: { itens: [{ id: 1, quantidade: 2 }, { id: 3, quantidade: 1 }] },
    token,
  });
  assert.equal(r.status, 201, r.texto);
  assert.equal(r.json.compra.itens.length, 2);
  assert.equal(Number(r.json.compra.total), 799.7);
  const compraId = r.json.compra.id;
  ok("POST /compra registra vários produtos e calcula o total no servidor");

  const antes = await req("/compra", { token });
  assert.equal(antes.status, 200);
  const quantidadeAntes = antes.json.length;

  r = await req("/compra", { method: "POST", body: { itens: [{ id: 999999, quantidade: 1 }] }, token });
  assert.equal(r.status, 404);
  const depois = await req("/compra", { token });
  assert.equal(depois.json.length, quantidadeAntes);
  ok("POST /compra faz rollback quando um produto não existe");

  assert.ok(depois.json.some((c) => c.id === compraId && c.itens.length === 2));
  assert.ok(depois.json.find((c) => c.id === compraId).itens[0].nome);
  ok("GET /compra lista as compras do usuário com seus itens");

  r = await req("/compra");
  assert.equal(r.status, 401);
  ok("GET /compra exige JWT");

  // Restaura a URL original da imagem do produto 1
  await req("/produto/1/imagem", {
    method: "PUT",
    body: { imagem: "https://drive.google.com/uc?export=view&id=EXEMPLO" },
  });
  r = await req("/produto/1/imagem", { redirect: "manual" });
  assert.equal(r.status, 302);
  assert.match(r.headers.get("location"), /drive\.google\.com/);
  await req("/produto/1/imagem", { method: "PUT", body: { imagem: imagemOriginal } });
  ok("PUT /produto/:id/imagem troca a URL (ex.: Google Drive)");

  console.log("\n" + passou + " verificações passaram. ✅");
}

rodar().catch((erro) => {
  console.error("\nFALHA no teste:", erro.message);
  process.exit(1);
});
