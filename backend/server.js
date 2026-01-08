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
// Segurança: Tenta pegar do .env, se não existir, usa a fixa
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
// 📂 UPLOAD
// ==================================================
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storageDisk = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
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

const safeCurrency = (value) => {
    if (!value || value === '') return 0;
    if (typeof value === 'number') return value;
    const clean = value.toString().replace(/[R$\s.]/g, '').replace(',', '.');
    const number = parseFloat(clean);
    return isNaN(number) ? 0 : number;
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
    try {
        const [rows] = await pool.query('SELECT id, nome, email, tipo FROM usuarios');
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/usuarios/:id', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, nome, email, tipo FROM usuarios WHERE id = ?', [req.params.id]);
        if (rows.length > 0) res.json(rows[0]);
        else res.status(404).json({ message: "Usuário não encontrado." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/usuarios/:id', authenticateToken, async (req, res) => {
    try {
        const { nome, email, senha, tipo } = req.body;
        if (senha && senha.trim() !== "") {
            await pool.query('UPDATE usuarios SET nome=?, email=?, senha=?, tipo=? WHERE id=?', 
                [nome, email, senha, tipo, req.params.id]);
        } else {
            await pool.query('UPDATE usuarios SET nome=?, email=?, tipo=? WHERE id=?', 
                [nome, email, tipo, req.params.id]);
        }
        res.json({ message: "Usuário atualizado com sucesso!" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/usuarios/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM usuarios WHERE id = ?', [req.params.id]);
        res.json({ message: "Excluído" });
    } catch (e) { res.status(500).json({ error: e.message }); }
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

        res.json({
            apolices: resApolices[0].total, usuarios: resUsuarios[0].total,
            veiculos: resVeiculos[0].total, clientes: resClientes[0].total
        });
    } catch (e) { res.status(500).json({ message: "Erro stats" }); }
});

// ==================================================
// 📝 PROPOSTAS / CLIENTES (ATUALIZADO PARA CADASTRO COMPLETO)
// ==================================================

// 1. Listar
app.get('/propostas', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM propostas ORDER BY id DESC');
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. Buscar por ID (IMPORTANTE para edição)
app.get('/propostas/:id', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM propostas WHERE id = ?', [req.params.id]);
        if (rows.length > 0) res.json(rows[0]);
        else res.status(404).json({ message: "Cliente não encontrado." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. Cadastrar (Com todos os campos do novo formulário)
app.post('/cadastrar-proposta', authenticateToken, async (req, res) => {
    try {
        const d = req.body;
        // Query expandida para incluir CEP, Endereço, Chassi, etc.
        const sql = `INSERT INTO propostas (
            nome, documento, email, telefone, placa, modelo, 
            cep, endereco, bairro, cidade, uf, numero, complemento,
            fabricante, chassi, ano_modelo, fipe, utilizacao,
            blindado, kit_gas, zero_km, cep_pernoite,
            cobertura_casco, carro_reserva, forma_pagamento
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
        
        await pool.query(sql, [
            d.nome, d.documento, d.email, d.telefone, d.placa, d.modelo,
            d.cep, d.endereco, d.bairro, d.cidade, d.uf, d.numero, d.complemento,
            d.fabricante, d.chassi, d.ano_modelo, d.fipe, d.utilizacao,
            d.blindado, d.kit_gas, d.zero_km, d.cep_pernoite,
            d.cobertura_casco, d.carro_reserva, d.forma_pagamento
        ]);
        res.status(201).json({ message: "Cliente cadastrado com sucesso!" });
    } catch(e) { res.status(500).json({message: e.message}); }
});

// 4. Editar (Com todos os campos)
app.put('/propostas/:id', authenticateToken, async (req, res) => {
    try {
        const d = req.body;
        const sql = `UPDATE propostas SET 
            nome=?, documento=?, email=?, telefone=?, placa=?, modelo=?, 
            cep=?, endereco=?, bairro=?, cidade=?, uf=?, numero=?, complemento=?,
            fabricante=?, chassi=?, ano_modelo=?, fipe=?, utilizacao=?,
            blindado=?, kit_gas=?, zero_km=?, cep_pernoite=?,
            cobertura_casco=?, carro_reserva=?, forma_pagamento=?
            WHERE id=?`;

        await pool.query(sql, [
            d.nome, d.documento, d.email, d.telefone, d.placa, d.modelo,
            d.cep, d.endereco, d.bairro, d.cidade, d.uf, d.numero, d.complemento,
            d.fabricante, d.chassi, d.ano_modelo, d.fipe, d.utilizacao,
            d.blindado, d.kit_gas, d.zero_km, d.cep_pernoite,
            d.cobertura_casco, d.carro_reserva, d.forma_pagamento,
            req.params.id
        ]);
        res.json({ message: "Cliente atualizado com sucesso!" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 5. Excluir
app.delete('/propostas/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM propostas WHERE id = ?', [req.params.id]);
        res.json({ message: "Proposta excluída" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================================================
// 📄 APÓLICES
// ==================================================
app.get('/apolices', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT a.*, p.nome as cliente_nome, p.placa as veiculo_placa FROM apolices a LEFT JOIN propostas p ON a.veiculo_id = p.id ORDER BY a.id DESC`);
        const fmt = rows.map(r => ({...r, cliente: r.cliente_nome || 'Excluído', placa: r.veiculo_placa || 'S/Placa'}));
        res.json(fmt);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/apolices/:id', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM apolices WHERE id = ?', [req.params.id]);
        if (rows.length > 0) res.json(rows[0]);
        else res.status(404).json({ message: "Não encontrado" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/cadastrar-apolice', authenticateToken, uploadSave.single('arquivo_pdf'), async (req, res) => {
    try {
        const d = req.body;
        const f = req.file ? req.file.filename : null;
        await pool.query(`INSERT INTO apolices (numero_apolice, veiculo_id, arquivo_pdf, premio_total, premio_liquido, franquia_casco, vigencia_inicio, vigencia_fim, numero_proposta) VALUES (?,?,?,?,?,?,?,?,?)`, 
            [d.numero_apolice, d.veiculo_id, f, safeCurrency(d.premio_total), safeCurrency(d.premio_liquido), safeCurrency(d.franquia_casco), d.vigencia_inicio || null, d.vigencia_fim || null, d.numero_proposta]);
        res.status(201).json({message: "Criado"});
    } catch(e) { res.status(500).json({message: e.message}); }
});

app.put('/apolices/:id', authenticateToken, async (req, res) => {
    try {
        const d = req.body;
        await pool.query(`UPDATE apolices SET numero_apolice=?, numero_proposta=?, veiculo_id=?, premio_total=?, premio_liquido=?, franquia_casco=?, vigencia_inicio=?, vigencia_fim=? WHERE id=?`, 
            [d.numero_apolice, d.numero_proposta, d.veiculo_id, d.premio_total, d.premio_liquido, d.franquia_casco, d.vigencia_inicio || null, d.vigencia_fim || null, req.params.id]);
        res.status(200).json({ message: "Atualizado" });
    } catch(e) { res.status(500).json({ message: e.message }); }
});

app.delete('/apolices/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM apolices WHERE id = ?', [req.params.id]);
        res.json({ message: "Apólice excluída" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================================================
// ⚡ IMPORTAR PDF
// ==================================================
function extrairGenerico(texto) {
    const dados = {};
    const matchApolice = texto.match(/(?:Apólice|Contrato|Certificado)[:\s]*([\d\.-]{5,})/i);
    if (matchApolice) dados.numero_apolice = matchApolice[1].replace(/[^0-9]/g, '');
    else { const ml = texto.match(/\b\d{15,25}\b/); if(ml) dados.numero_apolice = ml[0]; }

    const matchProposta = texto.match(/(?:Proposta|Item|Orçamento)[:\s]*([\d\.-]{5,})/i);
    if (matchProposta) dados.numero_proposta = matchProposta[1].replace(/[^0-9]/g, '');

    const matchPlaca = texto.match(/[A-Z]{3}[-\s]?[0-9][0-9A-Z][0-9]{2}/i);
    if (matchPlaca) dados.placa = matchPlaca[0].replace(/[-\s]/g, '').toUpperCase();

    const regexDinheiro = /(?:R\$\s*)?(\d{1,3}(?:[\.\s]\d{3})*,\d{2})/g;
    const valoresRaw = texto.match(regexDinheiro) || [];
    const valoresFloat = valoresRaw.map(v => parseFloat(v.replace(/[^0-9,]/g, '').replace(',', '.')));
    
    if (valoresFloat.length > 0) {
        const possiveis = valoresFloat.filter(v => v < 200000); 
        dados.premio_total = (possiveis.length > 0 ? Math.max(...possiveis) : Math.max(...valoresFloat)).toFixed(2);
    }
    return dados;
}

function extrairBradesco(texto) {
    const dados = extrairGenerico(texto);
    const matchTotal = texto.match(/Total(?:[\s\w\.]*?)(?:R\$\s*)?(\d{1,3}(?:[\.\s]\d{3})*,\d{2})/i);
    if (matchTotal) dados.premio_total = matchTotal[1].replace(/[^0-9,]/g, '').replace(',', '.');
    const matchFranquia = texto.match(/(?:Franquia|Participação)(?:[\s\w\.]*?)(?:R\$\s*)?(\d{1,3}(?:[\.\s]\d{3})*,\d{2})/i);
    if (matchFranquia) dados.franquia_casco = matchFranquia[1].replace(/[^0-9,]/g, '').replace(',', '.');
    return dados;
}

app.post('/importar-pdf', authenticateToken, uploadSave.single('arquivoPdf'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "Sem arquivo." });
        const dataBuffer = fs.readFileSync(req.file.path);
        const data = await pdf(dataBuffer);
        const texto = data.text.replace(/\s+/g, ' '); 

        let dadosFinais = {};
        if (texto.match(/Bradesco/i)) dadosFinais = extrairBradesco(texto);
        else dadosFinais = extrairGenerico(texto);

        // Datas
        const regexDatas = /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/g;
        let matchData;
        const datas = [];
        while ((matchData = regexDatas.exec(texto)) !== null) {
            const ano = parseInt(matchData[3]);
            if (ano > 2000 && ano < 2040) datas.push(`${ano}-${matchData[2]}-${matchData[1]}`);
        }
        datas.sort();
        if (datas.length > 0) {
            dadosFinais.vigencia_inicio = datas[0];
            dadosFinais.vigencia_fim = datas.length > 1 ? datas[datas.length - 1] : '';
        }
        
        console.log("✅ PDF Lido:", dadosFinais);
        res.json({ mensagem: "Sucesso", dados: dadosFinais });
    } catch (e) { console.error(e); res.status(500).json({message: "Erro PDF"}); }
});

// ==================================================
// 🚀 INICIALIZAÇÃO
// ==================================================
app.listen(port, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 SERVIDOR RODANDO NA PORTA ${port}`);
    console.log(`==================================================\n`);
});