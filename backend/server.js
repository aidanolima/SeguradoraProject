require('dotenv').config();
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mysql = require('mysql2/promise');
const multer = require('multer');
const pdf = require('pdf-extraction');
const jwt = require('jsonwebtoken');
const express = require('express');

console.log("⏳ Iniciando configurações do servidor...");

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'seguradora_chave_secreta_super_segura_2024';

// ==================================================
// 🚨 MIDDLEWARES
// ==================================================
app.use(express.json());
app.use(cors());
app.use((req, res, next) => {
    console.log(`[LOG] ${req.method} ${req.url}`);
    next();
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==================================================
// 📂 CONFIGURAÇÃO DE UPLOAD
// ==================================================
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storageDisk = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
// Usamos .any() para maior flexibilidade com FormData
const uploadSave = multer({ storage: storageDisk });

// ==================================================
// 🛢️ BANCO DE DADOS
// ==================================================
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false },
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0
});

// ==================================================
// 🔐 AUTH E HELPERS
// ==================================================
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// Helper Robusto para Moeda (Aceita 1000.00 ou 1.000,00)
const safeCurrency = (v) => {
    if (!v) return 0.00;
    let str = v.toString();
    // Se tiver vírgula, assume formato BR
    if (str.includes(',')) {
        str = str.replace(/\./g, ''); // Remove milhar
        str = str.replace(',', '.');  // Decimal
    }
    const num = parseFloat(str);
    return isNaN(num) ? 0.00 : num;
};

// Helper para Inteiros
const safeInt = (v) => {
    if (!v || v === '' || v === 'null') return null;
    const num = parseInt(v);
    return isNaN(num) ? null : num;
};

// ==================================================
// 🚪 LOGIN
// ==================================================
app.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);

        if (rows.length === 0) return res.status(401).json({ message: "Usuário não encontrado." });

        const usuario = rows[0];
        if (senha !== usuario.senha) return res.status(401).json({ message: "Senha incorreta." });

        const token = jwt.sign(
            { id: usuario.id, email: usuario.email, tipo: usuario.tipo },
            JWT_SECRET, { expiresIn: '24h' }
        );

        res.json({
            auth: true, token: token,
            usuario: { nome: usuario.nome, tipo: usuario.tipo }
        });
    } catch (error) {
        console.error("Erro Login:", error);
        res.status(500).json({ message: "Erro interno." });
    }
});

