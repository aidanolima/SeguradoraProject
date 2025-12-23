// js/dashboard.js - VERSÃO FINAL (LAYOUT VERTICAL - PADRÃO LOCAL)

const API_URL = 'https://seguradoraproject.onrender.com';
const token = localStorage.getItem('token');

// ------------------------------------------------------------------
// ESTILOS DOS BOTÕES (BASE + CORES)
// Configurados para ficarem um abaixo do outro (display: block)
// ------------------------------------------------------------------
const btnBaseStyle = `
    display: block;             /* Força um por linha */
    width: 100px;               /* Largura fixa padrão */
    padding: 6px 0; 
    margin: 0 auto 5px auto;    /* Centraliza e dá espaço inferior */
    font-size: 11px; 
    font-weight: bold; 
    font-family: sans-serif;
    text-align: center; 
    border-radius: 4px; 
    border: none; 
    cursor: pointer; 
    text-decoration: none; 
    line-height: normal; 
    color: white;
    text-transform: uppercase;  /* Texto em MAIÚSCULO */
    box-shadow: 0 2px 3px rgba(0,0,0,0.2);
`;

// Cores Específicas conforme sua imagem
const stylePDF    = `${btnBaseStyle} background-color: #007bff;`; // Azul
const styleEditar = `${btnBaseStyle} background-color: #f0ad4e;`; // Laranja
const styleExcluir= `${btnBaseStyle} background-color: #d9534f;`; // Vermelho

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

// 2. PROPOSTAS (EDITAR + EXCLUIR)
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
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Nenhum cliente cadastrado.</td></tr>'; return;
        }

        lista.forEach(p => {
            const tr = document.createElement('tr');
            // Alinhamento vertical no meio (vertical-align: middle) para ficar bonito
            tr.innerHTML = `
                <td style="vertical-align: middle;">${p.id}</td>
                <td style="vertical-align: middle;">${p.nome}</td>
                <td style="vertical-align: middle;">${p.modelo}</td>
                <td style="vertical-align: middle;"><strong>${p.placa}</strong></td>
                <td style="vertical-align: middle; padding: 10px;">
                    <a href="cadastro.html?id=${p.id}" style="${styleEditar}">EDITAR</a>
                    <button onclick="excluirItem('propostas', ${p.id})" style="${styleExcluir}">EXCLUIR</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) { console.error(error); }
}

// 3. USUÁRIOS (EDITAR + EXCLUIR)
async function carregarUsuarios() {
    const tbody = document.getElementById('lista-usuarios');
    if(!tbody) return; 

    try {
        const res = await fetch(`${API_URL}/usuarios`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) { 
            if (res.status === 403) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red">Acesso restrito.</td></tr>'; 
            return; 
        }
        const lista = await res.json();
        atualizarCard('total-usuarios', lista.length);

        tbody.innerHTML = '';
        lista.forEach(u => {
            const tr = document.createElement('tr');
            const badgeClass = u.tipo === 'admin' ? 'badge-admin' : 'badge-user';
            
            tr.innerHTML = `
                <td style="vertical-align: middle;">${u.id}</td>
                <td style="vertical-align: middle;">${u.nome}</td>
                <td style="vertical-align: middle;">${u.email}</td>
                <td style="vertical-align: middle;"><span class="badge ${badgeClass}">${u.tipo.toUpperCase()}</span></td>
                <td style="vertical-align: middle; padding: 10px;">
                    <a href="registro.html?id=${u.id}&origin=dashboard" style="${styleEditar}">EDITAR</a>
                    <button onclick="excluirItem('usuarios', ${u.id})" style="${styleExcluir}">EXCLUIR</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) { console.error(error); }
}

