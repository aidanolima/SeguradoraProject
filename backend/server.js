// backend/server.js - VERSÃO FINAL CORRIGIDA (SEM DUPLICATAS E SQL CORRIGIDO)

const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mysql = require('mysql2/promise');
const multer = require('multer');
const pdf = require('pdf-extraction');
const jwt = require('jsonwebtoken');

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// --- CONFIGURAÇÃO DA CHAVE SECRETA ---
const JWT_SECRET = 'seguradora_chave_secreta_super_segura_2024';

// --- CONFIGURAÇÃO MULTER (MEMÓRIA RAM - Para leitura de PDF) ---
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json());

// --- CONFIGURAÇÃO DE UPLOAD (DISCO - Para salvar arquivo) ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

const storageDisk = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname)
    }
});
const uploadSave = multer({ storage: storageDisk });

// TORNAR A PASTA 'UPLOADS' PÚBLICA
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- CONEXÃO BANCO DE DADOS ---
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '054622', 
    database: process.env.DB_NAME || 'seguradoraauto',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

pool.getConnection()
    .then(() => console.log("✅ MySQL Conectado com Sucesso!"))
    .catch(e => console.error("❌ Erro MySQL:", e.message));


// ==========================================
// MIDDLEWARE DE AUTENTICAÇÃO
// ==========================================
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

// ==========================================
// 1. ROTAS GERAIS E AUTH
// ==========================================

// ROTA DE BOAS-VINDAS (RAIZ)
app.get('/', (req, res) => {
    res.status(200).send('✅ API Seguradora funcionando 100%!');
});

// LOGIN
app.post('/auth/login', async (req, res) => {
    const { email, senha } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ? AND senha = ?', [email, senha]);
        
        if (rows.length > 0) {
            const user = rows[0];
            const token = jwt.sign(
                { id: user.id, email: user.email, tipo: user.tipo }, 
                JWT_SECRET, 
                { expiresIn: '8h' }
            );

            res.json({ 
                message: "OK", 
                token: token,
                user: { id: user.id, nome: user.nome, email: user.email, tipo: user.tipo } 
            });
        } else {
            res.status(401).json({ message: "Login inválido" });
        }
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// REGISTRO
app.post('/auth/register', async (req, res) => {
    const { nome, email, senha, tipo } = req.body;
    const tipoFinal = tipo || 'operacional'; 

    try {
        const [userExists] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
        if (userExists.length > 0) {
            return res.status(400).json({ message: "E-mail já cadastrado!" });
        }

        const sql = 'INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)';
        const [result] = await pool.query(sql, [nome, email, senha, tipoFinal]);
        
        res.status(201).json({ message: "Usuário criado com sucesso!", id: result.insertId });

    } catch (error) {
        res.status(500).json({ message: "Erro ao criar conta: " + error.message });
    }
});

// RECUPERAR SENHA (SIMULADO)
app.post('/auth/forgot-password', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "O e-mail é obrigatório." });
    return res.status(200).json({ message: "Instruções enviadas! Verifique sua caixa de entrada (Simulação)." });
});

// ==========================================
// 2. ROTAS DE USUÁRIOS
// ==========================================

