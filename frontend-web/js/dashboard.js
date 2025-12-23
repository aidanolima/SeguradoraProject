// js/dashboard.js - VERSÃO COM EXCLUSÃO CORRIGIDA

const API_URL = 'https://seguradoraproject.onrender.com';
const token = localStorage.getItem('token');

// Estilos dos Botões (Padrão Vertical)
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
    console.log("🚀 Dashboard carregado. Token OK.");

    if(typeof carregarEstatisticas === 'function') carregarEstatisticas();
    carregarPropostas();
    carregarUsuarios();
    carregarApolices();
});

// Funções de Apoio
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
            // ATENÇÃO: Adicionei aspas simples em '${p.id}' para evitar erros de sintaxe no clique
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
        if(!res.ok && res.status===403) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:red">Restrito.</td></tr>'; return; }
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

// 5. SISTEMA DE EXCLUSÃO (GLOBAL E ROBUSTO)
let idParaExcluir = null;
let tipoParaExcluir = null;

// Anexa ao window para garantir visibilidade global no onclick do HTML
window.prepararExclusao = function(tipo, id) {
    console.log(`Botão Excluir clicado! Tipo: ${tipo}, ID: ${id}`); // Debug
    
    idParaExcluir = id;
    tipoParaExcluir = tipo;
    
    const modal = document.getElementById('modal-confirmacao');
    
    // Se o modal existir no HTML, usa ele
    if(modal) {
        modal.style.display = 'flex';
        const btnConfirm = document.getElementById('btn-confirmar-modal');
        const novoBtn = btnConfirm.cloneNode(true); // Remove listeners antigos
        btnConfirm.parentNode.replaceChild(novoBtn, btnConfirm);
        novoBtn.addEventListener('click', executarExclusaoAPI);
    } 
    // Se não existir modal, usa o confirm nativo (Fallback de segurança)
    else {
        if(confirm(`Tem certeza que deseja excluir o item ${id}? Essa ação não pode ser desfeita.`)) {
            executarExclusaoAPI();
        }
    }
}

async function executarExclusaoAPI() {
    if(!idParaExcluir || !tipoParaExcluir) return;
    
    // Fecha modal
    const modal = document.getElementById('modal-confirmacao');
    if(modal) modal.style.display = 'none';

    try {
        // Envia comando para o servidor apagar no banco
        const res = await fetch(`${API_URL}/${tipoParaExcluir}/${idParaExcluir}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            // Se o servidor confirmou que apagou
            if(typeof Swal !== 'undefined') Swal.fire('Sucesso', 'Item excluído do banco de dados.', 'success');
            else alert('Excluído com sucesso.');
            
            // Atualiza a tela
            if(tipoParaExcluir === 'propostas') carregarPropostas();
            if(tipoParaExcluir === 'usuarios') carregarUsuarios();
            if(tipoParaExcluir === 'apolices') carregarApolices();
        } else {
            const err = await res.json();
            alert('Erro: ' + (err.message || 'Falha ao excluir.'));
        }
    } catch (error) {
        console.error("Erro API:", error);
        alert('Erro de conexão com o banco de dados.');
    }
}

window.fecharModal = function() {
    const modal = document.getElementById('modal-confirmacao');
    if(modal) modal.style.display = 'none';
}