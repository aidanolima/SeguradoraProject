document.addEventListener("DOMContentLoaded", function() {
    const headerContainer = document.getElementById('global-header');
    
    if (!headerContainer) return; // Se não tiver o container, não faz nada

    const token = localStorage.getItem('token');
    const userNome = localStorage.getItem('usuario_logado');
    const userTipo = localStorage.getItem('tipo_usuario');

    // URLs das páginas (para os links)
    const links = [
        { nome: 'Painel', url: 'dashboard.html' },
        { nome: 'Nova Proposta', url: 'cadastro.html' },
        { nome: 'Nova Apólice', url: 'apolice.html' }
    ];

    // Se for Admin, adiciona link de usuários
    if (userTipo === 'admin' || userTipo === 'TI') {
        links.push({ nome: 'Usuários', url: 'registro.html?origin=dashboard' });
    }

    let htmlNavLinks = '';
    // Constrói os links do menu apenas se estiver logado
    if (token) {
        links.forEach(link => {
            htmlNavLinks += `<a href="${link.url}">${link.nome}</a>`;
        });
    }

    // HTML DO HEADER
    // Se tiver token, mostra menu e botão sair. Se não, mostra só a logo.
    let conteudoDireita = '';
    
    if (token && userNome) {
        // USUÁRIO LOGADO
        const perfil = userTipo ? userTipo.toUpperCase() : 'USER';
        conteudoDireita = `
            <div class="header-nav">
                ${htmlNavLinks}
            </div>
            <div class="header-user-area">
                <span class="user-greeting">Olá, ${userNome} (${perfil})</span>
                <button id="btn-header-logout" class="btn-logout">SAIR</button>
            </div>
        `;
    } else {
        // USUÁRIO NÃO LOGADO (Página de Login ou Recuperar Senha)
        conteudoDireita = `
            <div class="header-user-area">
                <span class="user-greeting" style="font-weight: normal;">Sistema de Gestão</span>
            </div>
        `;
    }

    const htmlHeader = `
        <header class="app-header">
            <div class="header-brand">
                <img src="assets/logo.png" alt="Logo" class="header-logo">
                <span class="header-title">Painel de Controle</span>
            </div>
            ${conteudoDireita}
        </header>
    `;

    // Injeta o HTML na página
    headerContainer.innerHTML = htmlHeader;

    // Configura o evento do botão de Logout (se ele existir)
    const btnLogout = document.getElementById('btn-header-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', function() {
            localStorage.clear();
            window.location.href = 'index.html';
        });
    }
});