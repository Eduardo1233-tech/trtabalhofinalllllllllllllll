// AV3 - Histórico de compras do cliente logado
async function carregar_compras() {
  if (!localStorage.getItem("token")) {
    window.location.href = "login.html?redirecionar=compras.html";
    return;
  }

  const container = document.getElementById("lista-compras");
  try {
    const compras = await buscar_compras();

    if (!Array.isArray(compras) || compras.length === 0) {
      container.innerHTML =
        '<div class="aviso-vazio">Você ainda não realizou compras.<br><a href="index.html">Ver produtos</a></div>';
      return;
    }

    container.innerHTML = compras
      .map((compra) => {
        const data = compra.data_compra
          ? new Date(compra.data_compra).toLocaleString("pt-BR")
          : "";
        const itens = (compra.itens || [])
          .map(
            (item) => `
            <tr>
              <td>${escape_html(item.nome)}</td>
              <td class="text-center">${item.quantidade}</td>
              <td class="text-end">${formatar_moeda(item.preco_unitario)}</td>
              <td class="text-end">${formatar_moeda(item.subtotal)}</td>
            </tr>`
          )
          .join("");

        return `
          <div class="card-compra">
            <div class="cabecalho-compra">
              <strong>Compra #${compra.id}</strong>
              <span class="text-muted">${escape_html(data)}</span>
              <strong class="total-compra">${formatar_moeda(compra.total)}</strong>
            </div>
            <table class="table table-sm mb-0">
              <thead><tr><th>Produto</th><th class="text-center">Qtd.</th><th class="text-end">Preço unit.</th><th class="text-end">Subtotal</th></tr></thead>
              <tbody>${itens}</tbody>
            </table>
          </div>`;
      })
      .join("");
  } catch (erro) {
    if (erro.status === 401) {
      limpar_sessao();
      window.location.href = "login.html?redirecionar=compras.html";
      return;
    }
    container.innerHTML =
      '<div class="aviso-vazio">❌ Não foi possível carregar as compras: ' +
      escape_html(erro.message) +
      "</div>";
  }
}

window.addEventListener("DOMContentLoaded", carregar_compras);
