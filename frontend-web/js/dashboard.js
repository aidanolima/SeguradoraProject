const API_URL = 'https://https://seguradoraproject.onrender.com
';


// ==========================================
// 1. ESTILOS VISUAIS (BOTÕES EMPILHADOS)
// ==========================================
const TD_STYLE = 'vertical-align: middle; text-align: center; width: 100px; padding: 5px;'; 
const BTN_BASE = 'display: block; width: 100%; margin-bottom: 4px; padding: 4px 0; font-size: 10px; border-radius: 4px; border: none; cursor: pointer; font-weight: bold; text-transform: uppercase; text-decoration: none; text-align: center;';

const BTN_EDITAR = `background-color: #f39c12; color: white; ${BTN_BASE}`;
const BTN_EXCLUIR = `background-color: #dc3545; color: white; ${BTN_BASE}`;
const BTN_PDF = `background-color: #007bff; color: white; ${BTN_BASE}`;
const TXT_SEM_PDF = 'display: block; font-size: 10px; color: #ccc; margin-bottom: 4px; font-style: italic;';

// Variáveis do Modal
let idParaExcluir = null;
let tipoExclusao = null;

// ==========================================
// INICIALIZAÇÃO E SEGURANÇA
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Verifica token imediatamente. Se não tiver, tchau.
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    verificarPerfilUsuario();

    // Carrega dados (passando o token nos headers)
    carregarPropostas();
    carregarApolices();
    carregarUsuarios(); // Esse só vai funcionar se for admin, o server bloqueia

    configurarBusca('busca-proposta', 'lista-propostas');
    configurarBusca('busca-usuario', 'lista-usuarios');
    configurarBusca('busca-apolice', 'lista-apolices');

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.addEventListener('click', logout);

    const btnConfirmar = document.getElementById('btn-confirmar-modal');
    if(btnConfirmar) btnConfirmar.addEventListener('click', executarExclusaoReal);
});

// Helper para gerar o cabeçalho com Token
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// ==========================================
// FUNÇÃO DE PERFIL
// ==========================================
function verificarPerfilUsuario() {
    const nome = localStorage.getItem('usuario_logado');
    const tipo = localStorage.getItem('tipo_usuario');
    const elementoNome = document.getElementById('user-greeting');
    
    // Atualiza saudação
    if (elementoNome && nome) {
        const perfilTexto = tipo ? tipo.toUpperCase() : 'USER';
        elementoNome.innerText = `Olá, ${nome} (${perfilTexto})`;
        elementoNome.style.color = "#555"; 
    }

    // REGRA DE VISIBILIDADE: Se não for admin, esconde gestão de usuários
    if (tipo !== 'admin' && tipo !== 'TI') {
        const secaoUsuarios = document.getElementById('secao-usuarios');
        const cardUsuarios = document.getElementById('card-stats-usuarios');
        if (secaoUsuarios) secaoUsuarios.style.display = 'none';
        if (cardUsuarios) cardUsuarios.style.display = 'none';
    }
}

function logout() {
    localStorage.clear(); // Limpa token, nome, email, tudo
    window.location.href = 'index.html'; 
}

// ==========================================
// FUNÇÕES DE NAVEGAÇÃO
// ==========================================
function editarRegistro(tipo, id) {
    if (tipo === 'cliente') window.location.href = `cadastro.html?id=${id}`;
    else if (tipo === 'usuario') window.location.href = `registro.html?id=${id}`;
    else if (tipo === 'apolice') window.location.href = `apolice.html?id=${id}`;
}

// ==========================================
// FUNÇÕES DO MODAL
// ==========================================
function abrirModal(tipo, id) {
    idParaExcluir = id;
    tipoExclusao = tipo;
    const modal = document.getElementById('modal-confirmacao');
    const texto = document.getElementById('texto-modal');
    
    if(tipo === 'cliente') texto.innerText = `Excluir Cliente ID: ${id}?`;
    if(tipo === 'usuario') texto.innerText = `Excluir Usuário ID: ${id}?`;
    if(tipo === 'apolice') texto.innerText = `Excluir Apólice ID: ${id}?`;

    modal.style.display = 'flex'; 
}

function fecharModal() {
    document.getElementById('modal-confirmacao').style.display = 'none';
    idParaExcluir = null;
    tipoExclusao = null;
}

async function executarExclusaoReal() {
    if(!idParaExcluir || !tipoExclusao) return;
    
    let endpoint = '';
    if(tipoExclusao === 'cliente') endpoint = `/propostas/${idParaExcluir}`;
    if(tipoExclusao === 'usuario') endpoint = `/usuarios/${idParaExcluir}`;
    if(tipoExclusao === 'apolice') endpoint = `/apolices/${idParaExcluir}`;

    try {
        // Agora envia o Token no DELETE também
        const response = await fetch(`${API_URL}${endpoint}`, { 
            method: 'DELETE',
            headers: getAuthHeaders() 
        });

        if (response.ok) {
            if(tipoExclusao === 'cliente') await carregarPropostas();
            if(tipoExclusao === 'usuario') await carregarUsuarios();
            if(tipoExclusao === 'apolice') await carregarApolices();
        } else {
            // Se for 403, significa proibido (não é admin)
            if (response.status === 403 || response.status === 401) {
                alert("Você não tem permissão para excluir este item.");
            } else {
                alert("Erro ao excluir.");
            }
        }
    } catch (error) { console.error("Erro:", error); }
    fecharModal();
}

