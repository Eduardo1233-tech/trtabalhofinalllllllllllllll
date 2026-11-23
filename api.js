// ============================================================
// Cliente da API - usado por todas as páginas do site
// ============================================================
const API_BASE = (function () {
  if (typeof window === "undefined") return "http://localhost:3000";
  if (window.API_URL) return String(window.API_URL).replace(/\/$/, "");
  if (window.location.protocol === "http:" || window.location.protocol === "https:") {
    return window.location.origin; // API e site no mesmo servidor
  }
  return "http://localhost:3000"; // abriu o HTML direto do disco
})();

async function api_request(caminho, opcoes = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = localStorage.getItem("token");

  // Rotas públicas não precisam (mas aceitam) o token
  if (token && opcoes.publica !== true) {
    headers.Authorization = "Bearer " + token;
  }

  const config = {
    method: opcoes.method || "GET",
    headers,
  };
  if (opcoes.body !== undefined) {
    config.body = JSON.stringify(opcoes.body);
  }

  let resposta;
  try {
    resposta = await fetch(API_BASE + caminho, config);
  } catch (e) {
    throw new Error("Não foi possível conectar à API. Verifique se o servidor está rodando.");
  }

  let json = null;
  try {
    json = await resposta.json();
  } catch (e) {
    json = null;
  }

  if (!resposta.ok) {
    const erro = new Error((json && json.msg) || "Erro " + resposta.status + " na API.");
    erro.status = resposta.status;
    throw erro;
  }
  return json;
}

// AV2 - produtos com filtro. Aceita os nomes usados no formulário
// (busca / ordenacao) e converte para os nomes da API (nome / ordem).
async function buscar_produtos(queryParams) {
  const params = new URLSearchParams();
  const traducao = { busca: "nome", ordenacao: "ordem" };

  (queryParams || new URLSearchParams()).forEach((valor, chave) => {
    if (valor !== "" && valor !== null && valor !== undefined) {
      params.append(traducao[chave] || chave, valor);
    }
  });

  const sufixo = params.toString() ? "?" + params.toString() : "";
  return api_request("/produto" + sufixo, { publica: true });
}

// AV1 - cadastro e login
function cadastrar_cliente(dados) {
  return api_request("/cliente", { method: "POST", body: dados, publica: true });
}

function login_cliente(dados) {
  return api_request("/login", { method: "POST", body: dados, publica: true });
}

// AV1 - perfil (JWT)
function buscar_perfil() {
  return api_request("/cliente/perfil");
}

// AV3 - imagem (somente a URL fica no banco)
function vincular_imagem(produtoId, url) {
  return api_request("/produto/" + produtoId + "/imagem", {
    method: "PUT",
    body: { imagem: url },
  });
}

// AV3 - compras (JWT + lista de produtos)
function criar_compra(itens) {
  return api_request("/compra", { method: "POST", body: { itens } });
}

function buscar_compras() {
  return api_request("/compra");
}

function salvar_sessao(dados) {
  localStorage.setItem("token", dados.token);
  localStorage.setItem("nome_cliente", dados.nome);
  localStorage.setItem("id_cliente", String(dados.id));
}

function limpar_sessao() {
  localStorage.removeItem("token");
  localStorage.removeItem("nome_cliente");
  localStorage.removeItem("id_cliente");
}
