document.addEventListener('DOMContentLoaded', () => {
    // 1. BLINDAGEM: Verifica se tem token
    const token = localStorage.getItem('token');
    if (!token) {
        alert("Sessão expirada ou inválida. Faça login novamente.");
        window.location.href = 'index.html';
        return;
    }

    // 2. Configuração da API
    const API_URL = 'https://api-seguradora.onrender.com'; // Ajuste se sua porta for diferente

    // 3. Carregar dados iniciais (sem filtro ou filtro padrão)
    buscarDados();

    // 4. Configurar Enter no campo de busca para disparar pesquisa
    const inputBusca = document.getElementById('busca_geral');
    if(inputBusca) {
        inputBusca.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault(); // Evita recarregar a página
                aplicarFiltros();
            }
        });
    }
});

// --- FUNÇÃO PRINCIPAL: BUSCAR DADOS NA API ---
async function buscarDados(params = '') {
    const tbody = document.getElementById('tabela-corpo');
    const totalReg = document.getElementById('total-registros');
    const valorTotal = document.getElementById('valor-total');
    const token = localStorage.getItem('token');

    // Feedback visual de carregamento
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">Carregando dados...</td></tr>';

    try {
        // Faz a chamada ao Back-end (Ex: GET http://localhost:3000/relatorios?status=ativo)
        const response = await fetch(`http://localhost:3000/relatorios${params}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Envia o token para autorização
            }
        });

        if (!response.ok) {
            throw new Error('Erro ao buscar dados do servidor.');
        }

        const dados = await response.json();

        // Limpa a tabela
        tbody.innerHTML = '';

        if (dados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">Nenhum registro encontrado com esses filtros.</td></tr>';
            totalReg.innerText = '0';
            valorTotal.innerText = 'R$ 0,00';
            return;
        }

        let somaValores = 0;

        // Itera sobre os dados reais do banco
        dados.forEach(item => {
            // Ajuste aqui os nomes das colunas conforme vêm do seu Banco de Dados (ex: item.nome_cliente, item.valor_premio)
            const valor = parseFloat(item.valor || 0); 
            somaValores += valor;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${item.id}</td>
                <td><strong>${item.nome || item.cliente}</strong></td>
                <td>${item.email || '-'}</td>
                <td>${formatarData(item.created_at || item.data_cadastro)}</td>
                <td>${renderBadge(item.status)}</td>
                <td>R$ ${valor.toFixed(2).replace('.', ',')}</td>
            `;
            tbody.appendChild(tr);
        });

        // Atualiza os totalizadores
        totalReg.innerText = dados.length;
        valorTotal.innerText = `R$ ${somaValores.toFixed(2).replace('.', ',')}`;

    } catch (error) {
        console.error("Erro:", error);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red; padding:20px;">Erro de conexão com o servidor.</td></tr>';
    }
}

// --- CAPTURA OS FILTROS E MONTA A URL ---
function aplicarFiltros() {
    const dataInicio = document.getElementById('data_inicio').value;
    const dataFim = document.getElementById('data_fim').value;
    const status = document.getElementById('status_filtro').value;
    const busca = document.getElementById('busca_geral').value;

    // Monta a Query String (parametros de URL)
    const params = new URLSearchParams();

    if (dataInicio) params.append('inicio', dataInicio);
    if (dataFim) params.append('fim', dataFim);
    if (status) params.append('status', status);
    if (busca) params.append('busca', busca);

    // Chama a função de busca passando a string (ex: ?inicio=2023-01-01&status=ativo)
    buscarDados(`?${params.toString()}`);
}

function limparFiltros() {
    document.getElementById('form-filtros').reset();
    buscarDados(); // Recarrega tudo sem filtros
}

// --- UTILITÁRIOS ---
function formatarData(dataISO) {
    if (!dataISO) return '-';
    // Trata formato ISO do banco (2023-10-25T00:00:00.000Z)
    const data = new Date(dataISO);
    return data.toLocaleDateString('pt-BR');
}

function renderBadge(status) {
    if (!status) return '<span class="badge">N/A</span>';
    
    // Normaliza para minúsculo para comparar
    const s = status.toLowerCase();
    
    let classe = '';
    if (s === 'ativo') classe = 'status-ativo';
    else if (s === 'pendente') classe = 'status-pendente';
    else if (s === 'cancelado') classe = 'status-cancelado';
    else classe = 'badge-operacional'; // fallback

    return `<span class="badge ${classe}">${status.toUpperCase()}</span>`;
}