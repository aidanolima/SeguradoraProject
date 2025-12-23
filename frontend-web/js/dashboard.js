// js/dashboard.js - VERSÃO COM MODAL AUTOMÁTICO (CORREÇÃO VISUAL)

const API_URL = 'https://seguradoraproject.onrender.com';
const token = localStorage.getItem('token');

// Estilos dos Botões (Layout Vertical)
const btnBaseStyle = `
    display: block; width: 100px; padding: 6px 0; margin: 0 auto 5px auto;    
    font-size: 11px; font-weight: bold; font-family: sans-serif; text-align: center; 
    border-radius: 4px; border: none; cursor: pointer; text-decoration: none; 
    line-height: normal; color: white; text-transform: uppercase; box-shadow: 0 2px 3px rgba(0,0,0,0.2);
`;
const stylePDF    = `${btnBaseStyle} background-color: #007bff;`; 
const styleEditar = `${btnBaseStyle} background-color: #f0ad4e;`; 
const styleExcluir= `${btnBaseStyle} background-color: #d9534f;`; 

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    if (!token) { window.location.href = 'index.html'; return; }
    console.log("🚀 Dashboard carregado.");

    if(typeof carregarEstatisticas === 'function') carregarEstatisticas();
    carregarPropostas();
    carregarUsuarios();
    carregarApolices();
});

// Funções Auxiliares
function atualizarCard(id, valor) { const el = document.getElementById(id); if(el) el.innerText = valor; }
function carregarEstatisticas() {}

