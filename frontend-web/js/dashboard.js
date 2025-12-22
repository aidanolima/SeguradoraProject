// js/dashboard.js - VERSÃO FINAL PARA NUVEM

// ⚠️ ATENÇÃO: Se estiver rodando local, mude para http://localhost:3000
// Se estiver no Netlify, use a URL do Render:
const API_URL = 'https://seguradoraproject.onrender.com';

const token = localStorage.getItem('token');

document.addEventListener('DOMContentLoaded', () => {
    // Verifica se está logado
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    console.log("🚀 Dashboard iniciado. Conectando em:", API_URL);

    // Carrega todas as tabelas e contadores
    carregarEstatisticas();
    carregarPropostas();
    carregarUsuarios();
    carregarApolices();
});

// ==========================================
// 1. CARREGAR ESTATÍSTICAS (CARDS)
// ==========================================
function atualizarCard(idElemento, valor) {
    const el = document.getElementById(idElemento);
    if (el) el.innerText = valor;
}

function carregarEstatisticas() {
    // Como não temos uma rota só de stats, vamos deduzir das listas (ou criar rota futura)
    // Por enquanto, as funções de carregar listas vão atualizar os cards
}

// ==========================================
// 2. LISTAR PROPOSTAS (CLIENTES)
// ==========================================
async function carregarPropostas() {
    try {
        const res = await fetch(`${API_URL}/propostas`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error('Erro ao buscar propostas');
        
        const lista = await res.json();
        
        // Atualiza Card
        atualizarCard('total-clientes', lista.length);
        atualizarCard('total-veiculos', lista.length); // Assumindo 1 veículo por cliente

        // Preenche Tabela
        const tbody = document.getElementById('lista-propostas');
        if(!tbody) return;

        tbody.innerHTML = ''; // Limpa

        if (lista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Nenhum cliente cadastrado.</td></tr>';
            return;
        }

        lista.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${p.id}</td>
                <td>${p.nome}</td>
                <td>${p.modelo}</td>
                <td><strong>${p.placa}</strong></td>
                <td>
                    <a href="cadastro.html?id=${p.id}" class="btn-editar">Editar</a>
                    <button onclick="excluirItem('propostas', ${p.id})" class="btn-excluir">Excluir</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error('Erro Propostas:', error);
    }
}

// ==========================================
// 3. LISTAR USUÁRIOS (BOTÕES SIMÉTRICOS)
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
        // Atualiza contador
        if (typeof atualizarCard === "function") atualizarCard('total-usuarios', lista.length);

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
                       class="btn-editar"
                       style="display: inline-block; width: 80px; padding: 6px 0; margin-right: 5px; text-decoration: none; font-size: 13px; text-align: center;">
                       Editar
                    </a>

                    <button onclick="excluirItem('usuarios', ${u.id})" 
                            class="btn-excluir" 
                            style="display: inline-block; width: 80px; padding: 6px 0; font-size: 13px; text-align: center; border: none; cursor: pointer;">
                        Excluir
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error('Erro Usuários:', error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Erro ao carregar usuários.</td></tr>';
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
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Nenhuma apólice emitida.</td></tr>';
            return;
        }

        lista.forEach(a => {
            const tr = document.createElement('tr');
            // Formata moeda
            const premio = parseFloat(a.premio_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            // Formata data
            const vigencia = a.vigencia_fim ? new Date(a.vigencia_fim).toLocaleDateString('pt-BR') : '-';

            tr.innerHTML = `
                <td>${a.numero_apolice || 'S/N'}</td>
                <td>${a.cliente || 'Desconhecido'}</td>
                <td>${a.placa || '-'}</td>
                <td>${vigencia}</td>
                <td>${premio}</td>
                <td>
                    <a href="apolice.html?id=${a.id}" class="btn-editar">Editar</a>
                    <button onclick="excluirItem('apolices', ${a.id})" class="btn-excluir">Excluir</button>
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
    
    // Abre o Modal (Função definida no modal.js ou inline no HTML)
    const modal = document.getElementById('modal-confirmacao');
    if(modal) {
        modal.style.display = 'flex';
        // Adiciona evento ao botão de confirmar do modal
        const btnConfirm = document.getElementById('btn-confirmar-modal');
        // Clona o botão para remover listeners antigos e evitar duplicação
        const novoBtn = btnConfirm.cloneNode(true);
        btnConfirm.parentNode.replaceChild(novoBtn, btnConfirm);
        
        novoBtn.addEventListener('click', confirmarExclusao);
    } else {
        // Fallback se não tiver modal
        if(confirm("Tem certeza que deseja excluir?")) {
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
        } else {
            alert("Erro ao excluir. Verifique permissões.");
        }
    } catch (error) {
        console.error("Erro exclusão:", error);
    }
}

function fecharModal() {
    const modal = document.getElementById('modal-confirmacao');
    if(modal) modal.style.display = 'none';
}