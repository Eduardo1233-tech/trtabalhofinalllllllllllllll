// AV1 - Perfil do cliente (rota protegida por JWT)
async function carregar_perfil() {
  if (!localStorage.getItem("token")) {
    window.location.href = "login.html?redirecionar=perfil.html";
    return;
  }

  try {
    const cliente = await buscar_perfil();
    document.getElementById("perfil-id").value = cliente.id;
    document.getElementById("perfil-nome").value = cliente.nome;
    document.getElementById("perfil-cpf").value = cliente.cpf;
    document.getElementById("perfil-celular").value = cliente.celular;
    document.getElementById("perfil-email").value = cliente.email;
  } catch (erro) {
    if (erro.status === 401) {
      limpar_sessao();
      window.location.href = "login.html?redirecionar=perfil.html";
      return;
    }
    mostrarToast("❌ " + erro.message, "bg-danger");
  }
}

window.addEventListener("DOMContentLoaded", carregar_perfil);
