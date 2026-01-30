document.addEventListener("DOMContentLoaded", async () => {
    
    // 1. CARREGAR CLIENTES (Busca do Banco de Dados)
    await carregarClientesNoSelect();

    const inputPdf = document.getElementById('pdf_upload');
    const btnProcessar = document.getElementById('btn-processar-pdf');
    const spanArquivo = document.getElementById('nome-arquivo');
    const formApolice = document.getElementById('form-apolice');

    // --- LÓGICA DE UPLOAD PDF ---
    if(inputPdf) {
        inputPdf.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                if(spanArquivo) {
                    spanArquivo.innerText = "📄 " + this.files[0].name;
                    spanArquivo.style.color = "#2e7d32";
                    spanArquivo.style.fontWeight = "bold";
                }
                if(btnProcessar) btnProcessar.style.display = 'inline-block';
            }
        });
    }

    // --- LÓGICA DE PROCESSAMENTO DO PDF ---
    if(btnProcessar) {
        btnProcessar.addEventListener('click', async (e) => {
            e.preventDefault(); 
            if(!inputPdf.files[0]) return showAlert('Atenção', 'Selecione um arquivo PDF primeiro.', 'error');

            const formData = new FormData();
            formData.append('pdf', inputPdf.files[0]);
            
            const originalText = btnProcessar.innerText;
            btnProcessar.innerText = "⏳ Lendo..."; 
            btnProcessar.disabled = true;

            try {
                // CORREÇÃO: Removido o https:// duplicado
                const res = await fetch('https://seguradoraproject.onrender.com/importar-pdf', { method: 'POST', body: formData });
                
                if (!res.ok) throw new Error("Erro ao ler PDF.");

                const dados = await res.json();
                console.log("Dados do PDF:", dados);
                
                preencherCamposPeloPDF(dados);
                
                showAlert("Sucesso", "Dados lidos e preenchidos automaticamente!", "success");

            } catch (err) {
                console.error(err);
                showAlert("Erro", "Falha ao ler PDF: " + err.message, "error");
            } finally {
                btnProcessar.innerText = originalText; 
                btnProcessar.disabled = false;
            }
        });
    }

    // --- LÓGICA DE SALVAR (SUBMIT COM ARQUIVO) ---
    if(formApolice) {
        formApolice.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Cria um FormData (pacote que suporta arquivos)
            // O campo 'valor_comissao' será incluído automaticamente se estiver no HTML
            const formData = new FormData(formApolice);
            
            // Validação simples
            if (!formData.get('veiculo_id')) {
                return showAlert("Atenção", "Selecione um cliente na lista.", "error");
            }

            // PEGA O ARQUIVO PDF DO CAMPO DE IMPORTAÇÃO E ADICIONA AO ENVIO
            const inputPdf = document.getElementById('pdf_upload');
            if (inputPdf && inputPdf.files[0]) {
                formData.append('arquivo_pdf', inputPdf.files[0]);
            }

            try {
                // CORREÇÃO: Removido o https:// duplicado
                const res = await fetch('https://seguradoraproject.onrender.com/cadastrar-apolice', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }, // Adicionado Token por segurança
                    body: formData 
                });

                const json = await res.json();

                if (res.ok) {
                    showAlert("Sucesso!", "Apólice e PDF salvos com sucesso!", "success", () => {
                        window.location.href = 'dashboard.html';
                    });
                } else {
                    throw new Error(json.message || json.error || "Erro ao salvar");
                }
            } catch (error) {
                showAlert("Erro", error.message, "error");
            }
        });
    }

    // --- FUNÇÕES AUXILIARES ---

    async function carregarClientesNoSelect() {
        const select = document.getElementById('veiculo_id');
        if(!select) return;

        try {
            // CORREÇÃO: Removido o https:// duplicado
            const res = await fetch('https://seguradoraproject.onrender.com/propostas', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if(res.ok) {
                const clientes = await res.json();
                
                select.innerHTML = '<option value="">Selecione o Cliente...</option>';

                if (clientes.length === 0) {
                    const opt = document.createElement('option');
                    opt.text = "Nenhum cliente cadastrado";
                    select.appendChild(opt);
                    return;
                }

                clientes.forEach(c => {
                    const option = document.createElement('option');
                    option.value = c.id; // ID que vai pro banco
                    
                    // Salva dados extras nos atributos para ajudar o PDF a encontrar
                    option.setAttribute('data-placa', (c.placa || '').toUpperCase().replace('-', ''));
                    option.setAttribute('data-nome', (c.nome || '').toUpperCase());
                    
                    // Texto visível: Nome - Modelo - Placa
                    option.text = `${c.nome} - ${c.modelo || ''} (${c.placa || 'S/Placa'})`;
                    select.appendChild(option);
                });
            } else {
                select.innerHTML = '<option value="">Erro ao carregar lista</option>';
            }
        } catch(e) {
            console.error(e);
            select.innerHTML = '<option value="">Erro de conexão</option>';
        }
    }

    function preencherCamposPeloPDF(dados) {
        // 1. Tenta selecionar o cliente pela PLACA
        const select = document.getElementById('veiculo_id');
        if (dados.placa && select) {
            const placaPDF = dados.placa.replace(/[^A-Z0-9]/gi, '').toUpperCase();
            let encontrou = false;

            for(let i=0; i<select.options.length; i++) {
                const placaOpt = (select.options[i].getAttribute('data-placa') || "");
                
                if (placaOpt && placaPDF.includes(placaOpt)) { 
                    select.selectedIndex = i; 
                    encontrou = true;
                    break;
                }
            }
            if(!encontrou) console.warn("Placa do PDF não encontrada na lista de clientes.");
        }

        // 2. Preenche Datas
        if (dados.datas && dados.datas.length) {
            const dts = dados.datas.map(d => {
                const parts = d.split('/');
                if(parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                return null;
            }).filter(d => d != null).sort((a,b)=>a-b);
            
            if (dts.length > 0) {
                const fim = dts[dts.length-1]; 
                const ini = new Date(fim); 
                ini.setFullYear(fim.getFullYear()-1); 
                
                const elFim = document.getElementById('vigencia_fim');
                const elIni = document.getElementById('vigencia_inicio');
                
                if(elFim) elFim.value = fim.toISOString().split('T')[0];
                if(elIni) elIni.value = ini.toISOString().split('T')[0];
            }
        }

        // 3. Preenche Valores e CALCULA COMISSÃO
        if (dados.valores && dados.valores.length) {
            const nums = dados.valores.map(v => {
                return parseFloat(v.replace(/[^0-9,]/g,'').replace(',','.'));
            }).filter(n => !isNaN(n) && n > 100);

            if (nums.length) {
                const max = Math.max(...nums);
                const elTotal = document.getElementById('premio_total');
                
                // Formata para o padrão BR (com vírgula) para máscaras funcionarem melhor
                if(elTotal) elTotal.value = max.toFixed(2).replace('.', ',');

                // --- NOVA REGRA: Sugerir Comissão (15%) ---
                const elComissao = document.getElementById('valor_comissao');
                if(elComissao) {
                     // Calcula 15% e formata com vírgula
                     const comissao = (max * 0.15).toFixed(2).replace('.', ',');
                     elComissao.value = comissao;
                }
            }
        }
    }
});