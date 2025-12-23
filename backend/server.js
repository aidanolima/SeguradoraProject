// backend/server.js - VERSÃO AIVEN (CORRIGIDA COM SSL)

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
const JWT_SECRET = 'seguradora_chave_secreta_super_segura_2024';

// --- 1. MIDDLEWARES ---
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url} - IP: ${req.ip}`);
    next();
});

app.use(cors());
app.use(express.json());

// Configuração de Upload
const storage = multer.memoryStorage();
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storageDisk = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const uploadSave = multer({ storage: storageDisk });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- 2. BANCO DE DADOS (CONFIGURAÇÃO AIVEN) ---
// Atenção: O SSL é obrigatório para Aiven.
// backend/server.js

const pool = mysql.createPool({
    host: process.env.DB_HOST,       
    user: process.env.DB_USER,       
    password: process.env.DB_PASSWORD, // <--- DEIXE ASSIM (SEM A SENHA ESCRITA)
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    ssl: {
        rejectUnauthorized: false
    },
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0
});

pool.getConnection()
    .then(conn => {
        console.log("✅ MySQL Aiven Conectado com Sucesso!");
        conn.release();
    })
    .catch(e => {
        console.error("❌ Erro Conexão MySQL:", e.message);
        console.error("   Verifique se o banco de dados 'defaultdb' contém as tabelas necessárias.");
    });

// --- 3. AUTENTICAÇÃO ---
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

// --- 4. ROTAS ---

// ROTA RAIZ
app.get('/', (req, res) => {
    res.status(200).send('API Aiven Online! 🚀');
});

// LOGIN
app.post('/auth/login', async (req, res) => {
    console.log(`[LOGIN] Tentativa: ${req.body.email}`);
    try {
        // Verifica se a tabela usuarios existe primeiro
        const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ? AND senha = ?', [req.body.email, req.body.senha]);
        if (rows.length > 0) {
            const user = rows[0];
            const tipoUser = user.tipo || 'operacional';
            const token = jwt.sign({ id: user.id, email: user.email, tipo: tipoUser }, JWT_SECRET, { expiresIn: '8h' });
            
            res.json({ message: "OK", token, user: { id: user.id, nome: user.nome, email: user.email, tipo: tipoUser } });
        } else {
            res.status(401).json({ message: "Login inválido" });
        }
    } catch (error) { 
        console.error("Erro no Login:", error.message);
        res.status(500).json({ error: "Erro interno no servidor (Banco de Dados)." }); 
    }
});

// CRIAR USUÁRIO (RESTORE - ABERTO PARA RECUPERAÇÃO INICIAL, DEPOIS PODE FECHAR)
app.post('/auth/register', authenticateToken, async (req, res) => {
    if (req.user.tipo !== 'admin') {
         return res.status(403).json({ message: "Apenas admin cria usuários." });
    }
    
    try {
        const { nome, email, senha, tipo } = req.body;
        const [result] = await pool.query('INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)', [nome, email, senha, tipo || 'operacional']);
        res.status(201).json({ message: "Criado", id: result.insertId });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// LISTAGEM USUÁRIOS
app.get('/usuarios', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, nome, email, tipo FROM usuarios');
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/propostas', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM propostas ORDER BY id DESC');
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/apolices', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT a.*, p.nome as cliente_nome, p.placa as veiculo_placa FROM apolices a LEFT JOIN propostas p ON a.veiculo_id = p.id ORDER BY a.id DESC`);
        const fmt = rows.map(r => ({...r, cliente: r.cliente_nome || 'Excluído', placa: r.veiculo_placa || 'S/Placa'}));
        res.json(fmt);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// EXCLUSÕES
