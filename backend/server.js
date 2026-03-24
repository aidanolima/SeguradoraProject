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

console.log("⏳ Iniciando configurações do servidor...");

const app = express();

// ==================================================
// 🛡️ MIDDLEWARES INICIAIS (CORS e JSON primeiro!)
// ==================================================
app.use(cors());
app.use(express.json());

// 🚫 Middleware Anti-Cache Global
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

const port = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'seguradora_chave_secreta_super_segura_2024';

// ==================================================
// 📧 CONFIGURAÇÃO DO RESEND (SDK)
// ==================================================
const resend = new Resend(process.env.RESEND_API_KEY);

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

console.log("---------------------------------------------------");
console.log("🔍 CONECTADO AO BANCO:", process.env.DB_NAME);
console.log("---------------------------------------------------");

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

        uploadS3 = multer({
            storage: multerS3({
                s3: s3Client,
                bucket: process.env.AWS_BUCKET_NAME,
                contentType: multerS3.AUTO_CONTENT_TYPE,
                key: (req, file, cb) => cb(null, Date.now().toString() + '-' + file.originalname.replace(/\s+/g, '-').replace(/[^\w.-]/g, ''))
            })
        });

        uploadPerfilS3 = multer({
            storage: multerS3({
                s3: s3Client,
                bucket: process.env.AWS_BUCKET_NAME,
                contentType: multerS3.AUTO_CONTENT_TYPE,
                acl: 'public-read',
                key: (req, file, cb) => {
                    const extensao = file.originalname.split('.').pop();
                    cb(null, `seguradora-auto/perfil/${Date.now()}-${Math.round(Math.random() * 1E9)}.${extensao}`);
                }
            })
        });

        uploadMemory = multer({ storage: multer.memoryStorage() });
        console.log("✅ AWS S3 Configurado!");
    } catch (err) { usarArmazenamentoLocal(); }
} else { usarArmazenamentoLocal(); }

function usarArmazenamentoLocal() {
    const storageDisk = multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = 'uploads/';
            if (!fs.existsSync(dir)){ fs.mkdirSync(dir); }
            cb(null, dir);
        },
        filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
    });
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
const safeCurrency = (v) => {
    if (!v) return 0.00;
    let str = v.toString();
    if (str.includes(',')) str = str.replace(/[^\d,-]/g, '').replace(',', '.');
    else str = str.replace(/[^\d.-]/g, '');
    return isNaN(parseFloat(str)) ? 0.00 : parseFloat(str);
};
const safeInt = (v) => { if (!v || v === '' || v === 'null') return null; return isNaN(parseInt(v)) ? null : parseInt(v); };
const isMasterUser = (tipo) => (tipo === 'admin' || tipo === 'ti');

// ==================================================
// 🌐 ROTAS DE RECUPERAÇÃO DE SENHA (RESEND SDK)
// ==================================================

