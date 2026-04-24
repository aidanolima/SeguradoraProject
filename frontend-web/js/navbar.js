document.addEventListener("DOMContentLoaded", function() {
    const sidebarContainer = document.getElementById('global-sidebar');
    
    const container = sidebarContainer || document.getElementById('global-header');
    if (!container) return;

    const token = localStorage.getItem('token');
    const userNome = localStorage.getItem('usuario_logado') || 'Usuário';
    const userTipo = localStorage.getItem('tipo_usuario') || 'user';
    const userFoto = localStorage.getItem('foto_usuario'); 

    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    if (!token && currentPath !== 'index.html' && currentPath !== 'recuperar.html' && currentPath !== 'redefinir.html') {
        window.location.href = 'index.html';
        return;
    }

    const links = [
        { nome: 'Dashboard', url: 'dashboard.html', icon: 'fas fa-chart-line' },
        { nome: 'Clientes', url: 'cadastro.html', icon: 'fas fa-users' },
        { nome: 'Apólices', url: 'apolice.html', icon: 'fas fa-file-contract' },
        { nome: 'Relatórios', url: 'relatorios.html', icon: 'fas fa-file-invoice-dollar' }
    ];

    if (userTipo === 'admin' || userTipo === 'ti' || userTipo === 'TI') {
        links.push({ nome: 'Usuários', url: 'registro.html?origin=dashboard', icon: 'fas fa-user-shield' });
    }

    let htmlNavLinks = '';
    links.forEach(link => {
        const activeClass = (currentPath === link.url || (currentPath === '' && link.url === 'dashboard.html')) ? 'active' : '';
        htmlNavLinks += `
            <a href="${link.url}" class="sidebar-link ${activeClass}">
                <i class="${link.icon}"></i>
                <span>${link.nome}</span>
            </a>
        `;
    });

    const iniciais = userNome.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    const perfil = userTipo.toUpperCase();

    // 🚀 LÓGICA BLINDADA PARA A FOTO DO USUÁRIO
    let avatarHTML = '';
    let temFoto = (userFoto && userFoto !== 'null' && userFoto !== 'undefined' && userFoto.trim() !== '');

    if (temFoto) {
        let finalFotoUrl = userFoto;
        // Se a imagem estiver local no servidor (sem https://), ele junta com a URL da API
        if (finalFotoUrl.startsWith('/')) {
            const baseUrl = (typeof API_URL !== 'undefined') ? API_URL : 'https://seguradoraproject.onrender.com';
            finalFotoUrl = baseUrl + finalFotoUrl;
        }
        avatarHTML = `<img src="${finalFotoUrl}" alt="Foto" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
    } else {
        avatarHTML = `<span style="color: white; font-weight: bold; font-size: 14px;">${iniciais}</span>`;
    }

    const htmlSidebar = `
        <div class="mobile-topbar">
            <button class="mobile-menu-btn" id="btn-open-sidebar">
                <i class="fas fa-bars"></i>
            </button>
            <img src="assets/logo.png" alt="Logo" style="height: 35px; filter: brightness(0) invert(1);">
            <div style="width: 40px;"></div>
        </div>

        <div class="sidebar-overlay" id="sidebar-overlay"></div>

        <aside class="app-sidebar" id="app-sidebar">
            <div class="sidebar-brand">
                <img src="assets/logo.png" alt="Logo" class="sidebar-logo">
                <span class="sidebar-title">Gestão Clientes</span>
            </div>

            <nav class="sidebar-nav">
                ${htmlNavLinks}
            </nav>

            <div class="sidebar-user-area">
                <div class="user-profile">
                    <div class="user-avatar" style="padding: 0; overflow: hidden; display: flex; align-items: center; justify-content: center; background-color: ${temFoto ? 'transparent' : '#00a86b'}; border: 2px solid #00a86b;">
                        ${avatarHTML}
                    </div>
                    <div class="user-details">
                        <span class="user-name-sidebar" title="${userNome}">${userNome}</span>
                        <span class="user-role-sidebar">${perfil}</span>
                    </div>
                </div>
                <button id="btn-sidebar-logout" class="btn-logout-sidebar">
                    <i class="fas fa-sign-out-alt"></i> SAIR DO SISTEMA
                </button>
            </div>
        </aside>
    `;

    container.innerHTML = htmlSidebar;

    const btnOpen = document.getElementById('btn-open-sidebar');
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    function toggleSidebar() {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    }

    if (btnOpen) btnOpen.addEventListener('click', toggleSidebar);
    if (overlay) overlay.addEventListener('click', toggleSidebar);

    const btnLogout = document.getElementById('btn-sidebar-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', function() {
            Swal.fire({
                title: 'Sair do Sistema?',
                text: "Você precisará fazer login novamente.",
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#003366',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Sim, Sair',
                cancelButtonText: 'Cancelar'
            }).then((result) => {
                if (result.isConfirmed) {
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.href = 'index.html';
                }
            });
        });
    }
});