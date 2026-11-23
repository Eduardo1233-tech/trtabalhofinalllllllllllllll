// ============================================================
// Tela principal - listagem e filtros de produtos (AV2)
// ============================================================
window.produtosPagina = {};

function preencher_formulario_pela_url() {
  const params = new URLSearchParams(window.location.search);
  const campos = {
    busca: "input-busca",
    ordenacao: "select-ordem",
    categoria: "select-categoria",
    preco_min: "input-preco-min",
    preco_max: "input-preco-max",
  };

  Object.keys(campos).forEach((chave) => {
    if (params.has(chave)) {
      const elemento = document.getElementById(campos[chave]);
      if (elemento) elemento.value = params.get(chave);
    }
  });
}

function coletar_filtros() {
  const params = new URLSearchParams();
  const valores = {
    busca: document.getElementById("input-busca")?.value.trim() || "",
    categoria: document.getElementById("select-categoria")?.value || "",
    preco_min: document.getElementById("input-preco-min")?.value || "",
    preco_max: document.getElementById("input-preco-max")?.value || "",
    ordenacao: document.getElementById("select-ordem")?.value || "",
  };

  Object.keys(valores).forEach((chave) => {
    if (valores[chave] !== "") params.append(chave, valores[chave]);
  });
  return params;
}

async function carregar_produtos(lerUrl) {
  if (lerUrl !== true) preencher_formulario_pela_url();

  const params = coletar_filtros();
  const queryString = params.toString();
  window.history.pushState(
    {},
    "",
    queryString ? "?" + queryString : window.location.pathname
  );

  const container = document.getElementById("produtos");
  const mensagem = document.getElementById("mensagem-produtos");
  if (container) container.innerHTML = "";
  if (mensagem) mensagem.innerHTML = "";

  try {
    const produtos = await buscar_produtos(params);

    if (!Array.isArray(produtos) || produtos.length === 0) {
      if (mensagem) {
        mensagem.innerHTML =
          '<div class="aviso-vazio">❌ Nenhum produto encontrado para essa busca.</div>';
      }
      return;
    }

    window.produtosPagina = {};

    produtos.forEach((produto) => {
      window.produtosPagina[produto.id] = produto;
      const descricao = String(produto.descricao || "");
      const resumo = descricao.length > 45 ? descricao.substring(0, 45) + "..." : descricao;
      const imagem = produto.caminho_img || produto.imagem || "";

      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="card-imagem">
          <img src="${escape_html(imagem)}" alt="${escape_html(produto.nome)}"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
          <span class="img-fallback" style="display:none">📦</span>
        </div>
        <span class="categoria-badge">${escape_html(produto.categoria)}</span>
        <div class="nome-produto">${escape_html(produto.nome)}</div>
        <div class="info">
          <div class="descricao">${escape_html(resumo)}</div>
          <div class="preco">${formatar_moeda(produto.preco)}</div>
        </div>
        <button class="btn_enviar btn-adicionar" onclick="carrinho_adicionar(window.produtosPagina[${produto.id}])">
          Adicionar ao carrinho 🛒
        </button>`;
      container.appendChild(card);
    });
  } catch (erro) {
    if (mensagem) {
      mensagem.innerHTML =
        '<div class="aviso-vazio">❌ Não foi possível carregar os produtos: ' +
        escape_html(erro.message) +
        "</div>";
    }
  }
}

window.addEventListener("DOMContentLoaded", () => carregar_produtos(false));
