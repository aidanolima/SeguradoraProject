document.addEventListener("DOMContentLoaded", function() {
    
    // Configuração base da API
    const API_URL = 'http://localhost:3000/auth';
    const BASE_API_URL = 'http://localhost:3000'; 

    // ======================================================
    // 0. FUNCIONALIDADE DO OLHO MÁGICO (SIMPLIFICADA)
    // ======================================================
    
    function setupPasswordToggle(btnId, inputId) {
        const btn = document.getElementById(btnId);
        const input = document.getElementById(inputId);

        if (btn && input) {
            btn.addEventListener('click', function(e) {
                // Previne qualquer comportamento padrão estranho
                e.preventDefault();

                const tipoAtual = input.getAttribute('type');

                if (tipoAtual === 'password') {
                    // Mudar para TEXTO (Mostrar senha)
                    input.setAttribute('type', 'text');
                    
                    // Troca o ícone para "Olho Cortado" (indicando que está visível/pode esconder)
                    btn.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                        </svg>`;
                    
                    // (Opcional) Muda a cor para verde para destacar
                    btn.style.color = "#2e7d32";

                } else {
                    // Mudar para PASSWORD (Esconder senha)
                    input.setAttribute('type', 'password');
                    
                    // Troca o ícone para "Olho Normal"
                    btn.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>`;
                    
                    // Volta a cor original
                    btn.style.color = "#666";
                }
            });
        }
    }

    // Ativa a função para os campos existentes
    setupPasswordToggle('btn-toggle-senha', 'senha_login');          
    setupPasswordToggle('btn-toggle-reg-senha', 'reg_senha');        
    setupPasswordToggle('btn-toggle-reg-confirma', 'reg_confirma_senha'); 


    // ======================================================
    // 1. LÓGICA DE LOGIN
    // ======================================================
    const formLogin = document.getElementById('form-login');
    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email_login').value;
            const senha = document.getElementById('senha_login').value;
            const btnSubmit = formLogin.querySelector('button[type="submit"]');

            const textoOriginal = btnSubmit.innerText;
            btnSubmit.innerText = "Entrando...";
            btnSubmit.disabled = true;

            try {
                const response = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, senha })
                });
                const result = await response.json();

                if (response.ok) {
                    localStorage.clear();
                    localStorage.setItem('token', result.token);
                    localStorage.setItem('usuario_id', result.user.id);
                    localStorage.setItem('usuario_logado', result.user.nome);
                    localStorage.setItem('email_logado', result.user.email);
                    localStorage.setItem('tipo_usuario', result.user.tipo || 'operacional');
                    
                    if (typeof showAlert === 'function') showAlert('Bem-vindo!', `Olá, ${result.user.nome}`, 'success');
                    
                    setTimeout(() => window.location.href = 'dashboard.html', 1500);
                } else {
                    if (typeof showAlert === 'function') showAlert('Atenção', result.message, 'error');
                    else alert(result.message);
                }
            } catch (error) {
                console.error(error);
                if (typeof showAlert === 'function') showAlert('Erro de Conexão', 'Não foi possível conectar ao servidor.', 'error');
                else alert('Erro de conexão.');
            } finally {
                btnSubmit.innerText = textoOriginal;
                btnSubmit.disabled = false;
            }
        });
    }

    // ======================================================
    // 2. LÓGICA DE REGISTRO & EDIÇÃO
    // ======================================================
    const formRegistro = document.getElementById('form-registro');
    const urlParamsAuth = new URLSearchParams(window.location.search);
    const idUsuarioEdicao = urlParamsAuth.get('id');
    const origin = urlParamsAuth.get('origin');

    if (formRegistro) {
        const tituloPagina = document.querySelector('.login-header h1');
        const subtituloPagina = document.querySelector('.login-header p');
        const btnSubmit = formRegistro.querySelector('button[type="submit"]');

        const linkLogin = document.getElementById('link-voltar-login');
        const linkDashboard = document.getElementById('link-voltar-dashboard');
        
        const containerTipo = document.getElementById('container-tipo');
        const selectTipo = document.getElementById('reg_tipo');

        // VISIBILIDADE DO PERFIL
        if (!idUsuarioEdicao && origin !== 'dashboard') {
            if (containerTipo) containerTipo.style.display = 'none';
            if (selectTipo) selectTipo.value = 'operacional';
        } else {
            if (containerTipo) containerTipo.style.display = 'block';
        }

        // CONTROLE DOS BOTÕES VOLTAR
        if (origin === 'dashboard' || idUsuarioEdicao) {
            if(linkLogin) linkLogin.style.display = 'none';
            if(linkDashboard) linkDashboard.style.display = 'inline-block';
        } else {
            if(linkLogin) linkLogin.style.display = 'inline-block';
            if(linkDashboard) linkDashboard.style.display = 'none';
        }

        // MODO EDIÇÃO
        if (idUsuarioEdicao) {
            console.log("Modo Edição Usuário:", idUsuarioEdicao);
            if(tituloPagina) tituloPagina.innerText = "Editar Usuário";
            if(subtituloPagina) subtituloPagina.innerText = "Altere os dados de acesso";
            if(btnSubmit) btnSubmit.innerText = "Salvar Alterações";

            document.getElementById('reg_senha').removeAttribute('required');
            const campoConfirma = document.getElementById('reg_confirma_senha');
            if(campoConfirma) campoConfirma.removeAttribute('required');

            const token = localStorage.getItem('token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            fetch(`${BASE_API_URL}/usuarios/${idUsuarioEdicao}`, { headers: headers })
                .then(res => {
                    if (!res.ok) throw new Error('Falha ao buscar usuário');
                    return res.json();
                })
                .then(user => {
                    document.getElementById('reg_nome').value = user.nome;
                    document.getElementById('reg_email').value = user.email;
                    if(selectTipo && user.tipo) {
                        selectTipo.value = user.tipo;
                    }
                })
                .catch(err => {
                    console.error("Erro ao carregar usuário:", err);
                    if (typeof showAlert === 'function') showAlert('Erro', 'Erro ao carregar dados do usuário.', 'error');
                });
        }

        // ENVIO DO FORMULÁRIO
        formRegistro.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const nome = document.getElementById('reg_nome').value;
            const email = document.getElementById('reg_email').value;
            const senha = document.getElementById('reg_senha').value;
            const confirmaSenha = document.getElementById('reg_confirma_senha')?.value;
            const tipo = selectTipo ? selectTipo.value : 'operacional';

            if (senha && senha !== confirmaSenha) {
                if (typeof showAlert === 'function') showAlert('Erro', 'As senhas não conferem!', 'error');
                return;
            }

            let url = `${API_URL}/register`;
            let method = 'POST';
            
            if (idUsuarioEdicao) {
                url = `${BASE_API_URL}/usuarios/${idUsuarioEdicao}`;
                method = 'PUT'; 
            }

            const token = localStorage.getItem('token');
            const headers = { 'Content-Type': 'application/json' };
            if (token && idUsuarioEdicao) { 
                headers['Authorization'] = `Bearer ${token}`;
            }

            try {
                const response = await fetch(url, {
                    method: method,
                    headers: headers,
                    body: JSON.stringify({ nome, email, senha, tipo })
                });
                const result = await response.json();

                if (response.ok) {
                    const msg = idUsuarioEdicao ? 'Usuário atualizado com sucesso!' : 'Conta criada com sucesso!';
                    if (typeof showAlert === 'function') showAlert('Sucesso', msg, 'success');
                    
                    setTimeout(() => {
                        if(idUsuarioEdicao || origin === 'dashboard') {
                            window.location.href = 'dashboard.html';
                        } else {
                            window.location.href = 'index.html';
                        }
                    }, 1500);
                } else {
                    if (typeof showAlert === 'function') showAlert('Erro', result.message, 'error');
                }
            } catch (error) {
                console.error(error);
                alert('Erro na operação.');
            }
        });
    }

    // ======================================================
    // 3. LÓGICA DE RECUPERAÇÃO
    // ======================================================
    const formRecuperar = document.getElementById('form-recuperar');
    if (formRecuperar) {
        formRecuperar.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('rec_email').value;
            const btnSubmit = formRecuperar.querySelector('button[type="submit"]');
            
            const textoOriginal = btnSubmit.innerText;
            btnSubmit.innerText = "Enviando...";
            btnSubmit.disabled = true;

            try {
                const response = await fetch(`${API_URL}/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const result = await response.json();
                
                if (typeof showAlert === 'function') showAlert('Enviado', result.message, 'success');
                setTimeout(() => window.location.href = 'index.html', 3000);
            } catch (error) {
                alert('Erro de conexão.');
            } finally {
                btnSubmit.innerText = textoOriginal;
                btnSubmit.disabled = false;
            }
        });
    }
});