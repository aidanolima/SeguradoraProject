// js/dashboard.js - VERSÃO FINAL COM SWEETALERT2

const API_URL = 'https://seguradoraproject.onrender.com';
const token = localStorage.getItem('token');

// ------------------------------------------------------------------
// ESTILOS DOS BOTÕES (Layout Vertical - Padrão Mantido)
// ------------------------------------------------------------------
const btnBaseStyle = `
    display: block; width: 100px; padding: 6px 0; margin: 0 auto 5px auto;    
    font-size: 11px; font-weight: bold; font-family: sans-serif; text-align: center; 
    border-radius: 4px; border: none; cursor: pointer; text-decoration: none; 
    line-height: normal; color: white; text-transform: uppercase; box-shadow: 0 2px 3px rgba(0,0,0,0.2);
`;
const stylePDF    = `${btnBaseStyle} background-color: #007bff;`; // Azul
const styleEditar = `${btnBaseStyle} background-color: #f0ad4e;`; // Laranja
const styleExcluir= `${btnBaseStyle} background-color: #d9534f;`; // Vermelho

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    if (!token) { window.location.href = 'index.html'; return; }
    console.log("🚀 Dashboard carregado.");

    // Remove qualquer resquício de modal antigo do HTML (limpeza)
    const modalVelho = document.getElementById('modal-confirmacao');
    if (modalVelho) modalVelho.remove();

    if(typeof carregarEstatisticas === 'function') carregarEstatisticas();
    carregarPropostas();
    carregarUsuarios();
    carregarApolices();
});

// Funções Auxiliares
function atualizarCard(id, valor) { const el = document.getElementById(id); if(el) el.innerText = valor; }
function carregarEstatisticas() {}

