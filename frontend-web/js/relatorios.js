// --- 1. CONFIGURAÇÃO IGUAL AO DASHBOARD ---
const API_BASE_URL = (typeof API_URL !== 'undefined') ? API_URL : 'https://seguradoraproject.onrender.com';
let dadosParaExportacao = []; // Variável global para guardar o filtro atual

document.addEventListener('DOMContentLoaded', () => {
});

// --- FUNÇÃO AUXILIAR DE CONVERSÃO ---
function parseMoney(val) {
    if(!val) return 0;
    // Se vier como string do banco, pode ser "1200.50"
    let num = parseFloat(val);
    return isNaN(num) ? 0 : num;
}

// --- FUNÇÃO PRINCIPAL ---
async function gerarRelatorio() {
    const token = localStorage.getItem('token');
    const tbody = document.getElementById('tabela-corpo');
    const thead = document.getElementById('tabela-head');
    const titulo = document.getElementById('titulo-relatorio');

    // Limpa exportação anterior
    dadosParaExportacao = [];

    if (!token || token === 'undefined' || token === 'null') {
        Swal.fire('Não Logado', 'Seu token de acesso é inválido.', 'error')
            .then(() => { localStorage.clear(); window.location.href = 'index.html'; });
        return;
    }

    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center"><i class="fas fa-spinner fa-spin"></i> Conectando...</td></tr>';

    try {
        const tipo = document.getElementById('tipo_relatorio').value;
        const dtInicio = document.getElementById('data_inicio').value;
        const dtFim = document.getElementById('data_fim').value;
        const status = document.getElementById('status_filtro').value;
        const termo = document.getElementById('busca_geral').value.toLowerCase();

        const rota = tipo === 'apolices' ? '/apolices' : '/propostas';
        const urlCompleta = `${API_BASE_URL}${rota}`;
        
        console.log(`📡 Conectando em: ${urlCompleta}`);

        const res = await fetch(urlCompleta, { 
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            } 
        });

        if (!res.ok) {
            if (res.status === 401) throw new Error("401 - Não autorizado");
            if (res.status === 403) throw new Error("403 - Acesso proibido");
            throw new Error(`Erro Servidor: ${res.status}`);
        }

        let dados = await res.json();
        
        // --- FILTRAGEM ---
        let filtrados = dados.filter(item => {
            let passou = true;

            // Filtro Texto
            if (termo) {
                const textoItem = JSON.stringify(item).toLowerCase();
                if (!textoItem.includes(termo)) passou = false;
            }

            // Filtro Datas
            if (dtInicio || dtFim) {
                let dataItem = (tipo === 'apolices') ? item.vigencia_fim : item.created_at;
                if (dataItem) {
                    const dItem = new Date(dataItem).toISOString().split('T')[0];
                    if (dtInicio && dItem < dtInicio) passou = false;
                    if (dtFim && dItem > dtFim) passou = false;
                }
            }

            // Filtro Status (Apenas Apólices)
            if (tipo === 'apolices' && status) {
                const hoje = new Date(); hoje.setHours(0,0,0,0);
                let dFim = new Date(item.vigencia_fim);
                if (item.vigencia_fim && item.vigencia_fim.includes('-')) {
                    const parts = item.vigencia_fim.split('T')[0].split('-');
                    dFim = new Date(parts[0], parts[1]-1, parts[2]);
                }
                const diffDays = Math.ceil((dFim - hoje) / (1000 * 60 * 60 * 24)); 

                if (status === 'vencida' && diffDays >= 0) passou = false;
                if (status === 'vigente' && diffDays < 0) passou = false;
                if (status === 'avencer' && (diffDays < 0 || diffDays > 30)) passou = false;
            }
            return passou;
        });

        // SALVA NA VARIÁVEL GLOBAL PARA EXPORTAÇÃO
        dadosParaExportacao = filtrados;

        // --- RENDERIZAÇÃO ---
        tbody.innerHTML = '';
        let totalValorPremio = 0;
        let totalValorComissao = 0;

        if (filtrados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px;">⚠️ Nenhum registro encontrado.</td></tr>';
            atualizarFooter(0, 0, 0);
            return;
        }

        if (tipo === 'apolices') {
            // CABEÇALHO ATUALIZADO COM FINANCEIRO
            thead.innerHTML = `<tr>
                <th>Apólice</th>
                <th>Cliente</th>
                <th>Placa</th>
                <th>Vigência Fim</th>
                <th>Líquido</th>
                <th>%</th>
                <th>Repasse</th>
                <th>Comissão</th>
                <th>Status</th>
            </tr>`;
            titulo.innerText = `Relatório Financeiro de Apólices (${filtrados.length})`;

            filtrados.forEach(d => {
                // Validações Financeiras
                let pTotal = parseMoney(d.premio_total);
                let pLiquido = parseMoney(d.premio_liquido);
                let vRepasse = parseMoney(d.valor_repasse);
                let vComissao = parseMoney(d.valor_comissao);

                // Acumula Totais
                totalValorPremio += pTotal > 0 ? pTotal : pLiquido;
                totalValorComissao += vComissao;

                // Cálculo Reverso da Porcentagem para exibição
                // Comissão = (Líquido * %) + Repasse  ->  % = ((Comissão - Repasse) / Líquido) * 100
                let percUsada = 0;
                let baseCalculo = pLiquido > 0 ? pLiquido : pTotal; // Fallback se líquido for 0

                if (baseCalculo > 0 && vComissao > 0) {
                    let comissaoBase = vComissao - vRepasse;
                    percUsada = (comissaoBase / baseCalculo) * 100;
                    percUsada = Math.round(percUsada * 10) / 10; // Arredonda 1 casa
                }
                if (percUsada < 0) percUsada = 0; // Evita negativo se repasse for maior que comissão (caso raro)

                // Tratamento de Status
                let badge = '<span class="badge" style="background:green; color:white;">VIGENTE</span>';
                const hoje = new Date(); hoje.setHours(0,0,0,0);
                let dataFim = new Date(d.vigencia_fim);
                if(d.vigencia_fim && d.vigencia_fim.includes('-')) {
                    const parts = d.vigencia_fim.split('T')[0].split('-');
                    dataFim = new Date(parts[0], parts[1]-1, parts[2]);
                }
                const diff = (dataFim - hoje)/(1000*60*60*24);

                if(diff < 0) badge = '<span class="badge" style="background:red; color:white;">VENCIDA</span>';
                else if(diff <= 30) badge = '<span class="badge" style="background:orange; color:white;">A VENCER</span>';

                // Renderiza Linha
                tbody.innerHTML += `<tr>
                    <td>${d.numero_apolice || '-'}</td>
                    <td>${d.cliente || d.cliente_nome || '-'}</td>
                    <td>${d.placa || d.veiculo_placa || '-'}</td>
                    <td>${dataFim.toLocaleDateString('pt-BR')}</td>
                    <td>${pLiquido.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td>
                    <td>${percUsada}%</td>
                    <td>${vRepasse.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td>
                    <td style="font-weight:bold; color:#2e7d32;">${vComissao.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td>
                    <td>${badge}</td>
                </tr>`;
            });
            
            document.getElementById('box-total-valor').style.display = 'block';
            document.getElementById('box-total-comissao').style.display = 'block';

        } else {
            // TABELA DE CLIENTES (Mantida Simples)
            thead.innerHTML = `<tr><th>Nome</th><th>CPF/CNPJ</th><th>Email</th><th>Telefone</th><th>Placa</th><th>Modelo</th></tr>`;
            titulo.innerText = `Relatório de Clientes (${filtrados.length})`;
            filtrados.forEach(d => {
                tbody.innerHTML += `<tr>
                    <td>${d.nome || '-'}</td>
                    <td>${d.documento || '-'}</td>
                    <td>${d.email || '-'}</td>
                    <td>${d.telefone || '-'}</td>
                    <td>${d.placa || '-'}</td>
                    <td>${d.modelo || d.modelo_veiculo || '-'}</td>
                </tr>`;
            });
            document.getElementById('box-total-valor').style.display = 'none';
            document.getElementById('box-total-comissao').style.display = 'none';
        }

        atualizarFooter(filtrados.length, totalValorPremio, totalValorComissao);

    } catch (error) {
        console.error("Erro Relatórios:", error);
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:red; padding:20px;"><strong>Erro:</strong> ${error.message}</td></tr>`;
    }
}

