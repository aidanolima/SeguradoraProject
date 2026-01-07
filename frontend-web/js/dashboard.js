// js/dashboard.js - VERSÃO HÍBRIDA (LOCAL/PROD) CORRIGIDA

// 1. VERIFICAÇÃO DE SEGURANÇA
// Se o config.js não carregou, paramos tudo para não dar erro
if (typeof BASE_API_URL === 'undefined') {
    console.warn("Aviso: config.js demorou a carregar. Usando padrão local.");
    var BASE_API_URL = 'http://localhost:3000'; // Fallback de segurança
}

const token = localStorage.getItem('token');

// --- FUNÇÃO PARA LER DADOS DO TOKEN (Saber se é Admin) ---
function lerDadosToken() {
    if (!token) return null;
    try {
        const payload = token.split('.')[1];
        const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
        return decoded;
    } catch (e) { return null; }
}

const usuarioLogado = lerDadosToken();
// Se não conseguiu ler o token, assume que não é admin
const isAdm = (usuarioLogado && usuarioLogado.tipo === 'admin');

// --- ESTILOS DOS BOTÕES ---
const btnBaseStyle = `
    display: block; width: 100px; padding: 6px 0; margin: 0 auto 5px auto;    
    font-size: 11px; font-weight: bold; font-family: sans-serif; text-align: center; 
    border-radius: 4px; border: none; cursor: pointer; text-decoration: none; 
    line-height: normal; color: white; text-transform: uppercase; box-shadow: 0 2px 3px rgba(0,0,0,0.2);
`;
const stylePDF    = `${btnBaseStyle} background-color: #007bff;`; // Azul
const styleEditar = `${btnBaseStyle} background-color: #f0ad4e;`; // Laranja
const styleExcluir= `${btnBaseStyle} background-color: #d9534f;`; // Vermelho

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    // Bloqueio de segurança
    if (!token) { 
        window.location.href = 'index.html'; 
        return; 
    }

    console.log(`🚀 Dashboard iniciado.`);
    console.log(`📡 Conectado em: ${BASE_API_URL}`);
    console.log(`👤 Usuário: ${usuarioLogado?.email} (${usuarioLogado?.tipo})`);

    // Atualiza cabeçalho
    const elUser = document.getElementById('user-name');
    const elRole = document.getElementById('user-role');
    if(elUser) elUser.innerText = usuarioLogado?.nome || usuarioLogado?.email || 'Usuário';
    if(elRole) elRole.innerText = isAdm ? 'ADMINISTRADOR' : 'OPERACIONAL';

    // Remove modal antigo se existir (limpeza)
    const modalVelho = document.getElementById('modal-confirmacao');
    if (modalVelho) modalVelho.remove();

    // Carrega os dados
    carregarPropostas();
    carregarUsuarios();
    carregarApolices();

    // Configura botão sair
    const btnLogout = document.getElementById('btn-logout');
    if(btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.clear();
            window.location.href = 'index.html';
        });
    }
});

function atualizarCard(id, valor) { 
    const el = document.getElementById(id); 
    if(el) el.innerText = valor; 
}

