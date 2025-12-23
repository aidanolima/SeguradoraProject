document.addEventListener("DOMContentLoaded", function() {
    
    // URL Base da API
    const BASE_URL = 'https://seguradoraproject.onrender.com';

    // ======================================================
    // 0. FUNÇÃO AUXILIAR: OLHO MÁGICO (VER SENHA)
    // ======================================================
    function setupPasswordToggle(btnId, inputId) {
        const btn = document.getElementById(btnId);
        const input = document.getElementById(inputId);

        if (btn && input) {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const tipoAtual = input.getAttribute('type');
                
                if (tipoAtual === 'password') {
                    input.setAttribute('type', 'text');
                    // Ícone Olho Cortado (Visível) - Verde
                    btn.innerHTML = `<i class="fas fa-eye-slash"></i>`;
                    btn.style.color = "#2e7d32";
                } else {
                    input.setAttribute('type', 'password');
                    // Ícone Olho Normal (Oculto) - Cinza
                    btn.innerHTML = `<i class="fas fa-eye"></i>`;
                    btn.style.color = "#666";
                }
            });
        }
    }

    // Ativa nos campos que existirem na página
    setupPasswordToggle('btn-toggle-senha', 'senha_login');          
    setupPasswordToggle('btn-toggle-reg-senha', 'reg_senha');        
    setupPasswordToggle('btn-toggle-reg-confirma', 'reg_confirma_senha'); 


    // ======================================================
    // 1. LOGIN (ACESSO AO SISTEMA)
    // ======================================================
    const formLogin = document.getElementById('form-login');
    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email_login').value;
            const senha = document.getElementById('senha_login').value;
            const btnSubmit = formLogin.querySelector('button[type="submit"]');
            
            // Feedback Visual
            const textoOriginal = btnSubmit.innerText;
            btnSubmit.innerText = "Autenticando...";
            btnSubmit.disabled = true;

            try {
                const response = await fetch(`${BASE_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, senha })
                });
                
                const result = await response.json();

                if (response.ok) {
                    // Salva Dados da Sessão
                    localStorage.setItem('token', result.token);
                    localStorage.setItem('usuario_logado', result.user.nome);
                    localStorage.setItem('tipo_usuario', result.user.tipo);
                    
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({
                            icon: 'success',
                            title: 'Bem-vindo!',
                            text: `Olá, ${result.user.nome}`,
                            timer: 1500,
                            showConfirmButton: false
                        }).then(() => window.location.href = 'dashboard.html');
                    } else {
                        window.location.href = 'dashboard.html';
                    }
                } else {
                    if (typeof Swal !== 'undefined') Swal.fire('Acesso Negado', result.message, 'error');
                    else alert(result.message);
                }
            } catch (error) {
                console.error(error);
                if (typeof Swal !== 'undefined') Swal.fire('Erro', 'Falha de conexão com o servidor.', 'error');
            } finally {
                btnSubmit.innerText = textoOriginal;
                btnSubmit.disabled = false;
            }
        });
    }

    // ======================================================
    // 2. RECUPERAÇÃO DE SENHA
    // ======================================================
    const formRecuperar = document.getElementById('form-recuperar');
    if (formRecuperar) {
        formRecuperar.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('rec_email').value;
            const btnSubmit = formRecuperar.querySelector('button[type="submit"]');
            
            btnSubmit.innerText = "Enviando...";
            btnSubmit.disabled = true;

            try {
                const response = await fetch(`${BASE_URL}/auth/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const result = await response.json();
                
                if (typeof Swal !== 'undefined') Swal.fire('Enviado', result.message, 'success');
                else alert(result.message);
                
                setTimeout(() => window.location.href = 'index.html', 3000);
            } catch (error) {
                if (typeof Swal !== 'undefined') Swal.fire('Erro', 'Erro de conexão.', 'error');
            } finally {
                btnSubmit.innerText = "Recuperar Senha";
                btnSubmit.disabled = false;
            }
        });
    }

    // A Lógica de Registro/Criação agora fica EXCLUSIVA no arquivo 'registro.html' 
    // ou num script separado chamado apenas dentro do painel logado, 
    // para não misturar lógica pública com privada.
});