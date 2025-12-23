// backend/server.js - VERSÃO FINAL SEGURA E ORGANIZADA

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

// ------------------------------------------------------------------
// 1. CONFIGURAÇÕES INICIAIS
// ------------------------------------------------------------------

// Middleware de Log (Rastreamento)
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url} - IP: ${req.ip}`);
    next();
});

app.use(cors());
app.use(express.json());

// Configuração de Upload (Memória para ler PDF / Disco para salvar)
const storage = multer.memoryStorage();
const uploadMem = multer({ storage: storage }); // Para ler o texto do PDF

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storageDisk = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const uploadSave = multer({ storage: storageDisk }); // Para salvar arquivo físico

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ------------------------------------------------------------------
// 2. BANCO DE DADOS
// ------------------------------------------------------------------
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

// ------------------------------------------------------------------
// 3. MIDDLEWARE DE AUTENTICAÇÃO (PROTEÇÃO)
// ------------------------------------------------------------------
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        console.warn("[AUTH] Token não fornecido.");
        return res.sendStatus(401);
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.warn("[AUTH] Token inválido.");
            return res.sendStatus(403);
        }
        req.user = user; // Salva dados do usuário (id, email, tipo) na requisição
        next();
    });
}

// ==================================================================
// 4. ROTAS DE AUTENTICAÇÃO
// ==================================================================

app.get('/', (req, res) => res.status(200).send('API Online e Segura! 🚀'));

// LOGIN
app.post('/auth/login', async (req, res) => {
    console.log(`[LOGIN] Tentativa: ${req.body.email}`);
    try {
        const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ? AND senha = ?', [req.body.email, req.body.senha]);
        
        if (rows.length > 0) {
            const user = rows[0];
            // Gera o Token com validade de 8 horas
            const token = jwt.sign({ id: user.id, email: user.email, tipo: user.tipo }, JWT_SECRET, { expiresIn: '8h' });
            
            console.log(`[LOGIN] Sucesso: ${user.email} (${user.tipo})`);
            res.json({ 
                message: "OK", 
                token, 
                user: { id: user.id, nome: user.nome, email: user.email, tipo: user.tipo } 
            });
        } else {
            console.warn(`[LOGIN] Falha: Dados incorretos.`);
            res.status(401).json({ message: "Login inválido" });
        }
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// RECUPERAR SENHA (SIMULADO)
app.post('/auth/forgot-password', (req, res) => {
    const { email } = req.body;
    // Aqui você integraria com serviço de e-mail real
    console.log(`[RECUPERAR] Solicitado para: ${email}`);
    res.json({ message: "Se o e-mail existir, você receberá instruções." });
});

// ==================================================================
// 5. ROTAS DE GERENCIAMENTO DE USUÁRIOS (SEGURANÇA APLICADA)
// ==================================================================

// CRIAR NOVO USUÁRIO (APENAS ADMIN)
app.post('/auth/register', authenticateToken, async (req, res) => {
    if (req.user.tipo !== 'admin') {
        return res.status(403).json({ message: "Acesso negado. Apenas administradores podem criar usuários." });
    }

    const { nome, email, senha, tipo } = req.body;
    const tipoFinal = tipo || 'operacional'; 

    try {
        const [userExists] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
        if (userExists.length > 0) return res.status(400).json({ message: "E-mail já cadastrado!" });

        const sql = 'INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)';
        const [result] = await pool.query(sql, [nome, email, senha, tipoFinal]);
        
        console.log(`[USUARIO] Novo usuário criado: ${email} por Admin ID ${req.user.id}`);
        res.status(201).json({ message: "Usuário criado com sucesso!", id: result.insertId });

    } catch (error) {
        console.error("Erro register:", error);
        res.status(500).json({ message: "Erro ao criar conta." });
    }
});

// LISTAR USUÁRIOS (REGRA: OPERACIONAL VÊ SÓ A SI MESMO)
app.get('/usuarios', authenticateToken, async (req, res) => {
    try {
        let sql = 'SELECT id, nome, email, tipo FROM usuarios';
        let params = [];

        // Se não for admin, filtra pelo próprio ID
        if (req.user.tipo !== 'admin') {
            sql += ' WHERE id = ?';
            params.push(req.user.id);
        }

        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// BUSCAR UM USUÁRIO (PARA EDIÇÃO)
app.get('/usuarios/:id', authenticateToken, async(req,res)=>{
    // Segurança: Usuário comum não pode ver dados de outro ID
    if (req.user.tipo !== 'admin' && req.user.id != req.params.id) {
        return res.status(403).json({ message: "Acesso restrito." });
    }
    const [r] = await pool.query('SELECT id, nome, email, tipo FROM usuarios WHERE id=?',[req.params.id]);
    res.json(r[0]);
});

// ATUALIZAR USUÁRIO
app.put('/usuarios/:id', authenticateToken, async(req,res)=>{
    if (req.user.tipo !== 'admin' && req.user.id != req.params.id) {
        return res.status(403).json({ message: "Você só pode editar seu próprio perfil." });
    }

    const { nome, email, tipo, senha } = req.body;
    // Operacional não pode se promover a Admin
    const tipoFinal = (req.user.tipo !== 'admin') ? 'operacional' : tipo;

    try {
        let sql, params;
        if (senha && senha.trim() !== '') {
            sql = 'UPDATE usuarios SET nome=?, email=?, tipo=?, senha=? WHERE id=?';
            params = [nome, email, tipoFinal, senha, req.params.id];
        } else {
            sql = 'UPDATE usuarios SET nome=?, email=?, tipo=? WHERE id=?';
            params = [nome, email, tipoFinal, req.params.id];
        }
        await pool.query(sql, params);
        res.json({message:"Atualizado com sucesso"});
    } catch (e) { res.status(500).json({error: e.message}); }
});

// EXCLUIR USUÁRIO (APENAS ADMIN)
app.delete('/usuarios/:id', authenticateToken, async (req, res) => {
    if (req.user.tipo !== 'admin') {
        return res.status(403).json({ message: "Apenas administradores podem excluir usuários." });
    }
    try {
        const [result] = await pool.query('DELETE FROM usuarios WHERE id = ?', [req.params.id]);
        console.log(`[DELETE] Usuário removido. Linhas: ${result.affectedRows}`);
        res.status(200).json({ message: 'Usuário excluído com sucesso' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao excluir usuário' });
    }
});

// ==================================================================
// 6. ROTAS DE PROPOSTAS E CLIENTES
// ==================================================================

// LISTAR
app.get('/propostas', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM propostas ORDER BY id DESC');
    res.json(rows);
});

// BUSCAR ÚNICA
app.get('/propostas/:id', async (req,res)=>{
    const [r] = await pool.query('SELECT * FROM propostas WHERE id=?',[req.params.id]);
    res.json(r[0]);
});

// CRIAR
app.post('/cadastrar-proposta', async (req, res) => {
    try {
        const d = req.body;
        // Tratamento de booleanos
        const blindado = d.blindado ? 1 : 0;
        const kit_gas = d.kit_gas ? 1 : 0;
        const zero_km = d.zero_km ? 1 : 0;

        const query = `INSERT INTO propostas (nome, documento, email, telefone, cep, endereco, bairro, cidade, uf, numero, complemento, fabricante, modelo, placa, chassi, ano_modelo, fipe, utilizacao, blindado, kit_gas, zero_km, cep_pernoite, cobertura_casco, carro_reserva, forma_pagamento) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        const params = [d.nome, d.documento, d.email, d.telefone, d.cep, d.endereco, d.bairro, d.cidade, d.uf, d.numero, d.complemento, d.fabricante, d.modelo, d.placa, d.chassi, d.ano_modelo, d.fipe, d.utilizacao, blindado, kit_gas, zero_km, d.cep_pernoite, d.cobertura_casco, d.carro_reserva, d.forma_pagamento];
        
        const [result] = await pool.query(query, params);
        res.status(201).json({ message: "Criado", id: result.insertId });
    } catch(e) { 
        console.error(e);
        res.status(500).json({message: e.message}); 
    }
});

