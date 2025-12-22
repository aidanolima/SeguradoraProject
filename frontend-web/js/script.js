document.addEventListener("DOMContentLoaded", async function() {

    // ============================================================
    // 1. GESTÃO DE SESSÃO E MENU
    // ============================================================
    const nomeUsuario = localStorage.getItem('usuario_logado');
    const greetingElement = document.getElementById('user-greeting');
    const linkSair = document.getElementById('btn-logout');

    if (greetingElement) {
        if (nomeUsuario && nomeUsuario !== 'undefined') {
            greetingElement.innerText = `Olá, ${nomeUsuario}`;
            greetingElement.style.color = "#2e7d32"; 
            greetingElement.style.fontWeight = "bold";
        } else {
            console.warn("Sem sessão. Redirecionando...");
            window.location.href = 'index.html';
            return; 
        }
    }

    if (linkSair) {
        linkSair.addEventListener('click', function(e) {
            e.preventDefault();
            localStorage.clear();
            window.location.href = 'index.html';
        });
    }

    // ============================================================
    // 2. MODO EDIÇÃO (CARREGAR DADOS)
    // ============================================================
    const urlParams = new URLSearchParams(window.location.search);
    const idEdicao = urlParams.get('id');
    const form = document.querySelector('form');
    const tituloPagina = document.querySelector('h1');
    const btnSubmit = document.querySelector('button[type="submit"]');

    if (idEdicao) {
        console.log("--- MODO EDIÇÃO ATIVADO --- ID:", idEdicao);
        
        // Ajusta visual
        if(tituloPagina) tituloPagina.innerText = "Editar Proposta";
        if(btnSubmit) btnSubmit.innerText = "Salvar Alterações";
        
        try {
            const res = await fetch(`https://https://seguradoraproject.onrender.com/propostas/${idEdicao}`);
            if (res.ok) {
                const dados = await res.json();
                console.log("Dados recebidos do Banco:", dados);

                // === MAPEAMENTO (BANCO -> TELA) ===
                document.getElementById('nome').value = dados.nome || dados.nome_razao_social || '';
                document.getElementById('documento').value = dados.documento || '';
                document.getElementById('email').value = dados.email || '';
                document.getElementById('telefone').value = dados.telefone || '';
                
                document.getElementById('cep').value = dados.cep || dados.endereco_cep || '';
                document.getElementById('endereco').value = dados.endereco || dados.endereco_logradouro || '';
                document.getElementById('bairro').value = dados.bairro || dados.endereco_bairro || '';
                document.getElementById('cidade').value = dados.cidade || dados.endereco_cidade || '';
                document.getElementById('uf').value = dados.uf || dados.endereco_uf || '';
                
                if(document.getElementById('numero') && dados.endereco_numero) {
                     document.getElementById('numero').value = dados.endereco_numero; 
                }
                if(document.getElementById('complemento') && dados.endereco_complemento) {
                     document.getElementById('complemento').value = dados.endereco_complemento; 
                }

                // Veículo
                document.getElementById('fabricante').value = dados.fabricante || '';
                document.getElementById('modelo').value = dados.modelo || '';
                document.getElementById('ano_modelo').value = dados.ano_modelo || '';
                document.getElementById('placa').value = dados.placa || '';
                document.getElementById('chassi').value = dados.chassi || '';
                document.getElementById('fipe').value = dados.fipe || dados.codigo_fipe || '';
                
                if(document.getElementById('utilizacao')) {
                    document.getElementById('utilizacao').value = dados.utilizacao || dados.uso_veiculo || 'particular';
                }

                // Checkboxes
                if(document.getElementById('blindado')) document.getElementById('blindado').checked = (dados.blindado === 1 || dados.blindado === true);
                if(document.getElementById('kit_gas')) document.getElementById('kit_gas').checked = (dados.kit_gas === 1 || dados.kit_gas === true);
                if(document.getElementById('zero_km')) document.getElementById('zero_km').checked = (dados.zero_km === 1 || dados.zero_km === true);

            } else {
                alert("Erro ao buscar dados para edição.");
            }
        } catch (error) {
            console.error("Erro no fetch de edição:", error);
        }
    }

    // ============================================================
    // 3. MÁSCARAS E CEP
    // ============================================================
    const inputDoc = document.getElementById('documento');
    if (inputDoc) {
        inputDoc.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length <= 11) {
                value = value.replace(/(\d{3})(\d)/, '$1.$2');
                value = value.replace(/(\d{3})(\d)/, '$1.$2');
                value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
            } else {
                value = value.replace(/^(\d{2})(\d)/, '$1.$2');
                value = value.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
                value = value.replace(/\.(\d{3})(\d)/, '.$1/$2');
                value = value.replace(/(\d{4})(\d)/, '$1-$2');
            }
            e.target.value = value;
        });
    }

    const inputCep = document.getElementById('cep');
    if (inputCep) {
        inputCep.addEventListener('input', function(e) {
            let cep = e.target.value.replace(/\D/g, '');
            if (cep.length > 5) cep = cep.replace(/^(\d{5})(\d)/, '$1-$2');
            e.target.value = cep;

            const cleanCep = cep.replace('-', '');
            if (cleanCep.length === 8) {
                fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
                    .then(r => r.json())
                    .then(data => {
                        if (!data.erro) {
                            document.getElementById('endereco').value = data.logradouro;
                            document.getElementById('bairro').value = data.bairro;
                            document.getElementById('cidade').value = data.localidade;
                            document.getElementById('uf').value = data.uf;
                            document.getElementById('numero').focus();
                        }
                    });
            }
        });
    }

    // ============================================================
    // 4. ENVIO DO FORMULÁRIO (A MUDANÇA ESTÁ AQUI EMBAIXO)
    // ============================================================
    if (form) {
        form.addEventListener('submit', async function (event) {
            event.preventDefault();

            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            // Tratamento de Checkboxes
            data.blindado = document.getElementById('blindado')?.checked || false;
            data.kit_gas = document.getElementById('kit_gas')?.checked || false;
            data.zero_km = document.getElementById('zero_km')?.checked || false;

            // Define URL e Método
            let url = 'https://https://seguradoraproject.onrender.com/cadastrar-proposta';
            let method = 'POST';

            if (idEdicao) {
                url = `https://https://seguradoraproject.onrender.com/propostas/${idEdicao}`;
                method = 'PUT';
            }

            try {
                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (response.ok) {
                    if (typeof showAlert === 'function') {
                        showAlert('Sucesso!', idEdicao ? 'Dados atualizados!' : 'Cliente cadastrado!', 'success');
                    } else {
                        alert('Sucesso!');
                    }
                    
                    // --- MUDANÇA AQUI: REDIRECIONAMENTO ---
                    // Antes: só redirecionava se fosse edição.
                    // Agora: redireciona SEMPRE após 1.5 segundos.
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 1500);
                    
                } else {
                    if (typeof showAlert === 'function') showAlert('Erro', result.message, 'error');
                    else alert('Erro: ' + result.message);
                }

            } catch (error) {
                console.error(error);
                alert('Erro de conexão.');
            }
        });
    }
});