// ==========================================
// 3. LISTAGEM DE PROPOSTAS
// ==========================================
async function carregarPropostas() {
    const tbody = document.getElementById('lista-propostas');
    if(!tbody) return;

    try {
        // ATENÇÃO: Usa BASE_API_URL (do config.js) em vez de variável fixa
        const res = await fetch(`${BASE_API_URL}/propostas`, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        
        const lista = await res.json();

        // CORREÇÃO DO ERRO "forEach": Verifica se é uma lista válida
        if (!Array.isArray(lista)) {
            console.warn("API de Propostas não retornou uma lista:", lista);
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Erro ao carregar dados.</td></tr>';
            return;
        }

        atualizarCard('total-clientes', lista.length);
        atualizarCard('total-veiculos', lista.length);
        tbody.innerHTML = '';
        
        if (lista.length === 0) { 
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;">Nenhum cliente cadastrado.</td></tr>'; 
            return; 
        }
        
        lista.forEach(p => {
            const tr = document.createElement('tr');
            const btnExcluir = isAdm ? `<button type="button" onclick="prepararExclusao('propostas', '${p.id}')" style="${styleExcluir}">EXCLUIR</button>` : '';

            tr.innerHTML = `
                <td style="vertical-align: middle;">${p.id}</td>
                <td style="vertical-align: middle;">${p.nome}</td>
                <td style="vertical-align: middle;">${p.modelo}</td>
                <td style="vertical-align: middle;"><strong>${p.placa}</strong></td>
                <td style="vertical-align: middle; padding: 10px;">
                    <a href="cadastro.html?id=${p.id}" style="${styleEditar}">EDITAR</a>
                    ${btnExcluir}
                </td>`;
            tbody.appendChild(tr);
        });
    } catch (e) { 
        console.error("Erro propostas:", e); 
    }
}

// ==========================================
// 4. LISTAGEM DE USUÁRIOS
// ==========================================
async function carregarUsuarios() {
    const tbody = document.getElementById('lista-usuarios');
    if(!tbody) return;

    try {
        const res = await fetch(`${BASE_API_URL}/usuarios`, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });

        const lista = await res.json();

        if (!Array.isArray(lista)) {
            console.warn("API de Usuários não retornou lista.");
            return;
        }

        atualizarCard('total-usuarios', lista.length);
        tbody.innerHTML = '';
        
        lista.forEach(u => {
            const tr = document.createElement('tr');
            const badge = u.tipo === 'admin' ? 'badge-admin' : 'badge-user';
            // Botão excluir
            const btnExcluir = isAdm ? `<button type="button" onclick="prepararExclusao('usuarios', '${u.id}')" style="${styleExcluir}">EXCLUIR</button>` : '';

            tr.innerHTML = `
                <td style="vertical-align: middle;">${u.id}</td>
                <td style="vertical-align: middle;">${u.nome}</td>
                <td style="vertical-align: middle;">${u.email}</td>
                <td style="vertical-align: middle;"><span class="badge ${badge}">${u.tipo ? u.tipo.toUpperCase() : 'USER'}</span></td>
                <td style="vertical-align: middle; padding: 10px;">
                    <a href="registro.html?id=${u.id}&origin=dashboard" style="${styleEditar}">EDITAR</a>
                    ${btnExcluir}
                </td>`;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error("Erro usuarios:", e); }
}

// ==========================================
// 5. LISTAGEM DE APÓLICES
// ==========================================
async function carregarApolices() {
    const tbody = document.getElementById('lista-apolices');
    if(!tbody) return;

    try {
        const res = await fetch(`${BASE_API_URL}/apolices`, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        const lista = await res.json();

        if (!Array.isArray(lista)) {
            console.warn("API de Apólices não retornou lista.");
            return;
        }

        atualizarCard('total-apolices', lista.length);
        tbody.innerHTML = '';
        
        if (lista.length === 0) { 
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;">Nenhuma apólice emitida.</td></tr>'; 
            return; 
        }

        lista.forEach(a => {
            const tr = document.createElement('tr');
            const premio = a.premio_total ? parseFloat(a.premio_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
            const vigencia = a.vigencia_fim ? new Date(a.vigencia_fim).toLocaleDateString('pt-BR') : '-';
            const temPdf = a.arquivo_pdf ? '' : 'opacity:0.6;cursor:not-allowed;background:#6c757d;';
            const clickPdf = a.arquivo_pdf ? `onclick="visualizarPDF(${a.id})"` : '';

            const btnExcluir = isAdm ? `<button type="button" onclick="prepararExclusao('apolices', '${a.id}')" style="${styleExcluir}">EXCLUIR</button>` : '';

            tr.innerHTML = `
                <td style="vertical-align: middle;">${a.numero_apolice || 'S/N'}</td>
                <td style="vertical-align: middle;">${a.cliente || 'ND'}</td>
                <td style="vertical-align: middle;">${a.placa || '-'}</td>
                <td style="vertical-align: middle;">${vigencia}</td>
                <td style="vertical-align: middle;">${premio}</td>
                <td style="vertical-align: middle; padding: 10px;">
                    <button type="button" ${clickPdf} style="${stylePDF} ${temPdf}">PDF</button>
                    <a href="apolice.html?id=${a.id}" style="${styleEditar}">EDITAR</a>
                    ${btnExcluir}
                </td>`;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error("Erro apolices:", e); }
}

// ==========================================
// 6. FUNÇÃO PDF
// ==========================================
async function visualizarPDF(id) {
    // Abre a janela antes para evitar bloqueio de popup
    const win = window.open('', '_blank');
    if(win) win.document.write('<h3>Aguarde, buscando PDF no servidor...</h3>');
    
    try {
        const res = await fetch(`${BASE_API_URL}/apolices/${id}/pdf`, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        
        if(res.ok) {
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            if(win) win.location.href = url; else window.open(url, '_blank');
        } else {
            if(win) win.close();
            if(typeof Swal !== 'undefined') Swal.fire('Aviso', 'PDF não encontrado no servidor.', 'warning');
            else alert('PDF não encontrado.');
        }
    } catch (e) { 
        if(win) win.close(); 
        console.error(e);
        alert('Erro ao baixar PDF.'); 
    }
}

// ==========================================
// 7. SISTEMA DE EXCLUSÃO (Global)
// ==========================================
window.prepararExclusao = function(tipo, id) {
    if(typeof Swal === 'undefined') {
        if(confirm("Tem certeza que deseja excluir?")) executarExclusaoAPI(tipo, id);
        return;
    }

    Swal.fire({
        title: 'Confirmação',
        text: `Você vai apagar o item #${id}. Essa ação não pode ser desfeita!`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d32f2f',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'SIM, EXCLUIR',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            executarExclusaoAPI(tipo, id);
        }
    });
}

async function executarExclusaoAPI(tipo, id) {
    if(typeof Swal !== 'undefined') Swal.fire({ title: 'Excluindo...', didOpen: () => Swal.showLoading() });
    
    try {
        const res = await fetch(`${BASE_API_URL}/${tipo}/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            if(typeof Swal !== 'undefined') await Swal.fire('Sucesso!', 'Registro excluído.', 'success');
            else alert("Registro excluído com sucesso.");
            
            // Recarrega a lista correta
            if(tipo === 'propostas') carregarPropostas();
            if(tipo === 'usuarios') carregarUsuarios();
            if(tipo === 'apolices') carregarApolices();
        } else {
            const err = await res.json();
            if(typeof Swal !== 'undefined') Swal.fire('Erro', err.message || 'Falha ao excluir.', 'error');
            else alert("Erro: " + (err.message || 'Falha ao excluir.'));
        }
    } catch (error) { 
        if(typeof Swal !== 'undefined') Swal.fire('Erro', 'Falha de conexão.', 'error'); 
        else alert("Falha de conexão.");
    }
}