// ==================================================
// 1. CONFIGURAÇÕES GLOBAIS E ESTADO
// ==================================================
const API_BASE_URL = (typeof API_URL !== 'undefined') ? API_URL : 'https://seguradoraproject.onrender.com';
const ITENS_POR_PAGINA = 5; 

const estadoGlobal = {
    apolices: { todos: [], filtrados: [], paginaAtual: 1 },
    clientes: { todos: [], filtrados: [], paginaAtual: 1 },
    usuarios: { todos: [], filtrados: [], paginaAtual: 1 }
};

let chartStatus = null;
let chartVendas = null;

// ==================================================
// 2. INICIALIZAÇÃO
// ==================================================
document.addEventListener('DOMContentLoaded', () => {
    verificarLogin();
    carregarResumoCards();
    
    // Inicializa dados e gráficos em sequência para garantir sincronia
    inicializarDados();

    configurarBusca('busca-apolices', 'apolices');
    configurarBusca('busca-clientes', 'clientes');
    configurarBusca('busca-usuarios', 'usuarios');
});

async function inicializarDados() {
    await Promise.all([
        buscarDadosApolices(),
        buscarDadosClientes(),
        buscarDadosUsuarios()
    ]);
    // Só monta o gráfico após ter certeza que os dados das apólices chegaram
    carregarGraficos();
}

function configurarBusca(inputId, tipo) {
    const input = document.getElementById(inputId);
    if(input) {
        input.addEventListener('input', (e) => {
            const termo = e.target.value.toLowerCase();
            estadoGlobal[tipo].filtrados = estadoGlobal[tipo].todos.filter(item => {
                return JSON.stringify(item).toLowerCase().includes(termo);
            });
            estadoGlobal[tipo].paginaAtual = 1;
            renderizarTabela(tipo);
        });
    }
}

function verificarLogin() {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = 'index.html'; return; }
    
    const nome = localStorage.getItem('usuario_logado');
    const tipo = localStorage.getItem('tipo_usuario');
    
    if (document.getElementById('user-name-display') && nome) document.getElementById('user-name-display').innerText = nome.split(' ')[0];
    if (document.getElementById('user-role-display') && tipo) document.getElementById('user-role-display').innerText = tipo.toUpperCase();

    if (tipo !== 'admin') {
        const cardAdmin = document.getElementById('card-admin-stat');
        if(cardAdmin) cardAdmin.style.display = 'none';
        const secaoUsers = document.getElementById('secao-usuarios');
        if(secaoUsers) secaoUsers.style.display = 'none'; 
    } else {
        const cardAdmin = document.getElementById('card-admin-stat');
        if(cardAdmin) cardAdmin.style.display = 'flex';
        const secaoUsers = document.getElementById('secao-usuarios');
        if(secaoUsers) secaoUsers.style.display = 'block'; 
    }

    const btnLogout = document.getElementById('btn-logout');
    if(btnLogout) btnLogout.addEventListener('click', () => { localStorage.clear(); window.location.href = 'index.html'; });
}

// ==================================================
// 3. CARREGAMENTO DE DADOS E GRÁFICOS
// ==================================================

