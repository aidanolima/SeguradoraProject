const db = require('../config/db');

// 1. REGISTRAR (CRIAR)
exports.register = async (req, res) => {
    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha) return res.status(400).json({ message: 'Preencha todos os campos!' });

    try {
        const [existing] = await db.execute('SELECT * FROM Usuarios WHERE email = ?', [email]);
        if (existing.length > 0) return res.status(409).json({ message: 'E-mail já cadastrado.' });

        const [result] = await db.execute('INSERT INTO Usuarios (nome, email, senha) VALUES (?, ?, ?)', [nome, email, senha]);
        res.status(201).json({ message: 'Usuário criado!', id: result.insertId });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao criar usuário.' });
    }
};

// 2. LOGIN
exports.login = async (req, res) => {
    const { email, senha } = req.body;
    try {
        const [users] = await db.execute('SELECT * FROM Usuarios WHERE email = ? AND senha = ?', [email, senha]);
        if (users.length > 0) {
            res.json({ message: 'Login OK', user: { nome: users[0].nome, email: users[0].email } });
        } else {
            res.status(401).json({ message: 'Credenciais inválidas.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Erro no servidor.' });
    }
};

// 3. RECUPERAR SENHA
exports.forgotPassword = async (req, res) => {
    res.json({ message: 'Se o e-mail existir, enviamos o link.' });
};

// 4. LISTAR TODOS (Para o Dashboard)
exports.listar = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT id_usuario, nome, email, data_criacao FROM Usuarios ORDER BY id_usuario DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao listar.' });
    }
};

// 5. OBTER UM POR ID (Para Edição)
exports.obterPorId = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT id_usuario, nome, email FROM Usuarios WHERE id_usuario = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Usuário não encontrado' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar usuário.' });
    }
};

// 6. ATUALIZAR
exports.atualizar = async (req, res) => {
    const { id } = req.params;
    const { nome, email, senha } = req.body;

    try {
        // Se a senha vier vazia, atualiza só nome e email. Se vier preenchida, atualiza tudo.
        if (senha) {
            await db.execute('UPDATE Usuarios SET nome=?, email=?, senha=? WHERE id_usuario=?', [nome, email, senha, id]);
        } else {
            await db.execute('UPDATE Usuarios SET nome=?, email=? WHERE id_usuario=?', [nome, email, id]);
        }
        res.json({ message: 'Usuário atualizado com sucesso!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao atualizar usuário.' });
    }
};

// 7. EXCLUIR
exports.excluir = async (req, res) => {
    try {
        await db.execute('DELETE FROM Usuarios WHERE id_usuario = ?', [req.params.id]);
        res.json({ message: 'Usuário excluído.' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao excluir.' });
    }
};