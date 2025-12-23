// js/dashboard.js - VERSÃO FINAL (EDITAR VERDE / EXCLUIR VERMELHO)

// URL do Backend (Produção)
const API_URL = 'https://seguradoraproject.onrender.com';

const token = localStorage.getItem('token');

// ------------------------------------------------------------------
// ESTILO UNIFICADO DOS BOTÕES
// Define tamanho fixo (80px), fonte e formato para garantir simetria.
// ------------------------------------------------------------------
const btnStyle = `
    display: inline-block; 
    width: 80px; 
    padding: 8px 0; 
    font-size: 13px; 
    font-weight: bold; 
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    text-align: center; 
    border-radius: 4px; 
    border: none; 
    cursor: pointer; 
    text-decoration: none; 
    line-height: normal; 
    color: white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1); /* Sombra leve para dar destaque */
`;

document.addEventListener('DOMContentLoaded', () => {
    // Verifica Login
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    console.log("🚀 Dashboard iniciado. Conectando em:", API_URL);

    // Carrega dados
    if(typeof carregarEstatisticas === 'function') carregarEstatisticas();
    carregarPropostas();
    carregarUsuarios();
    carregarApolices();
});

// ==========================================
// 1. ATUALIZAR CARDS (ESTATÍSTICAS)
// ==========================================
function atualizarCard(idElemento, valor) {
    const el = document.getElementById(idElemento);
    if (el) el.innerText = valor;
}

function carregarEstatisticas() {
    // Espaço reservado para lógica futura de stats
}

// ==========================================
// 2. LISTAR PROPOSTAS (CLIENTES)
// ==========================================
async function carregarPropostas() {
    const tbody = document.getElementById('lista-propostas');
    if(!tbody) return;

    try {
        const res = await fetch(`${API_URL}/propostas`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error('Erro ao buscar propostas');
        
        const lista = await res.json();
        
        atualizarCard('total-clientes', lista.length);
        atualizarCard('total-veiculos', lista.length); 

        tbody.innerHTML = '';

        if (lista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">Nenhum cliente cadastrado.</td></tr>';
            return;
        }

        lista.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${p.id}</td>
                <td>${p.nome}</td>
                <td>${p.modelo}</td>
                <td><strong>${p.placa}</strong></td>
                <td style="text-align: center; white-space: nowrap;">
                    <a href="cadastro.html?id=${p.id}" 
                       style="${btnStyle} background-color: #2e7d32; margin-right: 5px;">
                       Editar
                    </a>
                    <button onclick="excluirItem('propostas', ${p.id})" 
                            style="${btnStyle} background-color: #d32f2f;">
                        Excluir
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error('Erro Propostas:', error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Erro ao carregar dados.</td></tr>';
    }
}

// ==========================================
// 3. LISTAR USUÁRIOS
// ==========================================
async function carregarUsuarios() {
    const tbody = document.getElementById('lista-usuarios');
    if(!tbody) return; 

    try {
        const res = await fetch(`${API_URL}/usuarios`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            if (res.status === 403) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red">Acesso restrito a Admins.</td></tr>';
                return;
            }
            throw new Error('Erro ao buscar usuários');
        }

        const lista = await res.json();
        atualizarCard('total-usuarios', lista.length);

        tbody.innerHTML = '';

        lista.forEach(u => {
            const tr = document.createElement('tr');
            
            const badgeClass = u.tipo === 'admin' ? 'badge-admin' : 'badge-user';
            const tipoLabel = u.tipo === 'admin' ? 'ADMIN' : u.tipo.toUpperCase();

            tr.innerHTML = `
                <td>${u.id}</td>
                <td>${u.nome}</td>
                <td>${u.email}</td>
                <td><span class="badge ${badgeClass}">${tipoLabel}</span></td>
                <td style="text-align: center; white-space: nowrap;">
                    <a href="registro.html?id=${u.id}&origin=dashboard" 
                       style="${btnStyle} background-color: #2e7d32; margin-right: 5px;">
                       Editar
                    </a>
                    <button onclick="excluirItem('usuarios', ${u.id})" 
                            style="${btnStyle} background-color: #d32f2f;">
                        Excluir
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error('Erro Usuários:', error);
    }
}

// ==========================================
// 4. LISTAR APÓLICES
// ==========================================
async function carregarApolices() {
    const tbody = document.getElementById('lista-apolices');
    if(!tbody) return;

    try {
        const res = await fetch(`${API_URL}/apolices`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Erro ao buscar apólices');

        const lista = await res.json();
        atualizarCard('total-apolices', lista.length);

        tbody.innerHTML = '';

        if (lista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">Nenhuma apólice emitida.</td></tr>';
            return;
        }

        lista.forEach(a => {
            const tr = document.createElement('tr');
            
            const premio = a.premio_total ? parseFloat(a.premio_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
            const vigencia = a.vigencia_fim ? new Date(a.vigencia_fim).toLocaleDateString('pt-BR') : '-';

            tr.innerHTML = `
                <td>${a.numero_apolice || 'S/N'}</td>
                <td>${a.cliente || 'Desconhecido'}</td>
                <td>${a.placa || '-'}</td>
                <td>${vigencia}</td>
                <td>${premio}</td>
                <td style="text-align: center; white-space: nowrap;">
                    <a href="apolice.html?id=${a.id}" 
                       style="${btnStyle} background-color: #2e7d32; margin-right: 5px;">
                       Editar
                    </a>
                    <button onclick="excluirItem('apolices', ${a.id})" 
                            style="${btnStyle} background-color: #d32f2f;">
                        Excluir
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error('Erro Apólices:', error);
    }
}

// ==========================================
// 5. FUNÇÃO DE EXCLUSÃO GENÉRICA
// ==========================================
let idParaExcluir = null;
let tipoParaExcluir = null;

function excluirItem(tipo, id) {
    idParaExcluir = id;
    tipoParaExcluir = tipo;
    
    // Tenta usar o modal se existir
    const modal = document.getElementById('modal-confirmacao');
    
    if(modal) {
        modal.style.display = 'flex';
        const btnConfirm = document.getElementById('btn-confirmar-modal');
        // Clona botão para limpar eventos anteriores
        const novoBtn = btnConfirm.cloneNode(true);
        btnConfirm.parentNode.replaceChild(novoBtn, btnConfirm);
        novoBtn.addEventListener('click', confirmarExclusao);
    } else {
        // Fallback simples
        if(confirm("Tem certeza que deseja excluir este item?")) {
            confirmarExclusao();
        }
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
            
            // Recarrega a lista correta
            if (tipoParaExcluir === 'propostas') carregarPropostas();
            if (tipoParaExcluir === 'usuarios') carregarUsuarios();
            if (tipoParaExcluir === 'apolices') carregarApolices();
            
            if(typeof Swal !== 'undefined') {
                Swal.fire('Sucesso', 'Item excluído.', 'success');
            } else {
                alert('Item excluído com sucesso.');
            }
        } else {
            if(typeof Swal !== 'undefined') {
                Swal.fire('Erro', 'Não foi possível excluir. Verifique permissões.', 'error');
            } else {
                alert('Erro ao excluir item.');
            }
        }
    } catch (error) {
        console.error("Erro exclusão:", error);
        alert('Erro de conexão.');
    }
}

function fecharModal() {
    const modal = document.getElementById('modal-confirmacao');
    if(modal) modal.style.display = 'none';
}

// Fecha modal ao clicar fora
window.onclick = function(event) {
    const modal = document.getElementById('modal-confirmacao');
    if (event.target == modal) {
        modal.style.display = "none";
    }
}