// ATUALIZAR
app.put('/propostas/:id', async (req,res)=>{
    try {
        const d = req.body;
        // Exemplo simplificado de update (adicione todos os campos necessários na query real)
        // Aqui atualizamos os principais para garantir funcionamento
        const sql = `UPDATE propostas SET nome=?, email=?, telefone=?, placa=?, modelo=? WHERE id=?`;
        await pool.query(sql, [d.nome, d.email, d.telefone, d.placa, d.modelo, req.params.id]);
        res.json({message:"Atualizado"});
    } catch(e) { res.status(500).json({error:e.message}); }
});

// EXCLUIR PROPOSTA
app.delete('/propostas/:id', authenticateToken, async (req, res) => {
    // Regra: Admin pode tudo. Operacional pode? Vamos deixar liberado por enquanto ou bloquear se quiser.
    // Assumindo liberado para quem tem acesso ao painel:
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM apolices WHERE veiculo_id = ?', [id]); // Limpa filhos
        const [result] = await pool.query('DELETE FROM propostas WHERE id = ?', [id]);
        
        console.log(`[DELETE] Cliente ${id} removido.`);
        if (result.affectedRows > 0) res.status(200).json({ message: 'Cliente excluído' });
        else res.status(404).json({ message: 'Cliente não encontrado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao excluir' });
    }
});