app.get('/usuarios', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, nome, email, tipo FROM usuarios');
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/usuarios/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query('SELECT id, nome, email, tipo FROM usuarios WHERE id = ?', [id]);
        if (rows.length > 0) res.json(rows[0]);
        else res.status(404).json({ message: "Usuário não encontrado" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/usuarios/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { nome, email, tipo, senha } = req.body;
    try {
        let sql, params;
        if (senha && senha.trim() !== '') {
            sql = 'UPDATE usuarios SET nome = ?, email = ?, tipo = ?, senha = ? WHERE id = ?';
            params = [nome, email, tipo, senha, id];
        } else {
            sql = 'UPDATE usuarios SET nome = ?, email = ?, tipo = ? WHERE id = ?';
            params = [nome, email, tipo, id];
        }
        await pool.query(sql, params);
        res.json({ message: "Usuário atualizado com sucesso" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// EXCLUIR USUÁRIO (CORRIGIDO)
app.delete('/usuarios/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        // Usa ? para MySQL
        await pool.query('DELETE FROM usuarios WHERE id = ?', [id]);
        res.status(200).json({ message: 'Usuário excluído com sucesso' });
    } catch (error) {
        console.error("Erro ao excluir usuário:", error);
        res.status(500).json({ message: 'Erro ao excluir usuário' });
    }
});

// ==========================================
// 3. ROTAS DE PDF (EXTRAÇÃO E DOWNLOAD)
// ==========================================

// Importar PDF (Ler dados)
app.post('/importar-pdf', upload.single('pdf'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "Nenhum arquivo." });
    try {
        const dataBuffer = req.file.buffer; 
        const data = await pdf(dataBuffer);
        const text = data.text;

        const datas = text.match(/\d{2}\/\d{2}\/\d{4}/g) || [];
        const valores = text.match(/R\$\s?[\d\.,]+/g) || [];
        const placaMatch = text.match(/[A-Z]{3}[-]?[0-9][A-Z0-9][0-9]{2}/);

        res.json({
            datas: datas,
            valores: valores,
            placa: placaMatch ? placaMatch[0] : null
        });
    } catch (error) { res.status(500).json({ message: "Erro ao ler PDF" }); }
});

// Baixar PDF (Visualizar) - CORRIGIDO
app.get('/apolices/:id/pdf', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query('SELECT arquivo_pdf FROM apolices WHERE id = ?', [id]);
        
        if (rows.length === 0 || !rows[0].arquivo_pdf) {
            return res.status(404).json({ message: 'Apólice não possui PDF vinculado.' });
        }

        const filename = rows[0].arquivo_pdf;
        // Se o caminho salvo no banco já tiver "uploads/", removemos para evitar duplicar no path.join
        const cleanFilename = filename.replace('uploads/', '').replace('uploads\\', '');
        const filePath = path.join(__dirname, 'uploads', cleanFilename);

        if (fs.existsSync(filePath)) {
            res.sendFile(filePath);
        } else {
            console.error("Arquivo físico não encontrado:", filePath);
            res.status(404).json({ message: 'Arquivo não encontrado no servidor.' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar PDF.' });
    }
});

// ==========================================
// 4. ROTAS DE APÓLICES
// ==========================================

app.post('/cadastrar-apolice', uploadSave.single('arquivo_pdf'), async (req, res) => {
    const d = req.body;
    const file = req.file; 
    try {
        const caminhoArquivo = file ? file.filename : null; // Salva só o nome do arquivo

        const sql = `INSERT INTO apolices 
            (numero_apolice, numero_proposta, veiculo_id, vigencia_inicio, vigencia_fim, premio_liquido, premio_total, franquia_casco, arquivo_pdf) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const params = [
            d.numero_apolice, d.numero_proposta, d.veiculo_id, 
            d.vigencia_inicio || null, d.vigencia_fim || null, 
            d.premio_liquido || 0, d.premio_total || 0, d.franquia_casco || 0,
            caminhoArquivo
        ];

        const [result] = await pool.query(sql, params);
        res.status(201).json({ message: "Apólice salva com sucesso!", id: result.insertId });
    } catch (error) { res.status(500).json({ error: "Erro ao salvar no banco: " + error.message }); }
});

app.get('/apolices', async (req, res) => {
    try {
        const query = `
            SELECT a.*, p.nome as cliente_nome, p.placa as veiculo_placa
            FROM apolices a
            LEFT JOIN propostas p ON a.veiculo_id = p.id
            ORDER BY a.id DESC
        `;
        const [rows] = await pool.query(query);
        const formatado = rows.map(r => ({
            ...r,
            cliente: r.cliente_nome || 'Cliente Excluído',
            placa: r.veiculo_placa || 'S/Placa'
        }));
        res.json(formatado);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/apolices/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM apolices WHERE id = ?', [id]);
        if (rows.length > 0) res.json(rows[0]);
        else res.status(404).json({ message: "Apólice não encontrada" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// EXCLUIR APÓLICE (CORRIGIDO)
app.delete('/apolices/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        // Usa ? para MySQL
        await pool.query('DELETE FROM apolices WHERE id = ?', [id]);
        res.status(200).json({ message: 'Apólice excluída com sucesso' });
    } catch (error) {
        console.error("Erro ao excluir apólice:", error);
        res.status(500).json({ message: 'Erro ao excluir apólice' });
    }
});

// ==========================================
// 5. ROTAS DE PROPOSTAS/CLIENTES
// ==========================================

app.post('/cadastrar-proposta', async (req, res) => {
    const d = req.body;
    const blindado = d.blindado ? 1 : 0;
    const kit_gas = d.kit_gas ? 1 : 0;
    const zero_km = d.zero_km ? 1 : 0;

    const sql = `
        INSERT INTO propostas (
            nome, documento, email, telefone, 
            cep, endereco, bairro, cidade, uf, numero, complemento,
            fabricante, modelo, placa, chassi, ano_modelo, fipe, utilizacao,
            blindado, kit_gas, zero_km, cep_pernoite,
            cobertura_casco, carro_reserva, forma_pagamento
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
        d.nome, d.documento, d.email, d.telefone,
        d.cep, d.endereco, d.bairro, d.cidade, d.uf, d.numero, d.complemento,
        d.fabricante, d.modelo, d.placa, d.chassi, d.ano_modelo, d.fipe, d.utilizacao,
        blindado, kit_gas, zero_km, d.cep_pernoite,
        d.cobertura_casco, d.carro_reserva, d.forma_pagamento
    ];

    try {
        const [result] = await pool.query(sql, params);
        res.status(201).json({ message: "Proposta cadastrada com sucesso!", id: result.insertId });
    } catch (error) { res.status(500).json({ message: "Erro ao salvar no banco: " + error.message }); }
});

app.get('/propostas', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM propostas ORDER BY id DESC');
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/propostas/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM propostas WHERE id = ?', [req.params.id]);
        if (rows.length > 0) res.json(rows[0]);
        else res.status(404).json({ message: "Proposta não encontrada" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/propostas/:id', async (req, res) => {
    const { id } = req.params;
    const d = req.body;
    const blindado = d.blindado ? 1 : 0;
    const kit_gas = d.kit_gas ? 1 : 0;
    const zero_km = d.zero_km ? 1 : 0;

    const sql = `
        UPDATE propostas SET
            nome=?, documento=?, email=?, telefone=?, 
            cep=?, endereco=?, bairro=?, cidade=?, uf=?, numero=?, complemento=?,
            fabricante=?, modelo=?, placa=?, chassi=?, ano_modelo=?, fipe=?, utilizacao=?,
            blindado=?, kit_gas=?, zero_km=?, cep_pernoite=?,
            cobertura_casco=?, carro_reserva=?, forma_pagamento=?
        WHERE id = ?
    `;

    const params = [
        d.nome, d.documento, d.email, d.telefone,
        d.cep, d.endereco, d.bairro, d.cidade, d.uf, d.numero, d.complemento,
        d.fabricante, d.modelo, d.placa, d.chassi, d.ano_modelo, d.fipe, d.utilizacao,
        blindado, kit_gas, zero_km, d.cep_pernoite,
        d.cobertura_casco, d.carro_reserva, d.forma_pagamento,
        id
    ];

    try {
        await pool.query(sql, params);
        res.json({ message: "Proposta atualizada com sucesso!" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// EXCLUIR PROPOSTA / CLIENTE (CORRIGIDO)
app.delete('/propostas/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        // 1. Apaga Apólices vinculadas primeiro (para evitar erro de chave estrangeira)
        // Usa ? para MySQL
        await pool.query('DELETE FROM apolices WHERE veiculo_id = ?', [id]);
        
        // 2. Apaga o Cliente
        const [result] = await pool.query('DELETE FROM propostas WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Cliente não encontrado para exclusão' });
        }
        
        res.status(200).json({ message: 'Cliente e suas apólices excluídos com sucesso' });
    } catch (error) {
        console.error("Erro ao excluir proposta:", error);
        res.status(500).json({ message: 'Erro interno ao excluir cliente' });
    }
});

// ==========================================
// 6. RELATÓRIOS
// ==========================================
app.get('/relatorios', authenticateToken, async (req, res) => {
    try {
        const { inicio, fim, status, busca } = req.query;
        let sql = `
            SELECT p.id, p.nome, p.email, a.vigencia_inicio as data_cadastro, 
                COALESCE(a.premio_total, 0) as valor,
                CASE WHEN a.id IS NOT NULL THEN 'ativo' ELSE 'pendente' END as status
            FROM propostas p
            LEFT JOIN apolices a ON a.veiculo_id = p.id
            WHERE 1=1
        `;
        const params = [];
        if (busca) {
            sql += ` AND (p.nome LIKE ? OR p.email LIKE ?)`;
            params.push(`%${busca}%`, `%${busca}%`);
        }
        if (status) {
            if (status === 'ativo') sql += ` AND a.id IS NOT NULL`;
            else if (status === 'pendente') sql += ` AND a.id IS NULL`;
        }
        if (inicio) { sql += ` AND a.vigencia_inicio >= ?`; params.push(inicio); }
        if (fim) { sql += ` AND a.vigencia_inicio <= ?`; params.push(fim); }

        sql += ` ORDER BY p.id DESC`;
        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.listen(port, () => console.log(`🚀 Servidor rodando na porta ${port}`));