// 4. APÓLICES (PDF + EDITAR + EXCLUIR)
async function carregarApolices() {
    const tbody = document.getElementById('lista-apolices');
    if(!tbody) return;

    try {
        const res = await fetch(`${API_URL}/apolices`, { headers: { 'Authorization': `Bearer ${token}` } });
        const lista = await res.json();
        atualizarCard('total-apolices', lista.length);

        tbody.innerHTML = '';
        if (lista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">Nenhuma apólice emitida.</td></tr>'; return;
        }

        lista.forEach(a => {
            const tr = document.createElement('tr');
            const premio = a.premio_total ? parseFloat(a.premio_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
            const vigencia = a.vigencia_fim ? new Date(a.vigencia_fim).toLocaleDateString('pt-BR') : '-';
            
            // Controle do botão PDF
            const temPdf = a.arquivo_pdf ? '' : 'opacity: 0.6; cursor: not-allowed; background-color: #6c757d;';
            const clickAction = a.arquivo_pdf ? `onclick="visualizarPDF(${a.id})"` : '';

            tr.innerHTML = `
                <td style="vertical-align: middle;">${a.numero_apolice || 'S/N'}</td>
                <td style="vertical-align: middle;">${a.cliente || 'Desconhecido'}</td>
                <td style="vertical-align: middle;">${a.placa || '-'}</td>
                <td style="vertical-align: middle;">${vigencia}</td>
                <td style="vertical-align: middle;">${premio}</td>
                <td style="vertical-align: middle; padding: 10px;">
                    <button ${clickAction} style="${stylePDF} ${temPdf}">PDF</button>
                    <a href="apolice.html?id=${a.id}" style="${styleEditar}">EDITAR</a>
                    <button onclick="excluirItem('apolices', ${a.id})" style="${styleExcluir}">EXCLUIR</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) { console.error(error); }
}

// ==========================================
// 5. FUNÇÕES DO PDF E EXCLUSÃO
// ==========================================

async function visualizarPDF(id) {
    const novaJanela = window.open('', '_blank');
    if(novaJanela) {
        novaJanela.document.write('<html><head><title>Carregando PDF...</title></head><body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#f8f9fa;font-family:sans-serif;color:#333;"><h3>⏳ Buscando arquivo...</h3></body></html>');
    }

    try {
        const res = await fetch(`${API_URL}/apolices/${id}/pdf`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const blob = await res.blob();
            const urlArquivo = window.URL.createObjectURL(blob);
            if(novaJanela) novaJanela.location.href = urlArquivo;
            else window.open(urlArquivo, '_blank');
        } else {
            if(novaJanela) novaJanela.close();
            Swal.fire('Aviso', 'Nenhum PDF encontrado para esta apólice.', 'warning');
        }
    } catch (error) {
        if(novaJanela) novaJanela.close();
        Swal.fire('Erro', 'Falha ao conectar com o servidor.', 'error');
    }
}

let idParaExcluir = null;
let tipoParaExcluir = null;

function excluirItem(tipo, id) {
    idParaExcluir = id;
    tipoParaExcluir = tipo;
    
    const modal = document.getElementById('modal-confirmacao');
    if(modal) {
        modal.style.display = 'flex';
        const btnConfirm = document.getElementById('btn-confirmar-modal');
        const novoBtn = btnConfirm.cloneNode(true);
        btnConfirm.parentNode.replaceChild(novoBtn, btnConfirm);
        novoBtn.addEventListener('click', confirmarExclusao);
    } else {
        if(confirm("Confirma exclusão?")) confirmarExclusao();
    }
}

async function confirmarExclusao() {
    if(!idParaExcluir || !tipoParaExcluir) return;

    try {
        const res = await fetch(`${API_URL}/${tipoParaExcluir}/${idParaExcluir}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            fecharModal();
            if (tipoParaExcluir === 'propostas') carregarPropostas();
            if (tipoParaExcluir === 'usuarios') carregarUsuarios();
            if (tipoParaExcluir === 'apolices') carregarApolices();
            
            if(typeof Swal !== 'undefined') Swal.fire('Sucesso', 'Item excluído.', 'success');
            else alert('Excluído com sucesso.');
        } else {
            Swal.fire('Erro', 'Erro ao excluir.', 'error');
        }
    } catch (error) {
        console.error(error);
        Swal.fire('Erro', 'Erro de conexão.', 'error');
    }
}

function fecharModal() {
    const modal = document.getElementById('modal-confirmacao');
    if(modal) modal.style.display = 'none';
}

window.onclick = function(event) {
    const modal = document.getElementById('modal-confirmacao');
    if (event.target == modal) {
        modal.style.display = "none";
    }
}