async function carregarResumoCards() {
    try {
        const res = await fetch(`${API_BASE_URL}/dashboard-resumo`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
        const data = await res.json();
        atualizarCard('total-apolices', data.apolices);
        atualizarCard('total-usuarios', data.usuarios);
        atualizarCard('total-veiculos', data.veiculos);
        atualizarCard('total-clientes', data.clientes);

        const resCom = await fetch(`${API_BASE_URL}/dashboard/comissoes`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
        const dataCom = await resCom.json();
        const elCom = document.getElementById('total-comissoes');
        if(elCom) elCom.innerText = parseFloat(dataCom.totalComissoes || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
    } catch (error) { console.error("Erro cards:", error); }
}

function atualizarCard(id, valor) {
    const el = document.getElementById(id);
    if (el) el.innerText = valor || 0;
}

// --- CÁLCULO DE STATUS CORRIGIDO ---
function calcularStatusLocalmente() {
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    
    let vigentes = 0;
    let aVencer = 0;
    let vencidas = 0;

    estadoGlobal.apolices.todos.forEach(a => {
        let diffDays = -999; // Valor padrão negativo (Vencida) caso a data seja nula/inválida

        // Se tiver data, calcula a diferença real
        if (a.vigencia_fim) {
            let dFim = new Date(a.vigencia_fim);
            
            // Correção de fuso horário para string YYYY-MM-DD
            if(a.vigencia_fim.includes('-') && a.vigencia_fim.length === 10) {
                const parts = a.vigencia_fim.split('-');
                // Ano, Mês (0-11), Dia
                dFim = new Date(parts[0], parts[1]-1, parts[2]);
            }
            
            const diffTime = dFim - hoje;
            diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        } 
        // Se não tiver data (null), diffDays continua -999 (Vencida), igual na tabela.

        if (diffDays < 0) {
            vencidas++;
        } else if (diffDays >= 0 && diffDays <= 30) {
            aVencer++;
        } else {
            vigentes++;
        }
    });

    return [vigentes, aVencer, vencidas];
}

async function carregarGraficos() {
    try {
        const res = await fetch(`${API_BASE_URL}/dashboard-graficos`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
        const dadosBackend = await res.json();

        // Usa o cálculo local corrigido
        const dadosStatusReais = calcularStatusLocalmente();
        
        const ctxStatus = document.getElementById('graficoStatus');
        if(ctxStatus) {
            const ctx = ctxStatus.getContext('2d');
            if (chartStatus) chartStatus.destroy();
            
            chartStatus = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Vigentes', 'A Vencer (30d)', 'Vencidas'],
                    datasets: [{ 
                        data: dadosStatusReais, 
                        backgroundColor: ['#00a86b', '#ff9800', '#d32f2f'], // Verde, Laranja, Vermelho
                        borderWidth: 1 
                    }]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'top' } }
                }
            });
        }

        const ctxVendas = document.getElementById('graficoVendas');
        if(ctxVendas) {
            const ctx = ctxVendas.getContext('2d');
            if (chartVendas) chartVendas.destroy();
            chartVendas = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: dadosBackend.vendas.labels,
                    datasets: [{ label: 'Vendas (R$)', data: dadosBackend.vendas.valores, backgroundColor: '#1976d2', borderRadius: 4 }]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
            });
        }
    } catch (error) { console.error("Erro gráficos:", error); }
}

// ==================================================
// 4. FETCH DE TABELAS
// ==================================================

