// js/dashboard.js - VERSÃO COM PDF FUNCIONAL

const API_URL = 'https://seguradoraproject.onrender.com';
const token = localStorage.getItem('token');

// Estilo dos botões
const btnStyle = `
    display: inline-block; width: 80px; padding: 8px 0; font-size: 13px; font-weight: bold; 
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    text-align: center; border-radius: 4px; border: none; cursor: pointer; 
    text-decoration: none; line-height: normal; color: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
`;

document.addEventListener('DOMContentLoaded', () => {
    if (!token) { window.location.href = 'index.html'; return; }
    console.log("🚀 Dashboard iniciado. Conectando em:", API_URL);

    if(typeof carregarEstatisticas === 'function') carregarEstatisticas();
    carregarPropostas();
    carregarUsuarios();
    carregarApolices();
});

// 1. CARDS
function atualizarCard(idElemento, valor) {
    const el = document.getElementById(idElemento);
    if (el) el.innerText = valor;
}
function carregarEstatisticas() {}

// 2. PROPOSTAS
async function carregarPropostas() {
    const tbody = document.getElementById('lista-propostas');
    if(!tbody) return;
    try {
        const res = await fetch(`${API_URL}/propostas`, { headers: { 'Authorization': `Bearer ${token}` } });
        const lista = await res.json();
        atualizarCard('total-clientes', lista.length);
        atualizarCard('total-veiculos', lista.length); 
        tbody.innerHTML = '';
        if (lista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Nenhum registro.</td></tr>'; return;
        }
        lista.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${p.id}</td><td>${p.nome}</td><td>${p.modelo}</td><td><strong>${p.placa}</strong></td>
                <td style="text-align: center; white-space: nowrap;">
                    <a href="cadastro.html?id=${p.id}" style="${btnStyle} background-color: #2e7d32; margin-right: 5px;">Editar</a>
                    <button onclick="excluirItem('propostas', ${p.id})" style="${btnStyle} background-color: #d32f2f;">Excluir</button>
                </td>`;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

// 3. USUÁRIOS
async function carregarUsuarios() {
    const tbody = document.getElementById('lista-usuarios');
    if(!tbody) return; 
    try {
        const res = await fetch(`${API_URL}/usuarios`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) { if (res.status === 403) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:red">Acesso restrito.</td></tr>'; return; }
        const lista = await res.json();
        atualizarCard('total-usuarios', lista.length);
        tbody.innerHTML = '';
        lista.forEach(u => {
            const tr = document.createElement('tr');
            const badge = u.tipo === 'admin' ? 'badge-admin' : 'badge-user';
            tr.innerHTML = `
                <td>${u.id}</td><td>${u.nome}</td><td>${u.email}</td>
                <td><span class="badge ${badge}">${u.tipo.toUpperCase()}</span></td>
                <td style="text-align: center; white-space: nowrap;">
                    <a href="registro.html?id=${u.id}&origin=dashboard" style="${btnStyle} background-color: #2e7d32; margin-right: 5px;">Editar</a>
                    <button onclick="excluirItem('usuarios', ${u.id})" style="${btnStyle} background-color: #d32f2f;">Excluir</button>
                </td>`;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

// 4. APÓLICES (COM LÓGICA DE PDF CORRIGIDA)
async function carregarApolices() {
    const tbody = document.getElementById('lista-apolices');
    if(!tbody) return;
    try {
        const res = await fetch(`${API_URL}/apolices`, { headers: { 'Authorization': `Bearer ${token}` } });
        const lista = await res.json();
        atualizarCard('total-apolices', lista.length);
        tbody.innerHTML = '';
        if (lista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">Nenhuma apólice.</td></tr>'; return;
        }
        lista.forEach(a => {
            const tr = document.createElement('tr');
            const premio = a.premio_total ? parseFloat(a.premio_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
            const vigencia = a.vigencia_fim ? new Date(a.vigencia_fim).toLocaleDateString('pt-BR') : '-';

            // Verifica se existe arquivo vinculado para habilitar/desabilitar botão
            const temPdf = a.arquivo_pdf ? '' : 'opacity: 0.5; cursor: not-allowed;';
            const clickAction = a.arquivo_pdf ? `onclick="visualizarPDF(${a.id})"` : '';

            tr.innerHTML = `
                <td>${a.numero_apolice || 'S/N'}</td>
                <td>${a.cliente || 'Desconhecido'}</td>
                <td>${a.placa || '-'}</td>
                <td>${vigencia}</td>
                <td>${premio}</td>
                <td style="text-align: center; white-space: nowrap;">
                    <button ${clickAction} style="${btnStyle} background-color: #1976d2; margin-right: 5px; ${temPdf}">PDF</button>
                    <a href="apolice.html?id=${a.id}" style="${btnStyle} background-color: #2e7d32; margin-right: 5px;">Editar</a>
                    <button onclick="excluirItem('apolices', ${a.id})" style="${btnStyle} background-color: #d32f2f;">Excluir</button>
                </td>`;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

// ==========================================
// 5. FUNÇÃO PARA ABRIR PDF (NOVA JANELA)
// ==========================================
async function visualizarPDF(id) {
    // Abre uma janela em branco imediatamente para evitar bloqueio de popup
    // e mostra uma mensagem de "Carregando..."
    const novaJanela = window.open('', '_blank');
    if(novaJanela) {
        novaJanela.document.write('<html><head><title>Carregando PDF</title></head><body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#f0f0f0;font-family:sans-serif;"><h3>🔍 Buscando arquivo no servidor... aguarde.</h3></body></html>');
    }

    try {
        // Busca o arquivo no servidor enviando o TOKEN
        const res = await fetch(`${API_URL}/apolices/${id}/pdf`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            // Transforma a resposta em um arquivo (Blob)
            const blob = await res.blob();
            // Cria um link temporário para esse arquivo
            const urlArquivo = window.URL.createObjectURL(blob);
            
            // Redireciona a janela que abrimos para o PDF
            if(novaJanela) {
                novaJanela.location.href = urlArquivo;
            } else {
                window.open(urlArquivo, '_blank');
            }
        } else {
            if(novaJanela) novaJanela.close();
            Swal.fire('Erro', 'Arquivo PDF não encontrado para esta apólice.', 'error');
        }
    } catch (error) {
        if(novaJanela) novaJanela.close();
        console.error(error);
        Swal.fire('Erro', 'Falha ao baixar o PDF. Verifique sua conexão.', 'error');
    }
}

// 6. EXCLUSÃO
let idEx = null; let tipoEx = null;
function excluirItem(t, i) { idEx = i; tipoEx = t; const m = document.getElementById('modal-confirmacao'); if(m){ m.style.display='flex'; const b = document.getElementById('btn-confirmar-modal'); const n = b.cloneNode(true); b.parentNode.replaceChild(n, b); n.addEventListener('click', confirmarExclusao); } else { if(confirm("Excluir item?")) confirmarExclusao(); } }
async function confirmarExclusao() { if(!idEx)return; try { const r = await fetch(`${API_URL}/${tipoEx}/${idEx}`, {method:'DELETE', headers:{'Authorization':`Bearer ${token}`}}); if(r.ok){ document.getElementById('modal-confirmacao').style.display='none'; if(tipoEx==='propostas')carregarPropostas(); if(tipoEx==='usuarios')carregarUsuarios(); if(tipoEx==='apolices')carregarApolices(); Swal.fire('Sucesso','Item excluído.','success'); } else { Swal.fire('Erro','Erro ao excluir.','error'); } } catch(e){ Swal.fire('Erro','Conexão.','error'); } }
function fecharModal(){ document.getElementById('modal-confirmacao').style.display='none'; }
window.onclick = function(e) { const m = document.getElementById('modal-confirmacao'); if(e.target==m) m.style.display="none"; }