app.delete('/usuarios/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM usuarios WHERE id = ?', [req.params.id]);
        res.status(200).json({ message: 'Excluído' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/propostas/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM apolices WHERE veiculo_id = ?', [req.params.id]);
        await pool.query('DELETE FROM propostas WHERE id = ?', [req.params.id]);
        res.status(200).json({ message: 'Excluído' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/apolices/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM apolices WHERE id = ?', [req.params.id]);
        res.status(200).json({ message: 'Excluído' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// CADASTROS
app.post('/cadastrar-proposta', async (req, res) => {
    try {
        const d = req.body;
        const q = `INSERT INTO propostas (nome, documento, email, telefone, placa, modelo) VALUES (?,?,?,?,?,?)`;
        const [r] = await pool.query(q, [d.nome, d.documento, d.email, d.telefone, d.placa, d.modelo]);
        res.status(201).json({ message: "Criado", id: r.insertId });
    } catch(e) { res.status(500).json({message: e.message}); }
});

app.post('/cadastrar-apolice', uploadSave.single('arquivo_pdf'), async (req, res) => {
    try {
        const d = req.body;
        const f = req.file ? req.file.filename : null;
        await pool.query(`INSERT INTO apolices (numero_apolice, veiculo_id, arquivo_pdf, premio_total) VALUES (?,?,?,?)`, 
            [d.numero_apolice, d.veiculo_id, f, d.premio_total]);
        res.status(201).json({message: "Criado"});
    } catch(e) { res.status(500).json({message: e.message}); }
});

// PDF
app.get('/apolices/:id/pdf', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT arquivo_pdf FROM apolices WHERE id = ?', [req.params.id]);
        if (rows.length === 0 || !rows[0].arquivo_pdf) return res.status(404).json({ message: 'Sem PDF.' });
        const cleanName = rows[0].arquivo_pdf.replace(/^uploads[\\\/]/, '');
        const filePath = path.join(__dirname, 'uploads', cleanName);
        if (fs.existsSync(filePath)) res.sendFile(filePath);
        else res.status(404).json({ message: 'Arquivo não encontrado.' });
    } catch (e) { res.status(500).json({ message: 'Erro PDF' }); }
});

// --- ROTA TEMPORÁRIA PARA CRIAR O BANCO ---
app.get('/instalar-banco', async (req, res) => {
    try {
        // 1. Criar Tabela Usuários
        await pool.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nome VARCHAR(100),
                email VARCHAR(100) UNIQUE,
                senha VARCHAR(255),
                tipo VARCHAR(20) DEFAULT 'operacional'
            )
        `);

        // 2. Criar Admin Padrão (Se não existir)
        const [users] = await pool.query("SELECT * FROM usuarios WHERE email = 'admin@sistema.com'");
        if (users.length === 0) {
            await pool.query(`INSERT INTO usuarios (nome, email, senha, tipo) VALUES ('Administrador', 'admin@sistema.com', '123456', 'admin')`);
        }

        // 3. Criar Tabela Propostas
        await pool.query(`
            CREATE TABLE IF NOT EXISTS propostas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nome VARCHAR(100),
                documento VARCHAR(20),
                email VARCHAR(100),
                telefone VARCHAR(20),
                cep VARCHAR(20),
                endereco VARCHAR(255),
                bairro VARCHAR(100),
                cidade VARCHAR(100),
                uf VARCHAR(2),
                numero VARCHAR(20),
                complemento VARCHAR(100),
                fabricante VARCHAR(50),
                modelo VARCHAR(50),
                placa VARCHAR(10),
                chassi VARCHAR(50),
                ano_modelo VARCHAR(10),
                fipe VARCHAR(20),
                utilizacao VARCHAR(50),
                blindado BOOLEAN,
                kit_gas BOOLEAN,
                zero_km BOOLEAN,
                cep_pernoite VARCHAR(20),
                cobertura_casco VARCHAR(50),
                carro_reserva VARCHAR(50),
                forma_pagamento VARCHAR(50)
            )
        `);

        // 4. Criar Tabela Apólices
        await pool.query(`
            CREATE TABLE IF NOT EXISTS apolices (
                id INT AUTO_INCREMENT PRIMARY KEY,
                numero_apolice VARCHAR(50),
                veiculo_id INT,
                arquivo_pdf VARCHAR(255),
                premio_total DECIMAL(10,2),
                vigencia_inicio DATE,
                vigencia_fim DATE
            )
        `);

        res.send('✅ Sucesso! Tabelas criadas e Admin (admin@sistema.com / 123456) pronto.');
    } catch (error) {
        res.status(500).send('Erro ao criar tabelas: ' + error.message);
    }
});

// INICIALIZAÇÃO
app.listen(port, () => console.log(`🚀 Servidor Aiven rodando na porta ${port}`));