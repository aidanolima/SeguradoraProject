require('dotenv').config();
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mysql = require('mysql2/promise');
const multer = require('multer');
const pdf = require('pdf-extraction');
const jwt = require('jsonwebtoken');
const express = require('express');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const multerS3 = require('multer-s3');

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
// ☁️ CONFIGURAÇÃO S3 (AWS) - BLINDADA
// ==================================================
let uploadS3; 
let uploadMemory; 
let s3Client; 

// Verifica se as chaves existem antes de tentar conectar (Evita crash)
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
                key: function (req, file, cb) {
                    const cleanName = file.originalname.replace(/\s+/g, '-').replace(/[^\w.-]/g, '');
                    cb(null, Date.now().toString() + '-' + cleanName);
                }
            })
        });
        uploadMemory = multer({ storage: multer.memoryStorage() });
        console.log("✅ AWS S3 Configurado com sucesso!");
    } catch (err) {
        console.error("❌ Erro ao configurar AWS S3:", err.message);
        usarArmazenamentoLocal();
    }
} else {
    console.log("⚠️ Variáveis AWS ausentes. Usando armazenamento local (uploads/).");
    usarArmazenamentoLocal();
}

function usarArmazenamentoLocal() {
    const storageDisk = multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = 'uploads/';
            if (!fs.existsSync(dir)){ fs.mkdirSync(dir); }
            cb(null, dir);
        },
        filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
    });
    uploadS3 = multer({ storage: storageDisk });
    uploadMemory = multer({ storage: storageDisk });
}

// ==================================================
// 📧 E-MAIL
// ==================================================
let transporter;
async function configurarEmail() {
    if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT || 587,
            secure: false,
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        });
    } else {
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: "smtp.ethereal.email", port: 587, secure: false,
            auth: { user: testAccount.user, pass: testAccount.pass },
        });
    }
}
configurarEmail();
async function enviarNotificacao(para, assunto, texto) {
    if (!transporter) return;
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_FROM || '"Seguradora System" <sistema@seguradora.com>',
            to: para, subject: assunto, text: texto
        });
    } catch (erro) { console.error(`❌ Falha envio email:`, erro.message); }
}

// ==================================================
// 🚨 MIDDLEWARES & ARQUIVOS ESTÁTICOS
// ==================================================
app.use(express.json());
app.use(cors());

const frontendPath = path.join(__dirname, '../frontend-web');
console.log("📂 Servindo arquivos de:", frontendPath);

app.use(express.static(frontendPath));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==================================================
// 📍 ROTAS DE PÁGINAS (FRONTEND)
// ==================================================
const servir = (res, arquivo) => {
    res.sendFile(path.join(frontendPath, arquivo), (err) => {
        if (err) {
            console.error(`Erro ao abrir ${arquivo}:`, err);
            res.status(404).send(`Erro: Página ${arquivo} não encontrada.`);
        }
    });
};

app.get('/', (req, res) => servir(res, 'index.html'));
app.get('/index.html', (req, res) => servir(res, 'index.html'));
app.get('/login', (req, res) => servir(res, 'index.html'));
app.get('/dashboard.html', (req, res) => servir(res, 'dashboard.html'));
app.get('/apolice.html', (req, res) => servir(res, 'apolice.html'));
app.get('/registro.html', (req, res) => servir(res, 'registro.html'));
app.get('/relatorios.html', (req, res) => servir(res, 'relatorios.html'));
app.get('/cadastro.html', (req, res) => servir(res, 'cadastro.html'));
app.get('/clientes.html', (req, res) => servir(res, 'clientes.html'));
app.get('/redefinir.html', (req, res) => servir(res, 'redefinir.html'));
app.get('/recuperar.html', (req, res) => servir(res, 'recuperar.html'));

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
    waitForConnections: true, connectionLimit: 5, queueLimit: 0
});

console.log("---------------------------------------------------");
console.log("🔍 O SERVIDOR ESTÁ CONECTANDO EM:", process.env.DB_HOST);
console.log("📂 NOME DO BANCO:", process.env.DB_NAME);
console.log("---------------------------------------------------");

// ==================================================
// 🔐 HELPERS
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

// --- FUNÇÃO MESTRA DE PERMISSÃO ---
const isMasterUser = (tipo) => (tipo === 'admin' || tipo === 'ti');

