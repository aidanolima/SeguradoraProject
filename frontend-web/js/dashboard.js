// js/dashboard.js - VERSÃO "FORÇA BRUTA" (CORREÇÃO DE MODAL)

const API_URL = 'https://seguradoraproject.onrender.com';
const token = localStorage.getItem('token');

// Estilos dos Botões
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

    // Remove qualquer modal antigo que possa estar no HTML atrapalhando
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
// 5. SISTEMA DE EXCLUSÃO (LIMPEZA TOTAL)
// ==========================================
let idParaExcluir = null;
let tipoParaExcluir = null;

// Função para CRIAR o Modal DO ZERO
function garantirModalExiste() {
    // 1. Remove qualquer modal existente para evitar conflitos de ID ou clones quebrados
    const antigo = document.getElementById('modal-confirmacao');
    if (antigo) antigo.remove();

    // 2. Cria o HTML novo
    const modalHTML = `
        <div id="modal-confirmacao" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:999999; justify-content:center; align-items:center;">
            <div style="background:white; padding:30px; border-radius:8px; width:300px; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
                <h3 style="margin-top:0; color:#333; font-family:sans-serif;">Confirmação</h3>
                <p id="texto-modal" style="color:#555; font-family:sans-serif; margin:20px 0; font-size:14px;">Tem certeza que deseja excluir?</p>
                <div style="display:flex; justify-content:center; gap:15px;">
                    <button onclick="fecharModal()" style="padding:10px 20px; border:none; background:#ccc; cursor:pointer; border-radius:4px; font-weight:bold; color:#333;">Cancelar</button>
                    <button id="btn-confirmar-modal" style="padding:10px 20px; border:none; background:#d32f2f; color:white; font-weight:bold; cursor:pointer; border-radius:4px;">EXCLUIR AGORA</button>
                </div>
            </div>
        </div>
    `;
    
    // 3. Insere no final do corpo da página
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Função chamada pelo botão da tabela
window.prepararExclusao = function(tipo, id) {
    console.log(`[DEBUG] Botão clicado: ${tipo} #${id}`);
    
    idParaExcluir = id;
    tipoParaExcluir = tipo;
    
    // Recria o modal limpo
    garantirModalExiste();

    const modal = document.getElementById('modal-confirmacao');
    const btnSim = document.getElementById('btn-confirmar-modal');
    const texto = document.getElementById('texto-modal');

    // Atualiza texto e evento
    texto.innerText = `Você vai apagar o item #${id} (${tipo.toUpperCase()}). Confirmar?`;
    
    btnSim.onclick = function() {
        console.log("[DEBUG] Usuário confirmou exclusão.");
        executarExclusaoAPI();
    };

    // Força a exibição
    modal.style.display = 'flex';
}

async function executarExclusaoAPI() {
    // Fecha modal
    fecharModal();

    console.log(`[DEBUG] Enviando DELETE...`);

    try {
        // Feedback visual simples
        if(typeof Swal !== 'undefined') Swal.fire({title: 'Processando...', didOpen: () => Swal.showLoading()});

        const res = await fetch(`${API_URL}/${tipoParaExcluir}/${idParaExcluir}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            console.log("[DEBUG] Sucesso na exclusão.");
            if(typeof Swal !== 'undefined') Swal.fire('Sucesso', 'Item excluído!', 'success');
            else alert('Item excluído com sucesso!');
            
            // Atualiza tabelas
            if(tipoParaExcluir === 'propostas') carregarPropostas();
            if(tipoParaExcluir === 'usuarios') carregarUsuarios();
            if(tipoParaExcluir === 'apolices') carregarApolices();
        } else {
            console.error("[DEBUG] Erro API:", res.status);
            alert('Erro ao excluir. Verifique se existem vínculos (ex: apólices).');
        }
    } catch (error) {
        console.error("[DEBUG] Erro Rede:", error);
        alert('Erro de conexão.');
    }
}

window.fecharModal = function() {
    const modal = document.getElementById('modal-confirmacao');
    if (modal) modal.remove(); // Remove o modal do DOM para limpar tudo
}