app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    console.log(`📧 Solicitação de e-mail para: ${email}`);
    try {
        const token = crypto.randomBytes(20).toString('hex');
        const resetLink = `https://gestaoclienteseapolices.com.br/redefinir-senha.html?token=${token}&email=${email}`;

        const { data, error } = await resend.emails.send({
            from: 'Gestão de Apólices <onboarding@resend.dev>',
            to: [email],
            subject: 'Recuperação de Senha - Gestão de Apólices',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #003366;">Recuperação de Senha</h2>
                    <p>Você solicitou a alteração de senha do sistema. Clique no botão abaixo para prosseguir:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}" style="background-color: #00a86b; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Redefinir Minha Senha</a>
                    </div>
                    <p style="font-size: 12px; color: #888;">Se não foi você, por favor ignore este e-mail.</p>
                </div>
            `
        });

        if (error) {
            console.error("❌ Erro Resend:", error);
            return res.status(400).json({ message: "Erro ao enviar e-mail." });
        }

        console.log("✅ E-mail enviado!");
        res.status(200).json({ message: 'E-mail enviado com sucesso!' });
    } catch (err) {
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
});

app.post('/reset-password', async (req, res) => {
    const { email, novaSenha } = req.body;
    try {
        const [result] = await pool.query('UPDATE usuarios SET senha = ? WHERE email = ?', [novaSenha, email]);
        if (result.affectedRows === 0) return res.status(404).json({ message: "E-mail não encontrado." });
        res.json({ message: "Senha atualizada com sucesso!" });
    } catch (error) {
        res.status(500).json({ message: "Erro ao atualizar senha." });
    }
});

// ==================================================
// 🌐 API (LOGIN E USUÁRIOS)
// ==================================================
app.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
        if (rows.length === 0) return res.status(401).json({ message: "Usuário não encontrado." });
        const usuario = rows[0];
        if (senha !== usuario.senha) return res.status(401).json({ message: "Senha incorreta." });
        
        const token = jwt.sign({ id: usuario.id, email: usuario.email, tipo: usuario.tipo }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ auth: true, token: token, usuario: { nome: usuario.nome, tipo: usuario.tipo, foto: usuario.url_foto } });
    } catch (error) { res.status(500).json({ message: "Erro interno." }); }
});

app.get('/usuarios', authenticateToken, async (req, res) => {
    try { 
        let query = 'SELECT id, nome, email, tipo, url_foto FROM usuarios';
        let params = [];
        if (!isMasterUser(req.user.tipo)) {
            query += ' WHERE id = ?';
            params.push(req.user.id);
        }
        const [rows] = await pool.query(query, params);
        res.json(rows); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/usuarios/:id', authenticateToken, async (req, res) => {
    try { 
        if (!isMasterUser(req.user.tipo)) return res.status(403).json({ message: "Acesso negado." });
        await pool.query('DELETE FROM usuarios WHERE id = ?', [req.params.id]); 
        res.json({ message: "Excluído" }); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================================================
// 📊 DASHBOARD, APÓLICES E PROPOSTAS
// ==================================================

app.get('/dashboard-resumo', authenticateToken, async (req, res) => {
    try {
        let where = isMasterUser(req.user.tipo) ? "" : ` WHERE usuario_id = ${req.user.id}`;
        const [u] = await pool.query('SELECT COUNT(*) as total FROM usuarios');
        const [a] = await pool.query(`SELECT COUNT(*) as total FROM apolices ${where}`);
        const [v] = await pool.query(`SELECT COUNT(*) as total FROM propostas ${where}`);
        const [c] = await pool.query(`SELECT COUNT(DISTINCT nome) as total FROM propostas ${where}`);
        res.json({ apolices: a[0].total, usuarios: u[0].total, veiculos: v[0].total, clientes: c[0].total });
    } catch (e) { res.status(500).json({ message: "Erro stats" }); }
});

app.get('/apolices', authenticateToken, async (req, res) => {
    try {
        let query = `SELECT a.*, p.nome as cliente_nome, p.placa as veiculo_placa FROM apolices a LEFT JOIN propostas p ON a.veiculo_id = p.id`;
        if (!isMasterUser(req.user.tipo)) query += ` WHERE a.usuario_id = ${req.user.id}`;
        query += ` ORDER BY a.id DESC`;
        const [rows] = await pool.query(query);
        res.json(rows.map(r => ({...r, cliente: r.cliente_nome || 'Excluído', placa: r.veiculo_placa || 'S/Placa'})));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/cadastrar-proposta', authenticateToken, async (req, res) => {
    try { 
        const d = req.body; 
        await pool.query(`INSERT INTO propostas (nome, documento, email, telefone, placa, modelo, cep, endereco, bairro, cidade, uf, numero, complemento, fabricante, chassi, ano_modelo, fipe, utilizacao, blindado, kit_gas, zero_km, cep_pernoite, cobertura_casco, carro_reserva, forma_pagamento, observacoes, usuario_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, 
        [d.nome, d.documento, d.email, d.telefone, d.placa, d.modelo, d.cep, d.endereco, d.bairro, d.cidade, d.uf, d.numero, d.complemento, d.fabricante, d.chassi, d.ano_modelo, d.fipe, d.utilizacao, d.blindado, d.kit_gas, d.zero_km, d.cep_pernoite, d.cobertura_casco, d.carro_reserva, d.forma_pagamento, d.observacoes, req.user.id]); 
        res.status(201).json({ message: "Criado" }); 
    } catch(e) { res.status(500).json({message: e.message}); }
});

// ==================================================
// 📍 ROTAS DE FRONTEND E ESTÁTICOS
// ==================================================
const frontendPath = path.join(__dirname, '../frontend-web');
app.use(express.static(frontendPath));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const servir = (res, arquivo) => res.sendFile(path.join(frontendPath, arquivo));

app.get('/', (req, res) => servir(res, 'index.html'));
app.get('/dashboard.html', (req, res) => servir(res, 'dashboard.html'));
app.get('/recuperar.html', (req, res) => servir(res, 'recuperar.html'));
app.get('/redefinir-senha.html', (req, res) => servir(res, 'redefinir-senha.html'));

// ==================================================
// 🚀 INICIALIZAÇÃO
// ==================================================
cron.schedule('0 9 * * *', async () => {});
app.listen(port, () => { console.log(`🚀 SERVER NA PORTA ${port}`); });