// ==================================================
// 🌐 API (LOGIN E SENHAS)
// ==================================================
app.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
        if (rows.length === 0) return res.status(401).json({ message: "Usuário não encontrado." });
        const usuario = rows[0];
        if (senha !== usuario.senha) return res.status(401).json({ message: "Senha incorreta." });
        
        const token = jwt.sign({ id: usuario.id, email: usuario.email, tipo: usuario.tipo }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ auth: true, token: token, usuario: { nome: usuario.nome, tipo: usuario.tipo } });
    } catch (error) { res.status(500).json({ message: "Erro interno." }); }
});

app.post('/forgot-password', async (req, res) => { res.json({message: "OK"}); });
app.post('/reset-password', async (req, res) => { res.json({message: "OK"}); });

// ==================================================
// 👤 GESTÃO DE USUÁRIOS (FILTRADA)
// ==================================================
app.post('/registrar', authenticateToken, async (req, res) => {
    try {
        const { nome, email, senha, tipo } = req.body;
        await pool.query('INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)', [nome, email, senha, tipo]);
        res.status(201).json({ message: "Usuário criado" });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/usuarios', authenticateToken, async (req, res) => {
    try { 
        let query = 'SELECT id, nome, email, tipo FROM usuarios';
        let params = [];

        if (!isMasterUser(req.user.tipo)) {
            query += ' WHERE id = ?';
            params.push(req.user.id);
        }

        const [rows] = await pool.query(query, params);
        res.json(rows); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/usuarios/:id', authenticateToken, async (req, res) => {
    try {
        if (!isMasterUser(req.user.tipo) && parseInt(req.params.id) !== req.user.id) {
            return res.status(403).json({ message: "Acesso negado." });
        }
        const [rows] = await pool.query('SELECT id, nome, email, tipo FROM usuarios WHERE id = ?', [req.params.id]);
        if (rows.length > 0) res.json(rows[0]); else res.status(404).json({ message: "Não encontrado" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/usuarios/:id', authenticateToken, async (req, res) => {
    try {
        if (!isMasterUser(req.user.tipo) && parseInt(req.params.id) !== req.user.id) return res.status(403).json({ message: "Acesso negado." });
        
        const { nome, email, senha, tipo } = req.body;
        let tipoFinal = tipo;
        
        if (!isMasterUser(req.user.tipo)) {
            const [u] = await pool.query('SELECT tipo FROM usuarios WHERE id = ?', [req.user.id]);
            tipoFinal = u[0].tipo;
        }

        if (senha && senha.trim() !== '') {
            await pool.query('UPDATE usuarios SET nome=?, email=?, senha=?, tipo=? WHERE id=?', [nome, email, senha, tipoFinal, req.params.id]);
        } else {
            await pool.query('UPDATE usuarios SET nome=?, email=?, tipo=? WHERE id=?', [nome, email, tipoFinal, req.params.id]);
        }
        res.json({ message: "Atualizado" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ROTA DE EXCLUSÃO DE USUÁRIOS (COM TRAVA DE SEGURANÇA PARA TI) ---
app.delete('/usuarios/:id', authenticateToken, async (req, res) => {
    try { 
        if (!isMasterUser(req.user.tipo)) return res.status(403).json({ message: "Apenas admin/TI pode excluir." });
        
        // REGRA: TI NÃO EXCLUI ADMIN
        if (req.user.tipo === 'ti') {
            const [target] = await pool.query('SELECT tipo FROM usuarios WHERE id = ?', [req.params.id]);
            if (target.length > 0 && target[0].tipo === 'admin') {
                return res.status(403).json({ message: "BLOQUEADO: Usuário TI não pode excluir um Administrador." });
            }
        }

        await pool.query('DELETE FROM usuarios WHERE id = ?', [req.params.id]); 
        res.json({ message: "Excluído" }); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================================================
// 📊 DASHBOARD (COMISSÕES TOTALIZADAS PARA ADMIN E TI)
// ==================================================
app.get('/dashboard/comissoes', authenticateToken, async (req, res) => {
    try {
        const usuarioId = req.user.id;
        const tipoUsuario = req.user.tipo;
        
        let query = "";
        let params = [];

        if (isMasterUser(tipoUsuario)) {
            query = `SELECT SUM(valor_comissao) as total FROM apolices WHERE status = 'EMITIDA'`;
        } else {
            query = `SELECT SUM(valor_comissao) as total FROM apolices WHERE usuario_id = ? AND status = 'EMITIDA'`;
            params = [usuarioId];
        }

        const [rows] = await pool.query(query, params);
        const total = rows[0].total ? parseFloat(rows[0].total) : 0.00;
        res.json({ totalComissoes: total });
    } catch (e) { 
        console.error("Erro comissões:", e); res.status(500).json({ message: "Erro comissões" }); 
    }
});

app.get('/dashboard-resumo', authenticateToken, async (req, res) => {
    try {
        let where = "";
        let params = [];
        
        if(!isMasterUser(req.user.tipo)) {
            where = " WHERE usuario_id = ?";
            params = [req.user.id];
        }

        const [u] = await pool.query('SELECT COUNT(*) as total FROM usuarios');
        const [a] = await pool.query(`SELECT COUNT(*) as total FROM apolices ${where}`, params);
        const [v] = await pool.query(`SELECT COUNT(*) as total FROM propostas ${where}`, params);
        const [c] = await pool.query(`SELECT COUNT(DISTINCT nome) as total FROM propostas ${where}`, params);
        
        res.json({ apolices: a[0].total, usuarios: u[0].total, veiculos: v[0].total, clientes: c[0].total });
    } catch (e) { res.status(500).json({ message: "Erro stats" }); }
});

app.get('/dashboard-graficos', authenticateToken, async (req, res) => {
    try {
        let query = 'SELECT vigencia_fim, vigencia_inicio, premio_liquido, premio_total FROM apolices';
        let params = [];
        if(!isMasterUser(req.user.tipo)) {
            query += ' WHERE usuario_id = ?';
            params.push(req.user.id);
        }

        const [rows] = await pool.query(query, params);
        const hoje = new Date(); hoje.setHours(0,0,0,0);
        let statusStats = { vigente: 0, vencida: 0, avencer: 0 };
        let financeiro = {}; 
        rows.forEach(r => {
            if (r.vigencia_fim) {
                let dFim = new Date(r.vigencia_fim);
                if (typeof r.vigencia_fim === 'string') dFim = new Date(r.vigencia_fim.split('T')[0]);
                const diffDays = Math.ceil((dFim - hoje) / (1000 * 60 * 60 * 24));
                if (diffDays < 0) statusStats.vencida++; else if (diffDays <= 30) statusStats.avencer++; else statusStats.vigente++;
            }
            if (r.vigencia_inicio) {
                let dInicio = new Date(r.vigencia_inicio);
                if (typeof r.vigencia_inicio === 'string') dInicio = new Date(r.vigencia_inicio.split('T')[0]);
                const anoMes = `${dInicio.getFullYear()}-${String(dInicio.getMonth() + 1).padStart(2, '0')}`;
                let valor = parseFloat(r.premio_total) || 0;
                if (!financeiro[anoMes]) financeiro[anoMes] = 0;
                financeiro[anoMes] += valor;
            }
        });
        const labels = Object.keys(financeiro).sort();
        res.json({ status: [statusStats.vigente, statusStats.avencer, statusStats.vencida], vendas: { labels: labels, valores: labels.map(k => financeiro[k]) } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================================================
// 📄 APÓLICES (COM ROTA DE LEITURA POR ID)
// ==================================================
app.get('/apolices', authenticateToken, async (req, res) => {
    try {
        let query = `SELECT a.*, p.nome as cliente_nome, p.placa as veiculo_placa FROM apolices a LEFT JOIN propostas p ON a.veiculo_id = p.id`;
        let params = [];

        if (!isMasterUser(req.user.tipo)) {
            query += ` WHERE a.usuario_id = ?`;
            params.push(req.user.id);
        }

        query += ` ORDER BY a.id DESC`;
        
        const [rows] = await pool.query(query, params);
        const fmt = rows.map(r => ({...r, cliente: r.cliente_nome || 'Excluído', placa: r.veiculo_placa || 'S/Placa'}));
        res.json(fmt);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ROTA DE LEITURA INDIVIDUAL DE APÓLICE ---
app.get('/apolices/:id', authenticateToken, async (req, res) => {
    try {
        let query = 'SELECT * FROM apolices WHERE id = ?';
        let params = [req.params.id];

        // Se não for master, garante que só acessa a dele
        if (!isMasterUser(req.user.tipo)) {
            query += ' AND usuario_id = ?';
            params.push(req.user.id);
        }

        const [rows] = await pool.query(query, params);
        if (rows.length === 0) return res.status(404).json({ message: "Apólice não encontrada ou acesso negado." });
        res.json(rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/cadastrar-apolice', authenticateToken, uploadS3.any(), async (req, res) => {
    try {
        const arquivo = (req.files && req.files.length > 0) ? req.files[0] : null;
        const linkArquivo = arquivo ? (arquivo.location || arquivo.filename) : null;
        const d = req.body;
        const idVeiculo = safeInt(d.veiculo_id);
        const usuarioId = req.user.id; 
        
        await pool.query(
            `INSERT INTO apolices (numero_apolice, veiculo_id, arquivo_pdf, premio_total, premio_liquido, franquia_casco, vigencia_inicio, vigencia_fim, numero_proposta, usuario_id, valor_comissao, valor_repasse, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, 
            [d.numero_apolice, idVeiculo, linkArquivo, safeCurrency(d.premio_total), safeCurrency(d.premio_liquido), safeCurrency(d.franquia_casco), d.vigencia_inicio||null, d.vigencia_fim||null, d.numero_proposta, usuarioId, safeCurrency(d.valor_comissao), safeCurrency(d.valor_repasse), 'EMITIDA']
        );
        res.status(201).json({message: "Criado", link: linkArquivo});
    } catch(e) { console.error(e); res.status(500).json({message: e.message}); }
});

app.put('/apolices/:id', authenticateToken, uploadS3.any(), async (req, res) => {
    try {
        const d = req.body;
        const idVeiculo = safeInt(d.veiculo_id);
        await pool.query(
            `UPDATE apolices SET numero_apolice=?, numero_proposta=?, veiculo_id=?, premio_total=?, premio_liquido=?, franquia_casco=?, vigencia_inicio=?, vigencia_fim=?, valor_comissao=?, valor_repasse=? WHERE id=?`, 
            [d.numero_apolice, d.numero_proposta, idVeiculo, safeCurrency(d.premio_total), safeCurrency(d.premio_liquido), safeCurrency(d.franquia_casco), d.vigencia_inicio||null, d.vigencia_fim||null, safeCurrency(d.valor_comissao), safeCurrency(d.valor_repasse), req.params.id]
        );
        if (req.files && req.files.length > 0) {
            const linkArquivo = req.files[0].location || req.files[0].filename;
            await pool.query('UPDATE apolices SET arquivo_pdf=? WHERE id=?', [linkArquivo, req.params.id]);
        }
        res.status(200).json({ message: "Atualizado" });
    } catch(e) { console.error(e); res.status(500).json({ message: e.message }); }
});

app.delete('/apolices/:id', authenticateToken, async (req, res) => {
    try { await pool.query('DELETE FROM apolices WHERE id = ?', [req.params.id]); res.json({ message: "Excluído" }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================================================
// 📄 PROPOSTAS (CLIENTES) - COM ROTA DE LEITURA E OBSERVAÇÕES
// ==================================================
app.get('/propostas', authenticateToken, async (req, res) => { 
    try { 
        let query = 'SELECT * FROM propostas';
        let params = [];
        
        if(!isMasterUser(req.user.tipo)) {
            query += ' WHERE usuario_id = ?';
            params.push(req.user.id);
        }
        
        query += ' ORDER BY id DESC';
        const [rows] = await pool.query(query, params); 
        res.json(rows); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- NOVA ROTA ADICIONADA: BUSCAR UM CLIENTE POR ID ---
app.get('/propostas/:id', authenticateToken, async (req, res) => {
    try {
        let query = 'SELECT * FROM propostas WHERE id = ?';
        let params = [req.params.id];

        // Se não for master, garante que só acessa o dele
        if (!isMasterUser(req.user.tipo)) {
            query += ' AND usuario_id = ?';
            params.push(req.user.id);
        }

        const [rows] = await pool.query(query, params);
        if (rows.length === 0) return res.status(404).json({ message: "Cliente não encontrado ou acesso negado." });
        res.json(rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});
// -----------------------------------------------------------

app.post('/cadastrar-proposta', authenticateToken, async (req, res) => {
    try { 
        const d = req.body; 
        const usuarioId = req.user.id; 
        // --- CAMPO OBSERVACOES ADICIONADO AO INSERT ---
        await pool.query(`INSERT INTO propostas (nome, documento, email, telefone, placa, modelo, cep, endereco, bairro, cidade, uf, numero, complemento, fabricante, chassi, ano_modelo, fipe, utilizacao, blindado, kit_gas, zero_km, cep_pernoite, cobertura_casco, carro_reserva, forma_pagamento, observacoes, usuario_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, 
        [d.nome, d.documento, d.email, d.telefone, d.placa, d.modelo, d.cep, d.endereco, d.bairro, d.cidade, d.uf, d.numero, d.complemento, d.fabricante, d.chassi, d.ano_modelo, d.fipe, d.utilizacao, d.blindado, d.kit_gas, d.zero_km, d.cep_pernoite, d.cobertura_casco, d.carro_reserva, d.forma_pagamento, d.observacoes, usuarioId]); 
        res.status(201).json({ message: "Criado" }); 
    } catch(e) { res.status(500).json({message: e.message}); }
});

app.put('/propostas/:id', authenticateToken, async (req, res) => {
    try { 
        const d = req.body; 
        if (!isMasterUser(req.user.tipo)) {
            const [check] = await pool.query('SELECT id FROM propostas WHERE id = ? AND usuario_id = ?', [req.params.id, req.user.id]);
            if (check.length === 0) return res.status(403).json({ message: "Acesso negado." });
        }
        // --- CAMPO OBSERVACOES ADICIONADO AO UPDATE ---
        await pool.query(`UPDATE propostas SET nome=?, documento=?, email=?, telefone=?, placa=?, modelo=?, cep=?, endereco=?, bairro=?, cidade=?, uf=?, numero=?, complemento=?, fabricante=?, chassi=?, ano_modelo=?, fipe=?, utilizacao=?, blindado=?, kit_gas=?, zero_km=?, cep_pernoite=?, cobertura_casco=?, carro_reserva=?, forma_pagamento=?, observacoes=? WHERE id=?`, [d.nome, d.documento, d.email, d.telefone, d.placa, d.modelo, d.cep, d.endereco, d.bairro, d.cidade, d.uf, d.numero, d.complemento, d.fabricante, d.chassi, d.ano_modelo, d.fipe, d.utilizacao, d.blindado, d.kit_gas, d.zero_km, d.cep_pernoite, d.cobertura_casco, d.carro_reserva, d.forma_pagamento, d.observacoes, req.params.id]); 
        res.json({ message: "Atualizado" }); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/propostas/:id', authenticateToken, async (req, res) => { try { await pool.query('DELETE FROM propostas WHERE id = ?', [req.params.id]); res.json({ message: "Excluído" }); } catch (e) { res.status(500).json({ error: e.message }); }});

app.post('/importar-pdf', authenticateToken, uploadMemory.any(), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) return res.status(400).json({ message: "Sem arquivo." });
        const data = await pdf(req.files[0].buffer);
        const txt = data.text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ');
        let dados = { premio_total: "0.00", numero_apolice: "", placa: "" };
        const matchValor = txt.match(/(?:Prêmio Total|Valor Total).*?R?\$?\s*([\d\.,]+)/i);
        if(matchValor) dados.premio_total = matchValor[1].replace(/\./g,'').replace(',','.');
        const matchPlaca = txt.match(/[A-Z]{3}[0-9][0-9A-Z][0-9]{2}/i);
        if(matchPlaca) dados.placa = matchPlaca[0].toUpperCase();
        res.json({ mensagem: "Sucesso", dados });
    } catch (e) { res.status(500).json({message: "Erro ao ler PDF"}); }
});

app.get('/apolices/:id/pdf-seguro', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT arquivo_pdf FROM apolices WHERE id = ?', [req.params.id]);
        if (rows.length === 0 || !rows[0].arquivo_pdf) return res.status(404).json({ message: "Arquivo não encontrado." });
        const arquivo = rows[0].arquivo_pdf;
        if (!arquivo.startsWith('http')) return res.json({ url: `/uploads/${arquivo}` });
        if (s3Client) {
            try {
                const urlObj = new URL(arquivo);
                let key = decodeURIComponent(urlObj.pathname.substring(1));
                const command = new GetObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME, Key: key });
                const urlAssinada = await getSignedUrl(s3Client, command, { expiresIn: 900 });
                return res.json({ url: urlAssinada });
            } catch (urlError) { return res.json({ url: arquivo }); }
        } else { return res.json({ url: arquivo }); }
    } catch (e) { console.error("Erro link:", e); res.status(500).json({ message: "Erro ao gerar link." }); }
});

cron.schedule('0 9 * * *', async () => {});
app.listen(port, () => { console.log(`🚀 SERVER NA PORTA ${port}`); });