// ==================================================
// 👤 USUÁRIOS
// ==================================================
app.post('/registrar', authenticateToken, async (req, res) => {
    try {
        const { nome, email, senha, tipo } = req.body;
        if (!nome || !email || !senha) return res.status(400).json({ message: "Dados incompletos." });
        await pool.query('INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)', [nome, email, senha, tipo]);
        res.status(201).json({ message: "Usuário criado" });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/usuarios', authenticateToken, async (req, res) => {
    try { const [rows] = await pool.query('SELECT id, nome, email, tipo FROM usuarios'); res.json(rows); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/usuarios/:id', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, nome, email, tipo FROM usuarios WHERE id = ?', [req.params.id]);
        if (rows.length > 0) res.json(rows[0]); else res.status(404).json({ message: "Não encontrado." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/usuarios/:id', authenticateToken, async (req, res) => {
    try {
        const { nome, email, senha, tipo } = req.body;
        if (senha) await pool.query('UPDATE usuarios SET nome=?, email=?, senha=?, tipo=? WHERE id=?', [nome, email, senha, tipo, req.params.id]);
        else await pool.query('UPDATE usuarios SET nome=?, email=?, tipo=? WHERE id=?', [nome, email, tipo, req.params.id]);
        res.json({ message: "Atualizado" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/usuarios/:id', authenticateToken, async (req, res) => {
    try { await pool.query('DELETE FROM usuarios WHERE id = ?', [req.params.id]); res.json({ message: "Excluído" }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================================================
// 📊 DASHBOARD
// ==================================================
app.get('/dashboard-resumo', authenticateToken, async (req, res) => {
    try {
        const [resApolices] = await pool.query('SELECT COUNT(*) as total FROM apolices');
        const [resUsuarios] = await pool.query('SELECT COUNT(*) as total FROM usuarios');
        const [resVeiculos] = await pool.query('SELECT COUNT(*) as total FROM propostas');
        const [resClientes] = await pool.query('SELECT COUNT(DISTINCT nome) as total FROM propostas');
        res.json({ apolices: resApolices[0].total, usuarios: resUsuarios[0].total, veiculos: resVeiculos[0].total, clientes: resClientes[0].total });
    } catch (e) { res.status(500).json({ message: "Erro stats" }); }
});

// ==================================================
// 📝 PROPOSTAS
// ==================================================
app.get('/propostas', authenticateToken, async (req, res) => {
    try { const [rows] = await pool.query('SELECT * FROM propostas ORDER BY id DESC'); res.json(rows); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/propostas/:id', authenticateToken, async (req, res) => {
    try { const [rows] = await pool.query('SELECT * FROM propostas WHERE id = ?', [req.params.id]); if (rows.length > 0) res.json(rows[0]); else res.status(404).json({ message: "Não encontrado" }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/cadastrar-proposta', authenticateToken, async (req, res) => {
    try {
        const d = req.body;
        const sql = `INSERT INTO propostas (nome, documento, email, telefone, placa, modelo, cep, endereco, bairro, cidade, uf, numero, complemento, fabricante, chassi, ano_modelo, fipe, utilizacao, blindado, kit_gas, zero_km, cep_pernoite, cobertura_casco, carro_reserva, forma_pagamento) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
        await pool.query(sql, [d.nome, d.documento, d.email, d.telefone, d.placa, d.modelo, d.cep, d.endereco, d.bairro, d.cidade, d.uf, d.numero, d.complemento, d.fabricante, d.chassi, d.ano_modelo, d.fipe, d.utilizacao, d.blindado, d.kit_gas, d.zero_km, d.cep_pernoite, d.cobertura_casco, d.carro_reserva, d.forma_pagamento]);
        res.status(201).json({ message: "Criado" });
    } catch(e) { res.status(500).json({message: e.message}); }
});

app.put('/propostas/:id', authenticateToken, async (req, res) => {
    try {
        const d = req.body;
        const sql = `UPDATE propostas SET nome=?, documento=?, email=?, telefone=?, placa=?, modelo=?, cep=?, endereco=?, bairro=?, cidade=?, uf=?, numero=?, complemento=?, fabricante=?, chassi=?, ano_modelo=?, fipe=?, utilizacao=?, blindado=?, kit_gas=?, zero_km=?, cep_pernoite=?, cobertura_casco=?, carro_reserva=?, forma_pagamento=? WHERE id=?`;
        await pool.query(sql, [d.nome, d.documento, d.email, d.telefone, d.placa, d.modelo, d.cep, d.endereco, d.bairro, d.cidade, d.uf, d.numero, d.complemento, d.fabricante, d.chassi, d.ano_modelo, d.fipe, d.utilizacao, d.blindado, d.kit_gas, d.zero_km, d.cep_pernoite, d.cobertura_casco, d.carro_reserva, d.forma_pagamento, req.params.id]);
        res.json({ message: "Atualizado" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/propostas/:id', authenticateToken, async (req, res) => {
    try { await pool.query('DELETE FROM propostas WHERE id = ?', [req.params.id]); res.json({ message: "Excluído" }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================================================
// 📄 APÓLICES (CORRIGIDO UPLOAD E PARSING)
// ==================================================
app.get('/apolices', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT a.*, p.nome as cliente_nome, p.placa as veiculo_placa FROM apolices a LEFT JOIN propostas p ON a.veiculo_id = p.id ORDER BY a.id DESC`);
        // Formatamos o nome para facilitar o frontend
        const fmt = rows.map(r => ({...r, cliente: r.cliente_nome || 'Excluído', placa: r.veiculo_placa || 'S/Placa'}));
        res.json(fmt);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/apolices/:id', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM apolices WHERE id = ?', [req.params.id]);
        if (rows.length > 0) res.json(rows[0]); else res.status(404).json({ message: "Não encontrado" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// === CADASTRAR APÓLICE (COM SUPORTE A REQ.FILES) ===
app.post('/cadastrar-apolice', authenticateToken, uploadSave.any(), async (req, res) => {
    try {
        console.log("------------------------------------------------");
        console.log("📝 [POST] Cadastrar Apólice Iniciado");
        
        // Verifica se há arquivos em req.files (array)
        const arquivo = (req.files && req.files.length > 0) ? req.files[0] : null;
        const nomeArquivo = arquivo ? arquivo.filename : null;

        console.log("📂 Arquivo detectado:", nomeArquivo || "Nenhum");
        console.log("📦 Dados do corpo:", req.body);

        const d = req.body;
        const idVeiculo = safeInt(d.veiculo_id);

        if (!idVeiculo) {
            console.log("❌ Erro: Veículo não selecionado.");
            return res.status(400).json({ message: "Veículo obrigatório." });
        }

        await pool.query(`INSERT INTO apolices (numero_apolice, veiculo_id, arquivo_pdf, premio_total, premio_liquido, franquia_casco, vigencia_inicio, vigencia_fim, numero_proposta) VALUES (?,?,?,?,?,?,?,?,?)`, 
            [
                d.numero_apolice, 
                idVeiculo, 
                nomeArquivo, // Nome do arquivo ou null
                safeCurrency(d.premio_total), 
                safeCurrency(d.premio_liquido), 
                safeCurrency(d.franquia_casco), 
                d.vigencia_inicio || null, 
                d.vigencia_fim || null, 
                d.numero_proposta
            ]
        );
        
        console.log("✅ Sucesso: Apólice criada.");
        res.status(201).json({message: "Criado"});
    } catch(e) { 
        console.error("❌ Erro servidor:", e); 
        res.status(500).json({message: e.message}); 
    }
});

// === ATUALIZAR APÓLICE ===
app.put('/apolices/:id', authenticateToken, uploadSave.any(), async (req, res) => {
    try {
        const d = req.body;
        const idVeiculo = safeInt(d.veiculo_id);
        
        await pool.query(`UPDATE apolices SET numero_apolice=?, numero_proposta=?, veiculo_id=?, premio_total=?, premio_liquido=?, franquia_casco=?, vigencia_inicio=?, vigencia_fim=? WHERE id=?`, 
            [d.numero_apolice, d.numero_proposta, idVeiculo, safeCurrency(d.premio_total), safeCurrency(d.premio_liquido), safeCurrency(d.franquia_casco), d.vigencia_inicio || null, d.vigencia_fim || null, req.params.id]);
        
        // Se houver arquivo novo, atualiza apenas a coluna do arquivo
        if (req.files && req.files.length > 0) {
            await pool.query('UPDATE apolices SET arquivo_pdf=? WHERE id=?', [req.files[0].filename, req.params.id]);
        }
        res.status(200).json({ message: "Atualizado" });
    } catch(e) { console.error(e); res.status(500).json({ message: e.message }); }
});

app.delete('/apolices/:id', authenticateToken, async (req, res) => {
    try { await pool.query('DELETE FROM apolices WHERE id = ?', [req.params.id]); res.json({ message: "Excluído" }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================================================
// ⚡ IMPORTAR PDF (VERSÃO ROBUSTA)
// ==================================================
app.post('/importar-pdf', authenticateToken, uploadSave.any(), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) return res.status(400).json({ message: "Sem arquivo." });
        
        const dataBuffer = fs.readFileSync(req.files[0].path);
        const data = await pdf(dataBuffer);
        // Limpa quebras de linha estranhas
        const txt = data.text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ');

        let dados = { premio_total: "0.00", numero_apolice: "", placa: "" };

        // 1. TENTA VÁRIOS PADRÕES PARA O VALOR (Ordem de prioridade)
        // Padrão 1: "Prêmio Total: R$ 1.200,00" ou "Valor Líquido 1200.00"
        const regexValores = [
            /(?:Prêmio Total|Premio Total|Valor Total|Custo Total).*?R?\$?\s*([\d\.,]+)/i,
            /(?:Prêmio Líquido|Premio Liquido).*?R?\$?\s*([\d\.,]+)/i,
            /(?:Importância Segurada).*?R?\$?\s*([\d\.,]+)/i
        ];

        for (const regex of regexValores) {
            const match = txt.match(regex);
            if (match) {
                // Limpa formatação (1.234,56 -> 1234.56)
                let val = match[1].replace(/\./g, '').replace(',', '.');
                // Validação extra: Se for um número válido e maior que zero
                if (!isNaN(parseFloat(val)) && parseFloat(val) > 0) {
                    dados.premio_total = val;
                    break; // Achou, para de procurar
                }
            }
        }

        // 2. NÚMERO DA APÓLICE (Procura sequências longas de números)
        const matchApolice = txt.match(/(?:Apólice|Contrato|Certificado)[:\s]*([\d\.-]{5,})/i);
        if (matchApolice) {
            dados.numero_apolice = matchApolice[1].replace(/[^0-9]/g, '');
        } else {
            // Fallback: Procura qualquer sequência de 10 a 20 dígitos isolada
            const matchNumeros = txt.match(/\b\d{10,20}\b/);
            if(matchNumeros) dados.numero_apolice = matchNumeros[0];
        }

        // 3. PLACA (Padrão Mercosul ou Antigo)
        const matchPlaca = txt.match(/[A-Z]{3}[0-9][0-9A-Z][0-9]{2}/i);
        if(matchPlaca) dados.placa = matchPlaca[0].toUpperCase();

        // 4. DATAS (Vigência)
        const regexDatas = /(\d{2})\/(\d{2})\/(\d{4})/g;
        let m; const dates = [];
        while ((m = regexDatas.exec(txt)) !== null) {
            const ano = parseInt(m[3]);
            if(ano > 2000 && ano < 2040) dates.push(`${m[3]}-${m[2]}-${m[1]}`);
        }
        dates.sort(); // Ordena cronologicamente
        if(dates.length > 0) {
            dados.vigencia_inicio = dates[0]; // Primeira data encontrada
            dados.vigencia_fim = dates[dates.length-1]; // Última data encontrada
        }
        
        console.log("✅ PDF Lido (Melhorado):", dados);
        res.json({ mensagem: "Sucesso", dados });
    } catch (e) { 
        console.error("Erro PDF:", e);
        res.status(500).json({message: "Erro ao ler PDF"}); 
    }
});


// ==================================================
// 🚑 ROTA DE EMERGÊNCIA (Cria Admin no Banco Atual)
// ==================================================
// app.get('/criar-admin-emergencia', async (req, res) => {
//    try {
//        const senha = '12345678';
//        const email = 'admin@sistema.com';
//        
//        // Verifica conexão
//        console.log("🚑 Tentando criar admin...");

        // Verifica se já existe
//        const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
//        if (rows.length > 0) {
 //           return res.send(`O usuário Admin JÁ EXISTE neste banco de dados (ID: ${rows[0].id}). Se não consegue logar, a senha pode estar diferente.`);
 //       }

        // Cria o usuário
//        await pool.query("INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, 'admin')", ['Admin Remoto', email, senha]);
 //       res.send(`✅ SUCESSO! Admin criado no banco correto.<br>Login: ${email}<br>Senha: ${senha}<br><br>Volte e faça login.`);
 //   } catch (e) {
 //       console.error("Erro na rota de emergência:", e);
 //       res.status(500).send("❌ Erro ao criar admin: " + e.message);
 ////   }
//}); 

// ==================================================
// 🚀 INICIALIZAÇÃO
// ==================================================

// ==================================================
// 🚑 ROTA PARA CRIAR COLUNAS FALTANTES
// ==================================================
app.get('/fix-tabelas', async (req, res) => {
    try {
        let msg = "<h3>Iniciando atualização do banco...</h3>";

        // 1. Tenta criar premio_liquido
        try {
            await pool.query("ALTER TABLE apolices ADD COLUMN premio_liquido DECIMAL(10,2) DEFAULT 0.00");
            msg += "✅ Coluna 'premio_liquido' criada com sucesso.<br>";
        } catch (e) {
            msg += "⚠️ 'premio_liquido': " + e.message + "<br>";
        }

        // 2. Tenta criar franquia_casco (provavelmente falta também)
        try {
            await pool.query("ALTER TABLE apolices ADD COLUMN franquia_casco DECIMAL(10,2) DEFAULT 0.00");
            msg += "✅ Coluna 'franquia_casco' criada com sucesso.<br>";
        } catch (e) {
            msg += "⚠️ 'franquia_casco': " + e.message + "<br>";
        }

        res.send(msg + "<br><b>Pode voltar e tentar salvar a apólice novamente!</b>");
    } catch (e) {
        res.status(500).send("Erro fatal: " + e.message);
    }
});

// ==================================================
// 🕵️ ROTA DIAGNÓSTICO + CORREÇÃO AUTOMÁTICA
// ==================================================
app.get('/diagnostico-banco', async (req, res) => {
    try {
        // 1. Pergunta ao banco quais colunas existem DE VERDADE
        const [cols] = await pool.query("SHOW COLUMNS FROM apolices");
        const colunasExistentes = cols.map(c => c.Field);
        
        let html = "<h2>🕵️ Relatório do Banco de Dados (Render)</h2>";
        html += "<p><strong>Colunas encontradas na tabela 'apolices':</strong><br>" + colunasExistentes.join(", ") + "</p>";
        
        // 2. Verifica se 'premio_liquido' existe
        if (!colunasExistentes.includes('premio_liquido')) {
            html += "<p style='color:red'>🔴 ERRO: A coluna 'premio_liquido' NÃO existe neste banco.</p>";
            html += "<p>🛠️ Tentando corrigir agora...</p>";
            try {
                await pool.query("ALTER TABLE apolices ADD COLUMN premio_liquido DECIMAL(10,2) DEFAULT 0.00");
                html += "<p style='color:green'>✅ SUCESSO: Coluna 'premio_liquido' foi criada!</p>";
            } catch (err) {
                html += "<p style='color:red'>❌ FALHA ao criar: " + err.message + "</p>";
            }
        } else {
            html += "<p style='color:green'>🟢 A coluna 'premio_liquido' já existe. (Estranho dar erro, verifique nomes)</p>";
        }

        // 3. Verifica se 'franquia_casco' existe
        if (!colunasExistentes.includes('franquia_casco')) {
            html += "<p style='color:red'>🔴 ERRO: A coluna 'franquia_casco' NÃO existe neste banco.</p>";
            html += "<p>🛠️ Tentando corrigir agora...</p>";
            try {
                await pool.query("ALTER TABLE apolices ADD COLUMN franquia_casco DECIMAL(10,2) DEFAULT 0.00");
                html += "<p style='color:green'>✅ SUCESSO: Coluna 'franquia_casco' foi criada!</p>";
            } catch (err) {
                html += "<p style='color:red'>❌ FALHA ao criar: " + err.message + "</p>";
            }
        } else {
            html += "<p style='color:green'>🟢 A coluna 'franquia_casco' já existe.</p>";
        }

        res.send(html + "<br><button onclick='window.location.reload()'>🔄 Verificar Novamente</button>");
    } catch (e) {
        res.status(500).send("❌ Erro fatal ao conectar no banco: " + e.message);
    }
});

// ==================================================
// 🚑 ROTA DE CORREÇÃO TOTAL (Adiciona numero_proposta e outras)
// ==================================================
app.get('/fix-banco-final', async (req, res) => {
    try {
        let log = "<h2>🛠️ Atualizando Banco de Dados...</h2>";

        // 1. Tenta criar 'numero_proposta' (O erro atual)
        try {
            // Adiciona como VARCHAR (texto) pois pode ter letras/hifens
            await pool.query("ALTER TABLE apolices ADD COLUMN numero_proposta VARCHAR(100) DEFAULT NULL");
            log += "<p style='color:green'>✅ Coluna <b>'numero_proposta'</b> criada com sucesso!</p>";
        } catch (e) {
            log += `<p style='color:orange'>⚠️ 'numero_proposta': ${e.message} (Talvez já exista)</p>`;
        }

        // 2. Reforça a criação das anteriores (caso tenha falhado antes)
        try {
            await pool.query("ALTER TABLE apolices ADD COLUMN premio_liquido DECIMAL(10,2) DEFAULT 0.00");
            log += "<p style='color:green'>✅ Coluna <b>'premio_liquido'</b> criada.</p>";
        } catch (e) {} // Ignora erro se já existir

        try {
            await pool.query("ALTER TABLE apolices ADD COLUMN franquia_casco DECIMAL(10,2) DEFAULT 0.00");
            log += "<p style='color:green'>✅ Coluna <b>'franquia_casco'</b> criada.</p>";
        } catch (e) {} // Ignora erro se já existir

        res.send(log + "<br><a href='/dashboard.html'>VOLTAR PARA O DASHBOARD</a>");
    } catch (e) {
        res.status(500).send("❌ Erro Crítico: " + e.message);
    }
});

app.listen(port, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 SERVIDOR RODANDO NA PORTA ${port}`);
    console.log(`==================================================\n`);
});