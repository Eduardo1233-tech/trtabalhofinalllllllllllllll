// ============================================================
// Carrinho de compras persistido no LocalStorage
// ============================================================
const CHAVE_CARRINHO = "carrinho";

function carrinho_listar() {
  try {
    const dados = JSON.parse(localStorage.getItem(CHAVE_CARRINHO) || "[]");
    return Array.isArray(dados) ? dados : [];
  } catch (e) {
    return [];
  }
}

function carrinho_salvar(itens) {
  localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(itens));
  if (typeof atualizar_navbar === "function") atualizar_navbar();
  if (typeof renderizar_carrinho === "function") renderizar_carrinho();
}

function carrinho_adicionar(produto, quantidade) {
  const itens = carrinho_listar();
  const qtd = Number(quantidade) > 0 ? Math.floor(Number(quantidade)) : 1;
  const existente = itens.find((item) => item.id === produto.id);

  if (existente) {
    existente.quantidade += qtd;
  } else {
    itens.push({
      id: produto.id,
      nome: produto.nome,
      preco: Number(produto.preco),
      imagem: produto.caminho_img || produto.imagem || "",
      quantidade: qtd,
    });
  }

  carrinho_salvar(itens);
  mostrarToast("✅ " + produto.nome + " adicionado ao carrinho!", "bg-success");
}

function carrinho_alterar_quantidade(id, quantidade) {
  const itens = carrinho_listar();
  const item = itens.find((i) => i.id === Number(id));
  if (!item) return;

  const qtd = Number(quantidade);
  if (!Number.isInteger(qtd) || qtd < 1) return;
  item.quantidade = Math.min(qtd, 999);
  carrinho_salvar(itens);
}

function carrinho_remover(id) {
  carrinho_salvar(carrinho_listar().filter((item) => item.id !== Number(id)));
  mostrarToast("Item removido do carrinho.", "bg-warning");
}

function carrinho_limpar() {
  carrinho_salvar([]);
}

function carrinho_total() {
  return carrinho_listar().reduce((total, item) => total + Number(item.preco) * item.quantidade, 0);
}

function carrinho_quantidade_total() {
  return carrinho_listar().reduce((total, item) => total + item.quantidade, 0);
}

// ------------------------------------------------------------
// Página do carrinho
// ------------------------------------------------------------
function renderizar_carrinho() {
  const container = document.getElementById("itens-carrinho");
  if (!container) return;

  const itens = carrinho_listar();
  const totalEl = document.getElementById("total-carrinho");
  const qtdEl = document.getElementById("qtd-itens-carrinho");
  const btnFinalizar = document.getElementById("btn-finalizar");

  if (totalEl) totalEl.textContent = formatar_moeda(carrinho_total());
  if (qtdEl) qtdEl.textContent = String(carrinho_quantidade_total());
  if (btnFinalizar) btnFinalizar.disabled = itens.length === 0;

  if (itens.length === 0) {
    container.innerHTML =
      '<div class="carrinho-vazio">🛒 Seu carrinho está vazio.<br>' +
      '<a href="index.html">Ver produtos disponíveis</a></div>';
    return;
  }

  container.innerHTML = itens
    .map(
      (item) => `
      <div class="item-carrinho">
        <div class="item-imagem">
          <img src="${escape_html(item.imagem)}" alt="${escape_html(item.nome)}"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
          <span class="img-fallback" style="display:none">📦</span>
        </div>
        <div class="item-detalhes">
          <div class="item-nome">${escape_html(item.nome)}</div>
          <div class="item-preco-unitario">${formatar_moeda(item.preco)} cada</div>
          <button class="btn btn-sm btn-outline-danger" onclick="carrinho_remover(${item.id})">Remover</button>
        </div>
        <div class="item-quantidade">
          <label>Qtd.</label>
          <input type="number" min="1" max="999" value="${item.quantidade}"
                 onchange="carrinho_alterar_quantidade(${item.id}, this.value)" class="input_texto">
        </div>
        <div class="item-subtotal">${formatar_moeda(Number(item.preco) * item.quantidade)}</div>
      </div>`
    )
    .join("");
}

async function finalizar_compra() {
  const itens = carrinho_listar();
  if (itens.length === 0) {
    mostrarToast("Seu carrinho está vazio.", "bg-warning");
    return;
  }
  if (!localStorage.getItem("token")) {
    mostrarToast("Faça login para finalizar a compra.", "bg-warning");
    window.location.href = "login.html?redirecionar=carrinho.html";
    return;
  }

  const btn = document.getElementById("btn-finalizar");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Processando...";
  }

  try {
    const resposta = await criar_compra(
      itens.map((item) => ({ id: item.id, quantidade: item.quantidade }))
    );
    carrinho_limpar();
    mostrarToast("✅ Compra #" + resposta.compra.id + " realizada!", "bg-success");
    window.location.href = "compras.html";
  } catch (erro) {
    if (erro.status === 401) {
      limpar_sessao();
      window.location.href = "login.html?redirecionar=carrinho.html";
      return;
    }
    mostrarToast("❌ " + erro.message, "bg-danger");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Finalizar compra";
    }
  }
}

window.addEventListener("DOMContentLoaded", renderizar_carrinho);
