// backend/server.js - VERSÃO FINAL (COM JWT E LIMPEZA DE DUPLICATAS)

const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mysql = require('mysql2/promise');
const multer = require('multer');
const pdf = require('pdf-extraction');
const jwt = require('jsonwebtoken'); // <--- NOVO: Importando JWT

const express = require('express');
const app = express();
//const port = 3000; LOCAL
const port = process.env.PORT || 3000; // NUVEM 

// --- CONFIGURAÇÃO DA CHAVE SECRETA (Pode ser qualquer texto difícil) ---
const JWT_SECRET = 'seguradora_chave_secreta_super_segura_2024';

// --- CONFIGURAÇÃO MULTER (MEMÓRIA RAM) ---
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json());

// Rota de Teste para a Raiz (Evita o 404 no navegador)
app.get('/', (req, res) => {
    res.send('API Seguradora funcionando! 🚀');
});

// --- CONFIGURAÇÃO DE UPLOAD (DISCO) ---
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


// --- CONEXÃO BANCO DE DADOS LOCAL ---
//const pool = mysql.createPool({
//    host: 'localhost', 
//    user: 'root', 
//    password: '054622',  // Verifique se sua senha é esta mesma
//    database: 'seguradoraauto',
//    waitForConnections: true, 
//    connectionLimit: 10, 
//    queueLimit: 0
//});

// --- CONEXÃO BANCO DE DADOS (ADAPTADA PARA NUVEM) ---
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '054622', // Sua senha local como fallback
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
// MIDDLEWARE DE AUTENTICAÇÃO (O GUARDIÃO)
// ==========================================
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    // O header vem como: "Bearer eyJhbGciOiJIUzI1..."
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401); // Sem token = Acesso Negado

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // Token inválido/expirado = Proibido
        req.user = user;
        next(); // Pode passar
    });
}


// ==========================================
// 1. ROTAS DE AUTENTICAÇÃO
// ==========================================

// ROTA DE LOGIN (GERA O TOKEN)
app.post('/auth/login', async (req, res) => {
    const { email, senha } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ? AND senha = ?', [email, senha]);
        
        if (rows.length > 0) {
            const user = rows[0];
            
            // CRIA O TOKEN ASSINADO
            const token = jwt.sign(
                { id: user.id, email: user.email, tipo: user.tipo }, 
                JWT_SECRET, 
                { expiresIn: '8h' } // Token expira em 8 horas
            );

            res.json({ 
                message: "OK", 
                token: token, // Envia o token para o frontend
                user: { id: user.id, nome: user.nome, email: user.email, tipo: user.tipo } 
            });
        } else {
            res.status(401).json({ message: "Login inválido" });
        }
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// ROTA DE REGISTRO (CRIAR CONTA INICIAL OU VIA PAINEL)
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
        console.error("Erro ao registrar:", error);
        res.status(500).json({ message: "Erro ao criar conta: " + error.message });
    }
});


// ==========================================
// 2. ROTAS DE GERENCIAMENTO DE USUÁRIOS
// (AGORA PROTEGIDAS PELO TOKEN)
// ==========================================