// ==========================================
// 1. LISTAGEM DE PROPOSTAS
// ==========================================
async function carregarPropostas() {
    const tbody = document.getElementById('lista-propostas');
    if(!tbody) return;
    try {
        const res = await fetch(`${API_URL}/propostas`, { headers: { 'Authorization': `Bearer ${token}` } });
        const lista = await res.json();
        atualizarCard('total-clientes', lista.length);
        atualizarCard('total-veiculos', lista.length);
        tbody.innerHTML = '';
        if (lista.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;">Nenhum cliente cadastrado.</td></tr>'; return; }
        
        lista.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="vertical-align: middle;">${p.id}</td>
                <td style="vertical-align: middle;">${p.nome}</td>
                <td style="vertical-align: middle;">${p.modelo}</td>
                <td style="vertical-align: middle;"><strong>${p.placa}</strong></td>
                <td style="vertical-align: middle; padding: 10px;">
                    <a href="cadastro.html?id=${p.id}" style="${styleEditar}">EDITAR</a>
                    <button type="button" onclick="prepararExclusao('propostas', '${p.id}')" style="${styleExcluir}">EXCLUIR</button>
                </td>`;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

// ==========================================
// 2. LISTAGEM DE USUÁRIOS (COM LÓGICA DE PERFIL)
// ==========================================
async function carregarUsuarios() {
    const tbody = document.getElementById('lista-usuarios');
    if(!tbody) return;
    try {
        const res = await fetch(`${API_URL}/usuarios`, { headers: { 'Authorization': `Bearer ${token}` } });
        
        // Se der erro 403 (Proibido), limpa a lista
        if(!res.ok) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Acesso restrito.</td></tr>';
            return;
        }

        const lista = await res.json();
        atualizarCard('total-usuarios', lista.length);
        tbody.innerHTML = '';
        
        // Descobre quem é o usuário logado no navegador
        const tipoUsuarioLogado = localStorage.getItem('tipo_usuario'); // 'admin' ou 'operacional'

        lista.forEach(u => {
            const tr = document.createElement('tr');
            const badge = u.tipo === 'admin' ? 'badge-admin' : 'badge-user';
            
            // Lógica do botão Excluir:
            // Só aparece se eu for ADMIN. Se for operacional, string vazia.
            const btnExcluirHTML = (tipoUsuarioLogado === 'admin') 
                ? `<button type="button" onclick="prepararExclusao('usuarios', '${u.id}')" style="${styleExcluir}">EXCLUIR</button>`
                : ''; 

            tr.innerHTML = `
                <td style="vertical-align: middle;">${u.id}</td>
                <td style="vertical-align: middle;">${u.nome}</td>
                <td style="vertical-align: middle;">${u.email}</td>
                <td style="vertical-align: middle;"><span class="badge ${badge}">${u.tipo.toUpperCase()}</span></td>
                <td style="vertical-align: middle; padding: 10px;">
                    <a href="registro.html?id=${u.id}&origin=dashboard" style="${styleEditar}">EDITAR</a>
                    ${btnExcluirHTML}
                </td>`;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

// ==========================================
// 3. LISTAGEM DE APÓLICES
// ==========================================
async function carregarApolices() {
    const tbody = document.getElementById('lista-apolices');
    if(!tbody) return;
    try {
        const res = await fetch(`${API_URL}/apolices`, { headers: { 'Authorization': `Bearer ${token}` } });
        const lista = await res.json();
        atualizarCard('total-apolices', lista.length);
        tbody.innerHTML = '';
        if (lista.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;">Nenhuma apólice emitida.</td></tr>'; return; }

        lista.forEach(a => {
            const tr = document.createElement('tr');
            const premio = a.premio_total ? parseFloat(a.premio_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
            const vigencia = a.vigencia_fim ? new Date(a.vigencia_fim).toLocaleDateString('pt-BR') : '-';
            const temPdf = a.arquivo_pdf ? '' : 'opacity:0.6;cursor:not-allowed;background:#6c757d;';
            const clickPdf = a.arquivo_pdf ? `onclick="visualizarPDF(${a.id})"` : '';

            tr.innerHTML = `
                <td style="vertical-align: middle;">${a.numero_apolice || 'S/N'}</td>
                <td style="vertical-align: middle;">${a.cliente || 'ND'}</td>
                <td style="vertical-align: middle;">${a.placa || '-'}</td>
                <td style="vertical-align: middle;">${vigencia}</td>
                <td style="vertical-align: middle;">${premio}</td>
                <td style="vertical-align: middle; padding: 10px;">
                    <button type="button" ${clickPdf} style="${stylePDF} ${temPdf}">PDF</button>
                    <a href="apolice.html?id=${a.id}" style="${styleEditar}">EDITAR</a>
                    <button type="button" onclick="prepararExclusao('apolices', '${a.id}')" style="${styleExcluir}">EXCLUIR</button>
                </td>`;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

// 4. FUNÇÃO PDF
async function visualizarPDF(id) {
    const win = window.open('', '_blank');
    if(win) win.document.write('<h3>Buscando PDF...</h3>');
    try {
        const res = await fetch(`${API_URL}/apolices/${id}/pdf`, { headers: { 'Authorization': `Bearer ${token}` } });
        if(res.ok) {
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            if(win) win.location.href = url; else window.open(url, '_blank');
        } else {
            if(win) win.close();
            Swal.fire('Aviso', 'PDF não encontrado.', 'warning');
        }
    } catch (e) { if(win) win.close(); Swal.fire('Erro', 'Erro ao baixar PDF.', 'error'); }
}

// ==========================================
// 5. SISTEMA DE EXCLUSÃO (SWEETALERT2)
// ==========================================

// Variáveis não são mais estritamente necessárias globais aqui, 
// mas mantemos a estrutura funcional.

window.prepararExclusao = function(tipo, id) {
    console.log(`[DEBUG] Preparando exclusão SweetAlert: Tipo=${tipo}, ID=${id}`);

    Swal.fire({
        title: 'Confirmação',
        text: `Você vai apagar o item #${id} (${tipo.toUpperCase()}). Essa ação não pode ser desfeita!`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d32f2f', // Vermelho Excluir
        cancelButtonColor: '#6c757d',  // Cinza Cancelar
        confirmButtonText: 'SIM, EXCLUIR',
        cancelButtonText: 'Cancelar',
        reverseButtons: true
    }).then((result) => {
        if (result.isConfirmed) {
            executarExclusaoAPI(tipo, id);
        }
    });
}

async function executarExclusaoAPI(tipo, id) {
    console.log(`[DEBUG] Disparando DELETE para API...`);
    
    // Mostra loading
    Swal.fire({
        title: 'Excluindo...',
        text: 'Aguarde um momento',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const res = await fetch(`${API_URL}/${tipo}/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log(`[DEBUG] Resposta API Status: ${res.status}`);

        if (res.ok) {
            await Swal.fire({
                icon: 'success',
                title: 'Excluído!',
                text: 'O registro foi removido com sucesso.',
                confirmButtonColor: '#2e7d32'
            });
            
            // Recarrega a tabela correta
            if(tipo === 'propostas') carregarPropostas();
            if(tipo === 'usuarios') carregarUsuarios();
            if(tipo === 'apolices') carregarApolices();
        } else {
            const err = await res.json();
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: err.message || 'Não foi possível excluir o item.'
            });
        }
    } catch (error) {
        console.error("[DEBUG] Erro de Rede:", error);
        Swal.fire({
            icon: 'error',
            title: 'Erro de Conexão',
            text: 'Verifique sua internet e tente novamente.'
        });
    }
}