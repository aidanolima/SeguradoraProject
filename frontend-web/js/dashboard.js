// js/dashboard.js - VERSÃO FINAL (BOTÕES VERTICAIS + EXCLUSÃO FUNCIONANDO)

const API_URL = 'https://seguradoraproject.onrender.com';
const token = localStorage.getItem('token');

// ------------------------------------------------------------------
// ESTILOS DOS BOTÕES (PADRÃO VERTICAL)
// ------------------------------------------------------------------
const btnBaseStyle = `
    display: block;             
    width: 100px;               
    padding: 6px 0; 
    margin: 0 auto 5px auto;    
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
    text-transform: uppercase;
    box-shadow: 0 2px 3px rgba(0,0,0,0.2);
`;

const stylePDF    = `${btnBaseStyle} background-color: #007bff;`; // Azul
const styleEditar = `${btnBaseStyle} background-color: #f0ad4e;`; // Laranja
const styleExcluir= `${btnBaseStyle} background-color: #d9534f;`; // Vermelho

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    if (!token) { window.location.href = 'index.html'; return; }
    console.log("🚀 Dashboard iniciado.");

    if(typeof carregarEstatisticas === 'function') carregarEstatisticas();
    carregarPropostas();
    carregarUsuarios();
    carregarApolices();
});

// ==========================================
// 1. CARDS E ESTATÍSTICAS
// ==========================================
function atualizarCard(idElemento, valor) {
    const el = document.getElementById(idElemento);
    if (el) el.innerText = valor;
}
function carregarEstatisticas() {}

// ==========================================
// 2. LISTAGEM DE PROPOSTAS
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
        if (lista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Nenhum cliente cadastrado.</td></tr>'; return;
        }

        lista.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="vertical-align: middle;">${p.id}</td>
                <td style="vertical-align: middle;">${p.nome}</td>
                <td style="vertical-align: middle;">${p.modelo}</td>
                <td style="vertical-align: middle;"><strong>${p.placa}</strong></td>
                <td style="vertical-align: middle; padding: 10px;">
                    <a href="cadastro.html?id=${p.id}" style="${styleEditar}">EDITAR</a>
                    <button type="button" onclick="prepararExclusao('propostas', ${p.id})" style="${styleExcluir}">EXCLUIR</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) { console.error(error); }
}

// ==========================================
// 3. LISTAGEM DE USUÁRIOS
// ==========================================
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
                    <button type="button" onclick="prepararExclusao('usuarios', ${u.id})" style="${styleExcluir}">EXCLUIR</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) { console.error(error); }
}

// ==========================================
// 4. LISTAGEM DE APÓLICES
// ==========================================
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
            
            const temPdf = a.arquivo_pdf ? '' : 'opacity: 0.6; cursor: not-allowed; background-color: #6c757d;';
            const clickAction = a.arquivo_pdf ? `onclick="visualizarPDF(${a.id})"` : '';

            tr.innerHTML = `
                <td style="vertical-align: middle;">${a.numero_apolice || 'S/N'}</td>
                <td style="vertical-align: middle;">${a.cliente || 'Desconhecido'}</td>
                <td style="vertical-align: middle;">${a.placa || '-'}</td>
                <td style="vertical-align: middle;">${vigencia}</td>
                <td style="vertical-align: middle;">${premio}</td>
                <td style="vertical-align: middle; padding: 10px;">
                    <button type="button" ${clickAction} style="${stylePDF} ${temPdf}">PDF</button>
                    <a href="apolice.html?id=${a.id}" style="${styleEditar}">EDITAR</a>
                    <button type="button" onclick="prepararExclusao('apolices', ${a.id})" style="${styleExcluir}">EXCLUIR</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) { console.error(error); }
}

// ==========================================
// 5. PDF E SISTEMA DE EXCLUSÃO (CORRIGIDO)
// ==========================================

// Função do PDF
async function visualizarPDF(id) {
    const novaJanela = window.open('', '_blank');
    if(novaJanela) novaJanela.document.write('<h3>⏳ Buscando arquivo...</h3>');

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
            Swal.fire('Aviso', 'Nenhum PDF encontrado.', 'warning');
        }
    } catch (error) {
        if(novaJanela) novaJanela.close();
        Swal.fire('Erro', 'Erro ao baixar PDF.', 'error');
    }
}

// Variáveis Globais para Exclusão
let idParaExcluir = null;
let tipoParaExcluir = null;

// Função chamada pelo botão HTML
window.prepararExclusao = function(tipo, id) {
    console.log(`Tentando excluir: Tipo=${tipo}, ID=${id}`); // Debug no Console
    
    idParaExcluir = id;
    tipoParaExcluir = tipo;
    
    const modal = document.getElementById('modal-confirmacao');
    
    if(modal) {
        // Abre o Modal Customizado
        modal.style.display = 'flex';
        
        // Configura o botão "Sim, Excluir" do modal
        const btnConfirm = document.getElementById('btn-confirmar-modal');
        
        // Clona o botão para limpar eventos antigos (evita duplicação de clicks)
        const novoBtn = btnConfirm.cloneNode(true);
        btnConfirm.parentNode.replaceChild(novoBtn, btnConfirm);
        
        // Adiciona o evento de confirmar
        novoBtn.addEventListener('click', executarExclusaoAPI);
        
        // Configura o texto (opcional)
        const textoModal = document.getElementById('texto-modal');
        if(textoModal) textoModal.innerText = `Tem certeza que deseja excluir o item #${id}?`;

    } else {
        // Fallback: Se o modal HTML não existir, usa o nativo do navegador
        if(confirm(`Tem certeza que deseja excluir o item #${id}?`)) {
            executarExclusaoAPI();
        }
    }
}

// Função que chama a API
async function executarExclusaoAPI() {
    if(!idParaExcluir || !tipoParaExcluir) return;

    try {
        // Fecha o modal visualmente antes de terminar
        fecharModal();
        
        // Loading...
        Swal.fire({title: 'Excluindo...', didOpen: () => Swal.showLoading()});

        const res = await fetch(`${API_URL}/${tipoParaExcluir}/${idParaExcluir}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            Swal.fire('Sucesso', 'Item excluído com sucesso.', 'success');
            
            // Recarrega a lista correta
            if (tipoParaExcluir === 'propostas') carregarPropostas();
            if (tipoParaExcluir === 'usuarios') carregarUsuarios();
            if (tipoParaExcluir === 'apolices') carregarApolices();
        } else {
            const err = await res.json();
            Swal.fire('Erro', err.message || 'Erro ao excluir.', 'error');
        }
    } catch (error) {
        console.error("Erro exclusão:", error);
        Swal.fire('Erro', 'Falha de conexão com o servidor.', 'error');
    }
}

// Função para fechar modal (usada pelo botão Cancelar e pelo Overlay)
window.fecharModal = function() {
    const modal = document.getElementById('modal-confirmacao');
    if(modal) modal.style.display = 'none';
}

// Fecha ao clicar fora do modal
window.onclick = function(event) {
    const modal = document.getElementById('modal-confirmacao');
    if (event.target == modal) {
        modal.style.display = "none";
    }
}