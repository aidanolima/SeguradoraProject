// backend/server.js - VERSÃO DE RESTORE (ESTÁVEL)

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

// --- 2. BANCO DE DADOS ---
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
    .catch(e => console.error("❌ Erro Conexão MySQL:", e.message));

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

// ROTA RAIZ (CRUCIAL PARA EVITAR O ERRO 404)
app.get('/', (req, res) => {
    res.status(200).send('API Online e Funcionando! 🚀');
});

// LOGIN
app.post('/auth/login', async (req, res) => {
    console.log(`[LOGIN] Tentativa: ${req.body.email}`);
    try {
        const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ? AND senha = ?', [req.body.email, req.body.senha]);
        if (rows.length > 0) {
            const user = rows[0];
            // Garante que o tipo exista no token, mesmo se for null no banco
            const tipoUser = user.tipo || 'operacional';
            const token = jwt.sign({ id: user.id, email: user.email, tipo: tipoUser }, JWT_SECRET, { expiresIn: '8h' });
            
            res.json({ message: "OK", token, user: { id: user.id, nome: user.nome, email: user.email, tipo: tipoUser } });
        } else {
            res.status(401).json({ message: "Login inválido" });
        }
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// RECUPERAR SENHA
app.post('/auth/forgot-password', (req, res) => {
    res.json({ message: "Solicitação recebida." });
});

// CRIAR USUÁRIO (SIMPLIFICADO PARA O RESTORE)
app.post('/auth/register', authenticateToken, async (req, res) => {
    // Mantive a trava básica de admin para evitar bagunça, mas sem lógica complexa
    // Se quiser liberar geral para teste, remova o IF abaixo
    if (req.user.tipo !== 'admin') {
         return res.status(403).json({ message: "Apenas admin cria usuários." });
    }
    
    try {
        const { nome, email, senha, tipo } = req.body;
        const [result] = await pool.query('INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)', [nome, email, senha, tipo || 'operacional']);
        res.status(201).json({ message: "Criado", id: result.insertId });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// LISTAGEM (VOLTANDO AO PADRÃO SEM FILTRO DE ID POR ENQUANTO)
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

// EXCLUSÕES (PADRÃO)
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

// CADASTROS E EDIÇÕES GERAIS
app.post('/cadastrar-proposta', async (req, res) => {
    try {
        const d = req.body;
        // Query genérica que estava funcionando
        const q = `INSERT INTO propostas (nome, documento, email, telefone, placa, modelo) VALUES (?,?,?,?,?,?)`;
        // Ajuste os campos conforme sua necessidade real se faltar algo, 
        // mas para RESTORE, o foco é o servidor subir.
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

// INICIALIZAÇÃO
app.listen(port, () => console.log(`🚀 Restore Completo. Servidor na porta ${port}`));