// ==========================================
// GERAIS
// ==========================================
function configurarBusca(idInput, idTabela) {
    const input = document.getElementById(idInput);
    if (!input) return;
    input.addEventListener('keyup', function() {
        const termo = this.value.toLowerCase();
        const tbody = document.getElementById(idTabela);
        if (!tbody) return;
        const linhas = tbody.getElementsByTagName('tr');
        for (let i = 0; i < linhas.length; i++) {
            const linha = linhas[i];
            linha.style.display = linha.textContent.toLowerCase().includes(termo) ? '' : 'none';
        }
    });
}

function atualizarCard(idElemento, valor) {
    const el = document.getElementById(idElemento);
    if (el) el.innerText = valor;
}

// ==========================================
// LISTAGENS (COM AUTH HEADERS)
// ==========================================
async function carregarPropostas() {
    try {
        const res = await fetch(`${API_URL}/propostas`, { headers: getAuthHeaders() });
        if (!res.ok) return; // Se der erro de auth, não carrega e o usuário não vê nada
        
        const propostas = await res.json();
        atualizarCard('total-clientes', propostas.length);
        atualizarCard('total-veiculos', propostas.length);
        
        const tbody = document.getElementById('lista-propostas');
        if(!tbody) return;
        tbody.innerHTML = '';
        propostas.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${p.id}</td>
                <td>${p.nome}</td>
                <td>${p.modelo}</td>
                <td><strong>${p.placa}</strong></td>
                <td style="${TD_STYLE}">
                    <button style="${BTN_EDITAR}" onclick="editarRegistro('cliente', ${p.id})">EDITAR</button>
                    <button style="${BTN_EXCLUIR}" onclick="abrirModal('cliente', ${p.id})">EXCLUIR</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

async function carregarUsuarios() {
    // Verifica se o elemento existe (se não for admin, ele pode ter sido removido ou escondido)
    const tbody = document.getElementById('lista-usuarios');
    if (!tbody || tbody.offsetParent === null) return; // Se estiver escondido, nem tenta carregar

    try {
        // Rota protegida no server.js
        const res = await fetch(`${API_URL}/usuarios`, { headers: getAuthHeaders() });
        
        if (res.status === 403 || res.status === 401) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Acesso Restrito</td></tr>';
            return;
        }

        const usuarios = await res.json();
        atualizarCard('total-usuarios', usuarios.length);
        
        tbody.innerHTML = '';
        usuarios.forEach(u => {
            // Formata data se existir, senão usa '-'
            const data = u.data_criacao ? new Date(u.data_criacao).toLocaleDateString('pt-BR') : '-';
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.id}</td>
                <td>${u.nome}</td>
                <td>${u.email}</td>
                <td>${u.tipo}</td>
                <td style="${TD_STYLE}">
                    <button style="${BTN_EDITAR}" onclick="editarRegistro('usuario', ${u.id})">EDITAR</button>
                    <button style="${BTN_EXCLUIR}" onclick="abrirModal('usuario', ${u.id})">EXCLUIR</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

async function carregarApolices() {
    try {
        const res = await fetch(`${API_URL}/apolices`, { headers: getAuthHeaders() });
        if (!res.ok) return;

        const apolices = await res.json();
        atualizarCard('total-apolices', apolices.length);
        
        const tbody = document.getElementById('lista-apolices');
        if(!tbody) return;
        tbody.innerHTML = '';
        apolices.forEach(a => {
            const dataFim = a.vigencia_fim ? new Date(a.vigencia_fim).toLocaleDateString('pt-BR') : '-';
            
            let htmlPDF = `<span style="${TXT_SEM_PDF}">Sem PDF</span>`;
            if (a.arquivo_pdf) {
                const url = `${API_URL}/${a.arquivo_pdf.replace(/\\/g, '/')}`;
                htmlPDF = `<a href="${url}" target="_blank" style="${BTN_PDF}">PDF</a>`;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${a.numero_apolice || 'S/N'}</td>
                <td>${a.cliente}</td>
                <td><strong>${a.placa}</strong></td>
                <td>${dataFim}</td>
                <td style="color:green; font-weight:bold">R$ ${a.premio_total}</td>
                <td style="${TD_STYLE}">
                    ${htmlPDF}
                    <button style="${BTN_EDITAR}" onclick="editarRegistro('apolice', ${a.id})">EDITAR</button>
                    <button style="${BTN_EXCLUIR}" onclick="abrirModal('apolice', ${a.id})">EXCLUIR</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}