// --- FUNÇÃO EXPORTAR EXCEL ---
function exportarExcel() {
    if (dadosParaExportacao.length === 0) {
        Swal.fire('Atenção', 'Gere o relatório primeiro para ter dados para exportar.', 'warning');
        return;
    }

    const tipo = document.getElementById('tipo_relatorio').value;
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // BOM para acentuação

    if (tipo === 'apolices') {
        // Cabeçalho Expandido
        csvContent += "Numero Apolice;Cliente;Placa;Vigencia Fim;Premio Liquido;% Usada;Repasse;Comissao Final\n";
        
        dadosParaExportacao.forEach(row => {
            let pLiquido = parseMoney(row.premio_liquido);
            let pTotal = parseMoney(row.premio_total);
            let vRepasse = parseMoney(row.valor_repasse);
            let vComissao = parseMoney(row.valor_comissao);
            
            // Recalcula % para Excel
            let baseCalculo = pLiquido > 0 ? pLiquido : pTotal;
            let percUsada = 0;
            if (baseCalculo > 0 && vComissao > 0) {
                let comissaoBase = vComissao - vRepasse;
                percUsada = (comissaoBase / baseCalculo) * 100;
                percUsada = Math.round(percUsada * 10) / 10;
            }

            // Formata Data
            let dataFim = row.vigencia_fim;
            if(row.vigencia_fim && row.vigencia_fim.includes('-')) {
                const parts = row.vigencia_fim.split('T')[0].split('-');
                dataFim = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
            
            // Monta linha CSV
            let linha = [
                row.numero_apolice || '',
                row.cliente || '',
                row.placa || '',
                dataFim || '',
                pLiquido.toFixed(2).replace('.', ','),
                percUsada.toFixed(1).replace('.', ',') + '%',
                vRepasse.toFixed(2).replace('.', ','),
                vComissao.toFixed(2).replace('.', ',')
            ].join(";");
            csvContent += linha + "\n";
        });
    } else {
        // Cabeçalho Clientes
        csvContent += "Nome;Documento;Email;Telefone;Placa;Modelo\n";
        dadosParaExportacao.forEach(row => {
            let linha = [
                row.nome || '',
                row.documento || '',
                row.email || '',
                row.telefone || '',
                row.placa || '',
                row.modelo_veiculo || ''
            ].join(";");
            csvContent += linha + "\n";
        });
    }

    // Download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_${tipo}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function atualizarFooter(qtd, totalPremios, totalComissoes) {
    document.getElementById('footer-resumo').style.display = 'flex';
    document.getElementById('total-registros').innerText = qtd;
    document.getElementById('valor-total').innerText = totalPremios.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
    
    // Novo campo de comissão
    const elComissao = document.getElementById('total-comissao');
    if(elComissao) {
        elComissao.innerText = totalComissoes.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
    }
}

function limparFiltros() {
    document.getElementById('form-filtros').reset();
    document.getElementById('tabela-corpo').innerHTML = '';
    document.getElementById('titulo-relatorio').innerText = 'Selecione os filtros e clique em Gerar.';
    document.getElementById('footer-resumo').style.display = 'none';
    dadosParaExportacao = [];
}