// LISTAR USUÁRIOS (Protegido)
app.get('/usuarios', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, nome, email, tipo FROM usuarios');
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// PEGAR UM USUÁRIO (Protegido)
app.get('/usuarios/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query('SELECT id, nome, email, tipo FROM usuarios WHERE id = ?', [id]);
        if (rows.length > 0) res.json(rows[0]);
        else res.status(404).json({ message: "Usuário não encontrado" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// ATUALIZAR USUÁRIO (Protegido)
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

// EXCLUIR USUÁRIO (Protegido)
app.delete('/usuarios/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM usuarios WHERE id = ?', [id]);
        res.json({ message: "Usuário excluído" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});


// ==========================================
// 3. ROTAS DE PDF (EXTRAÇÃO)
// ==========================================
app.post('/importar-pdf', upload.single('pdf'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "Nenhum arquivo." });
    
    console.log(`📂 Processando PDF na RAM: ${req.file.originalname}`);

    try {
        const dataBuffer = req.file.buffer; 
        const data = await pdf(dataBuffer);
        const text = data.text;

        const datas = text.match(/\d{2}\/\d{2}\/\d{4}/g) || [];
        const valores = text.match(/R\$\s?[\d\.,]+/g) || [];
        const placaMatch = text.match(/[A-Z]{3}[-]?[0-9][A-Z0-9][0-9]{2}/);

        const resultado = {
            datas: datas,
            valores: valores,
            placa: placaMatch ? placaMatch[0] : null
        };

        res.json(resultado);

    } catch (error) {
        console.error("❌ Erro PDF:", error);
        res.status(500).json({ message: "Erro ao ler PDF" });
    }
});


// ==========================================
// 4. ROTAS DE APÓLICES (CRUD)
// ==========================================

// CADASTRAR APÓLICE
app.post('/cadastrar-apolice', uploadSave.single('arquivo_pdf'), async (req, res) => {
    const d = req.body;
    const file = req.file; 

    try {
        const caminhoArquivo = file ? 'uploads/' + file.filename : null;

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
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao salvar no banco: " + error.message });
    }
});

// LISTAR TODAS AS APÓLICES
app.get('/apolices', async (req, res) => {
    try {
        const query = `
            SELECT 
                a.*, 
                p.nome as cliente_nome, 
                p.placa as veiculo_placa,
                p.modelo as veiculo_modelo
            FROM apolices a
            LEFT JOIN propostas p ON a.veiculo_id = p.id
            ORDER BY a.id DESC
        `;
        const [rows] = await pool.query(query);
        
        const formatado = rows.map(r => ({
            ...r,
            cliente: r.cliente_nome || 'Cliente Excluído/Desconhecido',
            placa: r.veiculo_placa || 'S/Placa'
        }));

        res.json(formatado);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// BUSCAR APÓLICE ÚNICA (PARA EDIÇÃO)
app.get('/apolices/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM apolices WHERE id = ?', [id]);
        if (rows.length > 0) res.json(rows[0]);
        else res.status(404).json({ message: "Apólice não encontrada" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// ATUALIZAR APÓLICE
app.put('/apolices/:id', async (req, res) => {
    const { id } = req.params;
    const d = req.body;

    const sql = `
        UPDATE apolices SET
            numero_apolice=?, vigencia_inicio=?, vigencia_fim=?, 
            premio_liquido=?, premio_total=?, franquia_casco=?
        WHERE id = ?
    `;
    
    const params = [
        d.numero_apolice, d.vigencia_inicio, d.vigencia_fim,
        d.premio_liquido, d.premio_total, d.franquia_casco,
        id
    ];

    try {
        await pool.query(sql, params);
        res.json({ message: "Apólice atualizada com sucesso!" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// EXCLUIR APÓLICE
app.delete('/apolices/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM apolices WHERE id = ?', [id]);
        res.json({ message: "Apólice excluída com sucesso!" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});


// ==========================================
// 5. ROTAS DE PROPOSTAS/CLIENTES (CRUD)
// ==========================================

// CADASTRAR PROPOSTA
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
    } catch (error) {
        console.error("Erro ao cadastrar proposta:", error);
        res.status(500).json({ message: "Erro ao salvar no banco: " + error.message });
    }
});

// LISTAR TODAS AS PROPOSTAS
app.get('/propostas', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM propostas ORDER BY id DESC');
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// PEGAR PROPOSTA PELO ID
app.get('/propostas/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM propostas WHERE id = ?', [req.params.id]);
        if (rows.length > 0) res.json(rows[0]);
        else res.status(404).json({ message: "Proposta não encontrada" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// ATUALIZAR PROPOSTA
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

// EXCLUIR PROPOSTA (CLIENTE)
app.delete('/propostas/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM apolices WHERE veiculo_id = ?', [id]);
        await pool.query('DELETE FROM propostas WHERE id = ?', [id]);
        res.json({ message: "Cliente excluído com sucesso!" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- ROTA DE RECUPERAÇÃO DE SENHA (SIMULADA) ---
// Esta rota responde ao pedido do recuperar.html
app.post('/auth/forgot-password', (req, res) => {
    const { email } = req.body;
    
    console.log(`[RECUPERAÇÃO] Solicitação recebida para o e-mail: ${email}`);

    // Aqui você validaria se o e-mail existe no banco de dados.
    // Como é uma simulação para o teste visual:
    if (!email) {
        return res.status(400).json({ message: "O e-mail é obrigatório." });
    }

    // Retorna sucesso para o Frontend (Status 200)
    // Na vida real, aqui enviaria o e-mail via Nodemailer/SendGrid
    return res.status(200).json({ 
        message: "Instruções enviadas! Verifique sua caixa de entrada (Simulação)." 
    });
});

// ==========================================
// 6. ROTA DE RELATÓRIOS (FILTROS AVANÇADOS)
// ==========================================
app.get('/relatorios', authenticateToken, async (req, res) => {
    try {
        const { inicio, fim, status, busca } = req.query;

        // Base da Query: Junta Propostas com Apólices para ter Valor e Status
        // Se a proposta tem apólice (a.id não é nulo), consideramos 'ativo'
        let sql = `
            SELECT 
                p.id, 
                p.nome, 
                p.email, 
                a.vigencia_inicio as data_cadastro, 
                COALESCE(a.premio_total, 0) as valor,
                CASE 
                    WHEN a.id IS NOT NULL THEN 'ativo' 
                    ELSE 'pendente' 
                END as status
            FROM propostas p
            LEFT JOIN apolices a ON a.veiculo_id = p.id
            WHERE 1=1
        `;

        const params = [];

        // 1. Filtro de Busca (Nome ou E-mail)
        if (busca) {
            sql += ` AND (p.nome LIKE ? OR p.email LIKE ?)`;
            params.push(`%${busca}%`, `%${busca}%`);
        }

        // 2. Filtro de Status (Ativo/Pendente)
        if (status) {
            if (status === 'ativo') {
                sql += ` AND a.id IS NOT NULL`; // Tem apólice
            } else if (status === 'pendente') {
                sql += ` AND a.id IS NULL`;     // Não tem apólice
            }
            // Se for 'cancelado', você precisaria de uma coluna específica no banco.
        }

        // 3. Filtro de Data (Baseado no início da vigência)
        if (inicio) {
            sql += ` AND a.vigencia_inicio >= ?`;
            params.push(inicio);
        }
        if (fim) {
            sql += ` AND a.vigencia_inicio <= ?`;
            params.push(fim);
        }

        // Ordenar por mais recente
        sql += ` ORDER BY p.id DESC`;

        const [rows] = await pool.query(sql, params);
        
        res.json(rows);

    } catch (error) {
        console.error("Erro no relatório:", error);
        res.status(500).json({ error: "Erro ao gerar relatório: " + error.message });
    }
});

// --- ROTA DE TESTE (RAIZ) ---
// Isso evita o erro 404 ao acessar https://seguradoraproject.onrender.com/
app.get('/', (req, res) => {
    res.status(200).send('API da Seguradora está ONLINE! 🚀');
});

// --- ROTA DE BOAS-VINDAS (Para não dar erro 404 na raiz) ---
app.get('/', (req, res) => {
    res.status(200).send('✅ API Seguradora funcionando 100%!');
});

// ROTA PARA BAIXAR PDF
// Adicione isso no server.js
const path = require('path');
const fs = require('fs');

app.get('/apolices/:id/pdf', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        // 1. Descobre o nome do arquivo no banco
        const result = await pool.query('SELECT arquivo_pdf FROM apolices WHERE id = $1', [id]);
        
        if (result.rows.length === 0 || !result.rows[0].arquivo_pdf) {
            return res.status(404).json({ message: 'Apólice não possui PDF vinculado.' });
        }

        const filename = result.rows[0].arquivo_pdf;
        // 2. Monta o caminho completo (ajuste 'uploads' se sua pasta tiver outro nome)
        const filePath = path.join(__dirname, 'uploads', filename);

        // 3. Verifica se o arquivo existe fisicamente
        if (fs.existsSync(filePath)) {
            // Envia o arquivo para o navegador
            res.sendFile(filePath);
        } else {
            console.error("Arquivo físico não encontrado:", filePath);
            res.status(404).json({ message: 'Arquivo não encontrado no servidor (Pode ter sido apagado pelo Render Free Tier).' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar PDF.' });
    }
});

// --- ADICIONE ISTO NO SEU SERVER.JS (BACKEND) ---

// 1. Rota para excluir PROPOSTA (Cliente)
app.delete('/propostas/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        // O comando SQL que apaga de verdade
        const result = await pool.query('DELETE FROM propostas WHERE id = $1', [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Cliente não encontrado para exclusão' });
        }
        
        res.status(200).json({ message: 'Cliente excluído com sucesso' });
    } catch (error) {
        console.error("Erro ao excluir proposta:", error);
        // Se der erro de chave estrangeira (FK), avisa o usuário
        if (error.code === '23503') {
            return res.status(400).json({ message: 'Não é possível excluir: Este cliente possui apólices vinculadas.' });
        }
        res.status(500).json({ message: 'Erro interno ao excluir cliente' });
    }
});

// 2. Rota para excluir USUÁRIO
app.delete('/usuarios/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
        res.status(200).json({ message: 'Usuário excluído com sucesso' });
    } catch (error) {
        console.error("Erro ao excluir usuário:", error);
        res.status(500).json({ message: 'Erro ao excluir usuário' });
    }
});

// 3. Rota para excluir APÓLICE
app.delete('/apolices/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM apolices WHERE id = $1', [id]);
        res.status(200).json({ message: 'Apólice excluída com sucesso' });
    } catch (error) {
        console.error("Erro ao excluir apólice:", error);
        res.status(500).json({ message: 'Erro ao excluir apólice' });
    }
});


app.listen(port, () => console.log(`🚀 Servidor rodando na porta ${port}`));