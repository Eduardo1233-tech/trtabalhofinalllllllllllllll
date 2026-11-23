// ============================================================
// Funções compartilhadas por todas as páginas
// ============================================================

function escape_html(valor) {
  return String(valor == null ? "" : valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatar_moeda(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "R$ 0,00";
  return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function mostrarToast(mensagem, bgClass) {
  const toastEl = document.getElementById("liveToast");
  const toastMessage = document.getElementById("toast-message");

  if (!toastEl || !toastMessage) {
    // Fallback caso o Bootstrap não tenha carregado
    window.alert(mensagem);
    return;
  }

  toastMessage.textContent = mensagem;
  toastEl.classList.remove("bg-success", "bg-danger", "bg-warning");
  toastEl.classList.add(bgClass || "bg-success");

  if (typeof bootstrap !== "undefined" && bootstrap.Toast) {
    new bootstrap.Toast(toastEl).show();
  } else {
    toastEl.classList.add("show");
  }
}

function atualizar_navbar() {
  const nome = localStorage.getItem("nome_cliente");
  const token = localStorage.getItem("token");

  const navLogin = document.getElementById("nav-login");
  const btnUserInfo = document.getElementById("user-info");

  if (navLogin) navLogin.style.display = token && nome ? "none" : "inline";
  if (btnUserInfo) {
    const logado = Boolean(token && nome);
    btnUserInfo.style.display = logado ? "inline-block" : "none";
    btnUserInfo.textContent = logado ? "Olá, " + nome.split(" ")[0] : "Opções";
  }

  const contador = document.getElementById("cart-count");
  if (contador) {
    const quantidade = typeof carrinho_quantidade_total === "function"
      ? carrinho_quantidade_total()
      : 0;
    contador.textContent = quantidade;
    contador.style.display = quantidade > 0 ? "inline-block" : "none";
  }
}

function logout() {
  limpar_sessao(); // mantém o carrinho salvo no LocalStorage
  window.location.href = "login.html";
}

window.addEventListener("DOMContentLoaded", atualizar_navbar);
window.addEventListener("storage", atualizar_navbar);
