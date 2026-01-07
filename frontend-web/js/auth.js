// js/auth.js

document.addEventListener("DOMContentLoaded", function() {
    
    // ======================================================
    // 1. LÓGICA DE LOGIN (CORRIGIDA PARA email_login)
    // ======================================================
    const formLogin = document.getElementById('form-login');

    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // --- CORREÇÃO AQUI: Usando os IDs exatos do seu HTML ---
            const inputEmail = document.getElementById('email_login');
            const inputSenha = document.getElementById('senha_login');
            
            // Validação de segurança caso o HTML mude no futuro
            if (!inputEmail || !inputSenha) {
                alert("Erro interno: IDs dos campos não encontrados. Verifique o HTML.");
                return;
            }

            const email = inputEmail.value;
            const senha = inputSenha.value;
            const btnSubmit = formLogin.querySelector('button');
            const textoOriginal = btnSubmit.innerText;

            if(!email || !senha) {
                alert("Por favor, preencha o e-mail e a senha.");
                return;
            }

            btnSubmit.innerText = "Verificando...";
            btnSubmit.disabled = true;

            try {
                // Tenta conectar no servidor local (localhost:3000)
                // A variável API_URL vem do arquivo config.js
                const response = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, senha })
                });

                const result = await response.json();

                if (response.ok) {
                    // SUCESSO! Salva o token e entra
                    console.log("Login autorizado pelo servidor!");
                    localStorage.setItem('token', result.token);
                    localStorage.setItem('usuario_logado', result.user.nome);
                    localStorage.setItem('email_logado', result.user.email);
                    localStorage.setItem('tipo_usuario', result.user.tipo);
                    
                    window.location.href = 'dashboard.html';
                } else {
                    // Senha errada ou usuário não encontrado
                    alert(result.message || "E-mail ou senha incorretos.");
                }
            } catch (error) {
                console.error("Erro técnico:", error);
                alert("Não foi possível conectar ao servidor (localhost:3000). Verifique se o terminal preto está aberto.");
            } finally {
                btnSubmit.innerText = textoOriginal;
                btnSubmit.disabled = false;
            }
        });
    }

    // ======================================================
    // 2. LOGOUT (Para usar no dashboard depois)
    // ======================================================
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.clear();
            window.location.href = 'index.html';
        });
    }
});