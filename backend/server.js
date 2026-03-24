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
const nodemailer = require('nodemailer'); 
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');

console.log("⏳ Iniciando configurações do servidor...");

const app = express();

// 🚫 Middleware Anti-Cache Global para a API
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

const port = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'seguradora_chave_secreta_super_segura_2024';

// ==================================================
// ☁️ CONFIGURAÇÃO S3 (AWS)
// ==================================================
let uploadS3, uploadMemory, uploadPerfilS3, s3Client; 

const hasAwsKeys = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_BUCKET_NAME;

if (hasAwsKeys) {
    try {
        s3Client = new S3Client({
            region: process.env.AWS_REGION || 'us-east-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
        });
        uploadS3 = multer({ storage: multerS3({ s3: s3Client, bucket: process.env.AWS_BUCKET_NAME, contentType: multerS3.AUTO_CONTENT_TYPE, key: (req, file, cb) => cb(null, Date.now().toString() + '-' + file.originalname.replace(/\s+/g, '-')) }) });
        uploadPerfilS3 = multer({ storage: multerS3({ s3: s3Client, bucket: process.env.AWS_BUCKET_NAME, contentType: multerS3.AUTO_CONTENT_TYPE, acl: 'public-read', key: (req, file, cb) => cb(null, `seguradora-auto/perfil/${Date.now()}-${file.originalname}`) }) });
        uploadMemory = multer({ storage: multer.memoryStorage() });
        console.log("✅ AWS S3 Configurado!");
    } catch (err) { usarArmazenamentoLocal(); }
} else { usarArmazenamentoLocal(); }

function usarArmazenamentoLocal() {
    const storageDisk = multer.diskStorage({ destination: (req, file, cb) => { const dir = 'uploads/'; if (!fs.existsSync(dir)) fs.mkdirSync(dir); cb(null, dir); }, filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname) });
    uploadS3 = uploadPerfilS3 = uploadMemory = multer({ storage: storageDisk });
}

app.use(express.json());
app.use(cors());

// ==================================================
// 📧 CONFIGURAÇÃO DO CARTEIRO (RESEND)
// ==================================================
const transporter = nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    auth: {
        user: 'resend',
        pass: 're_BPodXTYW_CoK4424SBJzfTpqs79wTfdM4' 
    }
});

// ==================================================
// 🔐 ROTA DE RECUPERAÇÃO DE SENHA
// ==================================================
app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    console.log(`📧 Solicitação de recuperação para: ${email}`);

    try {
        const token = crypto.randomBytes(20).toString('hex');
        const resetLink = `https://gestaoclienteseapolices.com.br/redefinir-senha.html?token=${token}&email=${email}`;

        const mailOptions = {
            from: 'Gestão de Apólices <onboarding@resend.dev>', 
            to: email,
            subject: 'Recuperação de Senha - Gestão de Apólices',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                    <h2 style="color: #003366; text-align: center;">Recuperação de Senha</h2>
                    <p>Você solicitou a recuperação de senha. Clique no botão abaixo:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}" style="background-color: #00a86b; color: white; padding: 14px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Redefinir Minha Senha</a>
                    </div>
                    <p style="font-size: 12px; color: #999;">Se não solicitou, ignore este e-mail.</p>
                </div>
            `
        };

        console.log("🚀 Enviando via Resend...");
        const info = await transporter.sendMail(mailOptions);
        console.log("✅ E-mail enviado com sucesso! ID:", info.messageId);

        res.status(200).json({ message: 'E-mail enviado com sucesso!' });

    } catch (error) {
        console.error("❌ Erro ao enviar e-mail:", error);
        res.status(500).json({ message: 'Erro ao enviar o e-mail.' });
    }
});

app.post('/reset-password', async (req, res) => {
    const { email, novaSenha } = req.body;
    try {
        await pool.query('UPDATE usuarios SET senha = ? WHERE email = ?', [novaSenha, email]);
        res.json({ message: "Senha atualizada com sucesso!" });
    } catch (error) { res.status(500).json({ message: "Erro ao atualizar senha." }); }
});

// ==================================================
// 📍 ROTAS DE FRONTEND E API RESTANTE
// ==================================================
const frontendPath = path.join(__dirname, '../frontend-web');
app.use(express.static(frontendPath));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const servir = (res, arquivo) => res.sendFile(path.join(frontendPath, arquivo));

app.get('/', (req, res) => servir(res, 'index.html'));
app.get('/dashboard.html', (req, res) => servir(res, 'dashboard.html'));
app.get('/recuperar.html', (req, res) => servir(res, 'recuperar.html'));
app.get('/redefinir-senha.html', (req, res) => servir(res, 'redefinir-senha.html'));

// BANCO DE DADOS
const pool = mysql.createPool({
    host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false }, waitForConnections: true, connectionLimit: 5
});

// LOGIN
app.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
        if (rows.length === 0 || senha !== rows[0].senha) return res.status(401).json({ message: "Credenciais inválidas" });
        const token = jwt.sign({ id: rows[0].id, email: rows[0].email, tipo: rows[0].tipo }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ auth: true, token, usuario: { nome: rows[0].nome, tipo: rows[0].tipo, foto: rows[0].url_foto } });
    } catch (e) { res.status(500).json({ message: "Erro interno" }); }
});

// DASHBOARD E OUTROS (Simplificado para manter o arquivo funcional)
app.get('/dashboard-resumo', async (req, res) => {
    try {
        const [u] = await pool.query('SELECT COUNT(*) as total FROM usuarios');
        const [a] = await pool.query('SELECT COUNT(*) as total FROM apolices');
        res.json({ apolices: a[0].total, usuarios: u[0].total });
    } catch (e) { res.status(500).send(); }
});

// Iniciar servidor
app.listen(port, () => { console.log(`🚀 SERVER RODANDO NA PORTA ${port}`); });