// 1. PROPOSTAS
async function carregarPropostas() {
    const tbody = document.getElementById('lista-propostas');
    if(!tbody) return;
    try {
        const res = await fetch(`${API_URL}/propostas`, { headers: { 'Authorization': `Bearer ${token}` } });
        const lista = await res.json();
        atualizarCard('total-clientes', lista.length);
        atualizarCard('total-veiculos', lista.length);
        tbody.innerHTML = '';
        if (lista.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;">Vazio.</td></tr>'; return; }
        
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

// 2. USUÁRIOS
async function carregarUsuarios() {
    const tbody = document.getElementById('lista-usuarios');
    if(!tbody) return;
    try {
        const res = await fetch(`${API_URL}/usuarios`, { headers: { 'Authorization': `Bearer ${token}` } });
        if(!res.ok) return;
        const lista = await res.json();
        atualizarCard('total-usuarios', lista.length);
        tbody.innerHTML = '';
        
        lista.forEach(u => {
            const tr = document.createElement('tr');
            const badge = u.tipo === 'admin' ? 'badge-admin' : 'badge-user';
            tr.innerHTML = `
                <td style="vertical-align: middle;">${u.id}</td>
                <td style="vertical-align: middle;">${u.nome}</td>
                <td style="vertical-align: middle;">${u.email}</td>
                <td style="vertical-align: middle;"><span class="badge ${badge}">${u.tipo.toUpperCase()}</span></td>
                <td style="vertical-align: middle; padding: 10px;">
                    <a href="registro.html?id=${u.id}&origin=dashboard" style="${styleEditar}">EDITAR</a>
                    <button type="button" onclick="prepararExclusao('usuarios', '${u.id}')" style="${styleExcluir}">EXCLUIR</button>
                </td>`;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

// 3. APÓLICES
async function carregarApolices() {
    const tbody = document.getElementById('lista-apolices');
    if(!tbody) return;
    try {
        const res = await fetch(`${API_URL}/apolices`, { headers: { 'Authorization': `Bearer ${token}` } });
        const lista = await res.json();
        atualizarCard('total-apolices', lista.length);
        tbody.innerHTML = '';
        if (lista.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;">Vazio.</td></tr>'; return; }

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

// 4. PDF
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
            alert("PDF não encontrado.");
        }
    } catch (e) { if(win) win.close(); alert("Erro ao baixar PDF."); }
}


// ==========================================
// 5. SISTEMA DE EXCLUSÃO (CORRIGIDO E GARANTIDO)
// ==========================================
let idParaExcluir = null;
let tipoParaExcluir = null;

// Função para INJETAR O HTML DO MODAL SE NÃO EXISTIR
function criarModalDinamicamente() {
    // Se já existe, não faz nada
    if (document.getElementById('modal-confirmacao')) return;

    const modalHTML = `
        <div id="modal-confirmacao" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:99999; justify-content:center; align-items:center;">
            <div style="background:white; padding:25px; border-radius:8px; width:320px; text-align:center; box-shadow:0 5px 15px rgba(0,0,0,0.3);">
                <h3 style="margin-top:0; color:#333; font-family:sans-serif;">Confirmação</h3>
                <p id="texto-modal" style="color:#666; font-family:sans-serif; margin:15px 0;">Tem certeza que deseja excluir?</p>
                <div style="display:flex; justify-content:center; gap:10px; margin-top:20px;">
                    <button onclick="fecharModal()" style="padding:10px 20px; border:none; background:#e0e0e0; cursor:pointer; border-radius:4px; font-weight:bold; color:#333;">Cancelar</button>
                    <button id="btn-confirmar-modal" style="padding:10px 20px; border:none; background:#d32f2f; color:white; font-weight:bold; cursor:pointer; border-radius:4px;">Sim, Excluir</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    console.log("[DEBUG] Modal criado dinamicamente no HTML.");
}

// Torna global para o HTML acessar
window.prepararExclusao = function(tipo, id) {
    console.log(`[DEBUG] Preparando exclusão: Tipo=${tipo}, ID=${id}`);
    
    // 1. Garante que o modal existe
    criarModalDinamicamente();

    idParaExcluir = id;
    tipoParaExcluir = tipo;
    
    const modal = document.getElementById('modal-confirmacao');
    const btnConfirm = document.getElementById('btn-confirmar-modal');
    
    if(modal && btnConfirm) {
        // Texto dinâmico
        const textoModal = document.getElementById('texto-modal');
        if(textoModal) textoModal.innerText = `Deseja excluir o item #${id}? Ação irreversível.`;

        // Atribui o clique
        btnConfirm.onclick = function() {
            console.log("[DEBUG] Botão SIM clicado.");
            executarExclusaoAPI();
        };

        // Mostra o modal (forçando Flex para garantir visibilidade)
        modal.style.display = 'flex';
    } else {
        // Fallback extremo
        if(confirm(`Confirmar exclusão do ${tipo} ID ${id}?`)) {
            executarExclusaoAPI();
        }
    }
}

async function executarExclusaoAPI() {
    console.log(`[DEBUG] Disparando DELETE para API...`);
    
    // Fecha visualmente
    const modal = document.getElementById('modal-confirmacao');
    if(modal) modal.style.display = 'none';

    try {
        if(typeof Swal !== 'undefined') Swal.fire({title: 'Excluindo...', didOpen: () => Swal.showLoading()});

        const res = await fetch(`${API_URL}/${tipoParaExcluir}/${idParaExcluir}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log(`[DEBUG] Resposta API Status: ${res.status}`);

        if (res.ok) {
            if(typeof Swal !== 'undefined') Swal.fire('Sucesso', 'Item excluído!', 'success');
            else alert('Excluído com sucesso.');
            
            // Recarrega a lista
            if(tipoParaExcluir === 'propostas') carregarPropostas();
            if(tipoParaExcluir === 'usuarios') carregarUsuarios();
            if(tipoParaExcluir === 'apolices') carregarApolices();
        } else {
            const err = await res.json();
            if(typeof Swal !== 'undefined') Swal.fire('Erro', err.message || 'Falha ao excluir.', 'error');
            else alert('Erro: ' + err.message);
        }
    } catch (error) {
        console.error("[DEBUG] Erro de Rede:", error);
        alert('Erro de conexão.');
    }
}

window.fecharModal = function() {
    const modal = document.getElementById('modal-confirmacao');
    if(modal) modal.style.display = 'none';
}

window.onclick = function(event) {
    const modal = document.getElementById('modal-confirmacao');
    if (event.target == modal) modal.style.display = "none";
}