async function buscarDadosApolices() {
    try {
        const res = await fetch(`${API_BASE_URL}/apolices`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
        const dados = await res.json();
        estadoGlobal.apolices.todos = dados;
        estadoGlobal.apolices.filtrados = dados;
        renderizarTabela('apolices');
        return dados;
    } catch (error) {
        console.error(error);
        document.getElementById('lista-apolices').innerHTML = '<tr><td colspan="7" style="text-align:center; color:red">Erro ao carregar.</td></tr>';
        return [];
    }
}

async function buscarDadosClientes() {
    try {
        const res = await fetch(`${API_BASE_URL}/propostas`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
        const dados = await res.json();
        estadoGlobal.clientes.todos = dados;
        estadoGlobal.clientes.filtrados = dados;
        renderizarTabela('clientes');
        return dados;
    } catch (error) {
        console.error(error);
        return [];
    }
}

async function buscarDadosUsuarios() {
    const tipo = localStorage.getItem('tipo_usuario');
    if(tipo !== 'admin') return [];

    try {
        const res = await fetch(`${API_BASE_URL}/usuarios`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
        const dados = await res.json();
        estadoGlobal.usuarios.todos = dados;
        estadoGlobal.usuarios.filtrados = dados;
        renderizarTabela('usuarios');
        return dados;
    } catch (error) {
        console.error(error);
        return [];
    }
}

// ==================================================
// 5. RENDERIZAÇÃO DE TABELAS
// ==================================================

function renderizarTabela(tipo) {
    const estado = estadoGlobal[tipo];
    const tbody = document.getElementById(`lista-${tipo}`);
    const containerPaginacao = document.getElementById(`paginacao-${tipo}`);
    
    if(!tbody) return;

    const totalItens = estado.filtrados.length;
    const totalPaginas = Math.ceil(totalItens / ITENS_POR_PAGINA);
    
    if (estado.paginaAtual > totalPaginas && totalPaginas > 0) estado.paginaAtual = totalPaginas;
    if (estado.paginaAtual < 1) estado.paginaAtual = 1;

    const inicio = (estado.paginaAtual - 1) * ITENS_POR_PAGINA;
    const fim = inicio + ITENS_POR_PAGINA;
    const itensPagina = estado.filtrados.slice(inicio, fim);

    tbody.innerHTML = '';

    if (totalItens === 0) {
        const cols = tipo === 'apolices' ? 7 : (tipo === 'clientes' ? 5 : 4);
        tbody.innerHTML = `<tr><td colspan="${cols}" style="text-align:center; padding: 20px;">Nenhum registro encontrado.</td></tr>`;
        if(containerPaginacao) containerPaginacao.innerHTML = '';
        return;
    }

    itensPagina.forEach(item => {
        if(tipo === 'apolices') renderLinhaApolice(item, tbody);
        if(tipo === 'clientes') renderLinhaCliente(item, tbody);
        if(tipo === 'usuarios') renderLinhaUsuario(item, tbody);
    });

    if(containerPaginacao) {
        atualizarControlesPaginacao(tipo, containerPaginacao, totalItens, totalPaginas);
    }
}

function atualizarControlesPaginacao(tipo, container, totalItens, totalPaginas) {
    const estado = estadoGlobal[tipo];
    const inicio = (estado.paginaAtual - 1) * ITENS_POR_PAGINA + 1;
    const fim = Math.min(inicio + ITENS_POR_PAGINA - 1, totalItens);

    let htmlBotoes = `
        <div class="pagination-info">Mostrando ${inicio}-${fim} de ${totalItens}</div>
        <div class="pagination-controls">
            <button class="page-btn" ${estado.paginaAtual === 1 ? 'disabled' : ''} onclick="mudarPagina('${tipo}', ${estado.paginaAtual - 1})"><i class="fas fa-chevron-left"></i></button>
    `;

    let paginasParaMostrar = [];
    if (totalPaginas <= 5) {
        paginasParaMostrar = Array.from({length: totalPaginas}, (_, i) => i + 1);
    } else {
        if (estado.paginaAtual <= 3) paginasParaMostrar = [1, 2, 3, 4, '...', totalPaginas];
        else if (estado.paginaAtual >= totalPaginas - 2) paginasParaMostrar = [1, '...', totalPaginas-3, totalPaginas-2, totalPaginas-1, totalPaginas];
        else paginasParaMostrar = [1, '...', estado.paginaAtual - 1, estado.paginaAtual, estado.paginaAtual + 1, '...', totalPaginas];
    }

    paginasParaMostrar.forEach(p => {
        if (p === '...') {
            htmlBotoes += `<span style="padding:5px;">...</span>`;
        } else {
            htmlBotoes += `<button class="page-btn ${p === estado.paginaAtual ? 'active' : ''}" onclick="mudarPagina('${tipo}', ${p})">${p}</button>`;
        }
    });

    htmlBotoes += `
            <button class="page-btn" ${estado.paginaAtual === totalPaginas ? 'disabled' : ''} onclick="mudarPagina('${tipo}', ${estado.paginaAtual + 1})"><i class="fas fa-chevron-right"></i></button>
        </div>
    `;

    container.innerHTML = htmlBotoes;
}

window.mudarPagina = function(tipo, novaPagina) {
    estadoGlobal[tipo].paginaAtual = novaPagina;
    renderizarTabela(tipo);
};

// ==================================================
// 6. FUNÇÕES DE LINHA (BADGES)
// ==================================================

function renderLinhaApolice(a, tbody) {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    let statusClass = 'badge-vigente';
    let statusTexto = 'VIGENTE';
    
    // Lógica robusta de data para a Tabela
    let dFim = new Date(a.vigencia_fim); // Se null, vira 1969/1970
    if(a.vigencia_fim && a.vigencia_fim.includes('-')) {
        const parts = a.vigencia_fim.split('T')[0].split('-');
        dFim = new Date(parts[0], parts[1]-1, parts[2]);
    }

    const diffDays = Math.ceil((dFim - hoje) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) { statusClass = 'badge-vencida'; statusTexto = 'VENCIDA'; } 
    else if (diffDays >= 0 && diffDays <= 30) { statusClass = 'badge-avencer'; statusTexto = 'A VENCER'; }

    const valTotal = parseFloat(a.premio_total) || 0;
    const valComissao = parseFloat(a.valor_comissao) || 0;

    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${a.cliente || 'Excluído'}</td>
        <td><span class="badge-placa">${a.placa || '-'}</span></td>
        <td>${a.numero_apolice || '-'}</td>
        <td>${dFim.toLocaleDateString('pt-BR')} <br> <span class="badge ${statusClass}" style="margin-top:2px;">${statusTexto}</span></td>
        <td>${valTotal.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td>
        <td style="color:#2e7d32; font-weight:bold;">${valComissao.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td>
        <td style="text-align:center;">
            <button class="action-btn btn-pdf-active" onclick="abrirPdfSeguro('${a.id}')" title="Ver PDF"><i class="fas fa-file-pdf"></i></button>
            <button class="action-btn btn-edit" onclick="window.location.href='apolice.html?id=${a.id}'" title="Editar"><i class="fas fa-edit"></i></button>
            <button class="action-btn btn-delete" onclick="deletarItem('apolices', ${a.id})" title="Excluir"><i class="fas fa-trash"></i></button>
        </td>
    `;
    tbody.appendChild(tr);
}

function renderLinhaCliente(c, tbody) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${c.nome || '-'}</td>
        <td>${c.documento || '-'}</td>
        <td><span class="badge-placa">${c.placa || '-'}</span></td>
        <td>${c.modelo || c.modelo_veiculo || '-'}</td>
        <td style="text-align:center;">
            <button class="action-btn btn-edit" onclick="window.location.href='cadastro.html?id=${c.id}'" title="Editar"><i class="fas fa-edit"></i></button>
            <button class="action-btn btn-delete" onclick="deletarItem('propostas', ${c.id})" title="Excluir"><i class="fas fa-trash"></i></button>
        </td>
    `;
    tbody.appendChild(tr);
}

function renderLinhaUsuario(u, tbody) {
    const badgeClass = u.tipo === 'admin' ? 'badge-admin' : 'badge-user';
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${u.nome}</td>
        <td>${u.email}</td>
        <td><span class="badge ${badgeClass}">${u.tipo.toUpperCase()}</span></td>
        <td style="text-align:center;">
            <button class="action-btn btn-edit" onclick="window.location.href='registro.html?id=${u.id}&origin=dashboard'" title="Editar"><i class="fas fa-edit"></i></button>
            <button class="action-btn btn-delete" onclick="deletarItem('usuarios', ${u.id})" title="Excluir"><i class="fas fa-trash"></i></button>
        </td>
    `;
    tbody.appendChild(tr);
}

// ==================================================
// 7. FUNÇÕES DE AÇÃO
// ==================================================

async function deletarItem(tipo, id) {
    const result = await Swal.fire({
        title: 'Tem certeza?', text: "Essa ação não pode ser desfeita!", icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'Sim, excluir!'
    });

    if (result.isConfirmed) {
        try {
            const res = await fetch(`${API_BASE_URL}/${tipo}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            if (res.ok) {
                await Swal.fire('Deletado!', 'Registro removido.', 'success');
                if(tipo === 'apolices') buscarDadosApolices();
                if(tipo === 'propostas') buscarDadosClientes();
                if(tipo === 'usuarios') buscarDadosUsuarios();
                carregarResumoCards();
            } else {
                Swal.fire('Erro', 'Não foi possível excluir.', 'error');
            }
        } catch (error) {
            Swal.fire('Erro', 'Falha de conexão.', 'error');
        }
    }
}

async function abrirPdfSeguro(id) {
    try {
        Swal.fire({title: 'Abrindo...', didOpen: () => Swal.showLoading()});
        const res = await fetch(`${API_BASE_URL}/apolices/${id}/pdf-seguro`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const json = await res.json();
        Swal.close();
        
        if (json.url) {
            window.open(json.url, '_blank');
        } else {
            Swal.fire('Erro', 'Arquivo não encontrado ou link inválido.', 'error');
        }
    } catch (e) {
        Swal.fire('Erro', 'Falha ao solicitar arquivo.', 'error');
    }
}

function ordenarTabela(n, tabelaId) {
    const table = document.getElementById(tabelaId);
    let rows, switching, i, x, y, shouldSwitch, dir, switchcount = 0;
    switching = true; dir = "asc"; 
    while (switching) {
        switching = false; rows = table.rows;
        for (i = 1; i < (rows.length - 1); i++) {
            shouldSwitch = false;
            x = rows[i].getElementsByTagName("TD")[n];
            y = rows[i + 1].getElementsByTagName("TD")[n];
            if (dir == "asc") { if (x.innerHTML.toLowerCase() > y.innerHTML.toLowerCase()) { shouldSwitch = true; break; } } 
            else if (dir == "desc") { if (x.innerHTML.toLowerCase() < y.innerHTML.toLowerCase()) { shouldSwitch = true; break; } }
        }
        if (shouldSwitch) { rows[i].parentNode.insertBefore(rows[i + 1], rows[i]); switching = true; switchcount ++; } 
        else { if (switchcount == 0 && dir == "asc") { dir = "desc"; switching = true; } }
    }
}