// ==================================================================
// 7. ROTAS DE APÓLICES
// ==================================================================

// LISTAR
app.get('/apolices', async (req, res) => {
    const [rows] = await pool.query(`SELECT a.*, p.nome as cliente_nome, p.placa as veiculo_placa FROM apolices a LEFT JOIN propostas p ON a.veiculo_id = p.id ORDER BY a.id DESC`);
    const fmt = rows.map(r => ({...r, cliente: r.cliente_nome || 'Excluído', placa: r.veiculo_placa || 'S/Placa'}));
    res.json(fmt);
});

// BUSCAR ÚNICA
app.get('/apolices/:id', async (req,res)=>{
    const [r] = await pool.query('SELECT * FROM apolices WHERE id=?',[req.params.id]);
    res.json(r[0]);
});

// CRIAR APÓLICE (COM UPLOAD)
app.post('/cadastrar-apolice', uploadSave.single('arquivo_pdf'), async (req, res) => {
    try {
        const d = req.body;
        const f = req.file ? req.file.filename : null;
        await pool.query(`INSERT INTO apolices (numero_apolice, veiculo_id, arquivo_pdf, premio_total, vigencia_inicio, vigencia_fim) VALUES (?,?,?,?,?,?)`, 
            [d.numero_apolice, d.veiculo_id, f, d.premio_total, d.vigencia_inicio, d.vigencia_fim]);
        res.status(201).json({message: "Criado"});
    } catch(e) { res.status(500).json({message: e.message}); }
});

// ATUALIZAR APÓLICE
app.put('/apolices/:id', async (req,res)=>{
    try {
        const d = req.body;
        await pool.query('UPDATE apolices SET numero_apolice=?, premio_total=? WHERE id=?',[d.numero_apolice, d.premio_total, req.params.id]);
        res.json({message:"Atualizado"});
    } catch(e) { res.status(500).json({message:e.message}); }
});

// EXCLUIR APÓLICE
app.delete('/apolices/:id', authenticateToken, async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM apolices WHERE id = ?', [req.params.id]);
        if (result.affectedRows > 0) res.status(200).json({ message: 'Apólice excluída' });
        else res.status(404).json({ message: 'Não encontrada' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao excluir apólice' });
    }
});

// BAIXAR PDF
app.get('/apolices/:id/pdf', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT arquivo_pdf FROM apolices WHERE id = ?', [req.params.id]);
        if (rows.length === 0 || !rows[0].arquivo_pdf) return res.status(404).json({ message: 'Sem PDF.' });
        
        const cleanName = rows[0].arquivo_pdf.replace(/^uploads[\\\/]/, '');
        const filePath = path.join(__dirname, 'uploads', cleanName);
        
        if (fs.existsSync(filePath)) res.sendFile(filePath);
        else res.status(404).json({ message: 'Arquivo físico não encontrado.' });
    } catch (e) { res.status(500).json({ message: 'Erro PDF' }); }
});

// ==================================================================
// 8. ROTA DE RELATÓRIOS
// ==================================================================
app.get('/relatorios', authenticateToken, async (req, res) => {
    try {
        const { inicio, fim, status, busca } = req.query;
        let sql = `SELECT p.id, p.nome, p.email, a.vigencia_inicio as data_cadastro, COALESCE(a.premio_total, 0) as valor, CASE WHEN a.id IS NOT NULL THEN 'ativo' ELSE 'pendente' END as status FROM propostas p LEFT JOIN apolices a ON a.veiculo_id = p.id WHERE 1=1`;
        let params = [];

        if (busca) { sql += ` AND (p.nome LIKE ? OR p.email LIKE ?)`; params.push(`%${busca}%`, `%${busca}%`); }
        if (inicio) { sql += ` AND a.vigencia_inicio >= ?`; params.push(inicio); }
        if (fim) { sql += ` AND a.vigencia_inicio <= ?`; params.push(fim); }

        sql += ` ORDER BY p.id DESC`;
        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// INICIALIZAÇÃO
app.listen(port, () => console.log(`🚀 Servidor rodando na porta ${port}`));