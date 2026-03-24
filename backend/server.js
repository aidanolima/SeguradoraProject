require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const pdf = require('pdf-extraction');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const { Resend } = require('resend');

const app = express();

// ==================================================
// 🛡️ MIDDLEWARES (Essenciais no topo!)
// ==================================================
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

const port = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'seguradora_chave_secreta_super_segura_2024';

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
    connectionLimit: 5
});

// ==================================================
// 📧 CONFIGURAÇÃO DO RESEND
// ==================================================
const resend = new Resend(process.env.RESEND_API_KEY);

// ==================================================
// ☁️ CONFIGURAÇÃO S3 (AWS)
// ==================================================
let uploadS3, uploadMemory, uploadPerfilS3, s3Client; 
const hasAwsKeys = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_BUCKET_NAME;

if (hasAwsKeys) {
    try {
        s3Client = new S3Client({
            region: process.env.AWS_REGION || 'us-east-1',
            credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY }
        });
        uploadS3 = multer({ storage: multerS3({ s3: s3Client, bucket: process.env.AWS_BUCKET_NAME, contentType: multerS3.AUTO_CONTENT_TYPE, key: (req, file, cb) => cb(null, Date.now().toString() + '-' + file.originalname.replace(/\s+/g, '-')) }) });
        uploadPerfilS3 = multer({ storage: multerS3({ s3: s3Client, bucket: process.env.AWS_BUCKET_NAME, contentType: multerS3.AUTO_CONTENT_TYPE, acl: 'public-read', key: (req, file, cb) => cb(null, `seguradora-auto/perfil/${Date.now()}-${file.originalname}`) }) });
        uploadMemory = multer({ storage: multer.memoryStorage() });
    } catch (err) { usarArmazenamentoLocal(); }
} else { usarArmazenamentoLocal(); }

function usarArmazenamentoLocal() {
    const storageDisk = multer.diskStorage({ destination: (req, file, cb) => { const dir = 'uploads/'; if (!fs.existsSync(dir)) fs.mkdirSync(dir); cb(null, dir); }, filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname) });
    uploadS3 = uploadPerfilS3 = uploadMemory = multer({ storage: storageDisk });
}

// ==================================================
// 🔐 HELPERS & AUTH
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
const isMasterUser = (tipo) => (tipo === 'admin' || tipo === 'ti');

// ==================================================
// 🔑 ROTAS DE RECUPERAÇÃO DE SENHA (RESEND)
// ==================================================

app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const token = crypto.randomBytes(20).toString('hex');
        // O link no email aponta para a URL do seu frontend
        const resetLink = `https://gestaoclienteseapolices.com.br/redefinir-senha.html?token=${token}&email=${email}`;

        await resend.emails.send({
            from: 'Gestão de Apólices <onboarding@resend.dev>',
            to: [email],
            subject: 'Recuperação de Senha - Gestão de Apólices',
            html: `<div style="font-family: sans-serif; padding: 20px;">
                    <h2>Recuperação de Senha</h2>
                    <p>Clique no botão para redefinir:</p>
                    <a href="${resetLink}" style="padding: 10px 20px; background: #00a86b; color: white; text-decoration: none; border-radius: 5px;">Redefinir Senha</a>
                   </div>`
        });
        res.status(200).json({ message: 'E-mail enviado!' });
    } catch (err) { res.status(500).json({ message: 'Erro no servidor' }); }
});

// A ROTA QUE ESTAVA DANDO 404:
app.post('/reset-password', async (req, res) => {
    const { email, novaSenha } = req.body;
    console.log(`🔑 Atualizando senha para: ${email}`);
    try {
        const [result] = await pool.query('UPDATE usuarios SET senha = ? WHERE email = ?', [novaSenha, email]);
        if (result.affectedRows === 0) return res.status(404).json({ message: "E-mail não encontrado." });
        res.json({ message: "Senha atualizada com sucesso!" });
    } catch (error) { res.status(500).json({ message: "Erro ao atualizar banco." }); }
});

// ==================================================
// 👤 API (LOGIN E USUÁRIOS)
// ==================================================
app.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
        if (rows.length === 0 || senha !== rows[0].senha) return res.status(401).json({ message: "Credenciais inválidas" });
        const token = jwt.sign({ id: rows[0].id, email: rows[0].email, tipo: rows[0].tipo }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ auth: true, token, usuario: { nome: rows[0].nome, tipo: rows[0].tipo, foto: rows[0].url_foto } });
    } catch (e) { res.status(500).json({ message: "Erro interno" }); }
});

// ==================================================
// 📊 DASHBOARD E APÓLICES
// ==================================================
app.get('/dashboard-resumo', authenticateToken, async (req, res) => {
    try {
        let where = isMasterUser(req.user.tipo) ? "" : ` WHERE usuario_id = ${req.user.id}`;
        const [u] = await pool.query('SELECT COUNT(*) as total FROM usuarios');
        const [a] = await pool.query(`SELECT COUNT(*) as total FROM apolices ${where}`);
        res.json({ apolices: a[0].total, usuarios: u[0].total });
    } catch (e) { res.status(500).send(); }
});

// ==================================================
// 📍 ROTAS DE FRONTEND
// ==================================================
const frontendPath = path.join(__dirname, '../frontend-web');
app.use(express.static(frontendPath));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const servir = (res, arquivo) => res.sendFile(path.join(frontendPath, arquivo));

app.get('/', (req, res) => servir(res, 'index.html'));
app.get('/recuperar.html', (req, res) => servir(res, 'recuperar.html'));
app.get('/redefinir-senha.html', (req, res) => servir(res, 'redefinir-senha.html'));

app.listen(port, () => { console.log(`🚀 SERVER NA PORTA ${port}`); });