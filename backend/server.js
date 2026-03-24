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
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

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
// 📧 CONFIGURAÇÃO DO CARTEIRO (RESEND) - VERSÃO NUVEM
// ==================================================
const transporter = nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 587, // Mudamos de 465 para 587 (Padrão para Render/Nuvem)
    secure: false, // Para a porta 587, isso deve ser FALSE
    auth: {
        user: 'resend',
        pass: process.env.re_aaNkzPUh_767j3NqfgFU6WokdMouQytgD 
    },
    // Adicional para evitar bloqueios de certificados em nuvem
    tls: {
        rejectUnauthorized: false
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

        console.log("🚀 Enviando via Resend SDK (Caminho Seguro HTTP)...");

        const { data, error } = await resend.emails.send({
            from: 'Gestão de Apólices <onboarding@resend.dev>',
            to: [email],
            subject: 'Recuperação de Senha - Gestão de Apólices',
            html: `
                <div style="font-family: Arial; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px;">
                    <h2 style="color: #003366;">Recuperação de Senha</h2>
                    <p>Você solicitou a alteração de senha. Clique no botão abaixo para prosseguir:</p>
                    <a href="${resetLink}" style="display: inline-block; padding: 12px 20px; background: #00a86b; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Redefinir Minha Senha</a>
                    <p style="margin-top: 20px; font-size: 12px; color: #777;">Se não foi você, ignore este e-mail.</p>
                </div>
            `
        });

        if (error) {
            console.error("❌ Erro retornado pelo Resend:", error);
            return res.status(400).json({ message: "Erro no serviço de e-mail." });
        }

        console.log("✅ E-mail enviado com sucesso! ID:", data.id);
        res.status(200).json({ message: 'E-mail enviado com sucesso!' });

    } catch (err) {
        console.error("❌ Erro fatal no servidor:", err);
        res.status(500).json({ message: 'Erro interno ao processar e-mail.' });
    }
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