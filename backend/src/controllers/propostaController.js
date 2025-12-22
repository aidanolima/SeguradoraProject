const db = require('../config/db');

// 1. LISTAR TODAS (Para o Dashboard)
exports.listar = async (req, res) => {
    try {
        // Buscamos dados combinados de Cliente e Veículo
        const sql = `
            SELECT c.id_cliente, c.nome_razao_social as nome, c.documento, c.email, 
                   v.modelo, v.placa, c.data_cadastro
            FROM Clientes c
            LEFT JOIN Veiculos v ON c.id_cliente = v.id_cliente
            ORDER BY c.data_cadastro DESC
        `;
        const [rows] = await db.execute(sql);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao listar propostas.' });
    }
};

// 2. OBTER UMA ÚNICA (Para Edição)
exports.obterPorId = async (req, res) => {
    const { id } = req.params;
    try {
        const sql = `
            SELECT 
                c.id_cliente, c.nome_razao_social as nome, c.documento, c.email, c.telefone,
                c.endereco_cep as cep, c.endereco_logradouro as endereco, c.endereco_bairro as bairro,
                c.endereco_cidade as cidade, c.endereco_uf as uf, 
                -- Veiculo
                v.id_veiculo, v.fabricante, v.modelo, v.ano_modelo, v.placa, v.chassi, v.codigo_fipe as fipe,
                v.uso_veiculo as utilizacao, v.blindado, v.kit_gas, v.zero_km
            FROM Clientes c
            LEFT JOIN Veiculos v ON c.id_cliente = v.id_cliente
            WHERE c.id_cliente = ?
        `;
        const [rows] = await db.execute(sql, [id]);
        
        if (rows.length === 0) return res.status(404).json({ message: 'Cliente não encontrado' });
        
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar dados.' });
    }
};

// 3. ATUALIZAR (PUT)
exports.atualizar = async (req, res) => {
    const { id } = req.params;
    const dados = req.body;
    
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();

        // Atualiza Cliente
        await connection.execute(`
            UPDATE Clientes SET 
                nome_razao_social=?, email=?, telefone=?, 
                endereco_cep=?, endereco_logradouro=?, endereco_bairro=?, endereco_cidade=?, endereco_uf=?
            WHERE id_cliente=?`,
            [dados.nome, dados.email, dados.telefone, dados.cep, dados.endereco, dados.bairro, dados.cidade, dados.uf, id]
        );

        // Atualiza Veículo
        await connection.execute(`
            UPDATE Veiculos SET 
                fabricante=?, modelo=?, ano_modelo=?, placa=?, chassi=?, codigo_fipe=?, 
                uso_veiculo=?, blindado=?, kit_gas=?, zero_km=?
            WHERE id_cliente=?`,
            [
                dados.fabricante, dados.modelo, dados.ano_modelo, dados.placa, dados.chassi, dados.fipe,
                dados.utilizacao, dados.blindado ? 1 : 0, dados.kit_gas ? 1 : 0, dados.zero_km ? 1 : 0, 
                id
            ]
        );

        await connection.commit();
        res.json({ message: 'Cadastro atualizado com sucesso!' });

    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ message: 'Erro ao atualizar.' });
    } finally {
        connection.release();
    }
};

// 4. EXCLUIR (DELETE)
exports.excluir = async (req, res) => {
    const { id } = req.params;
    try {
        // O ON DELETE CASCADE no banco apaga o veículo automaticamente ao apagar o cliente
        await db.execute('DELETE FROM Clientes WHERE id_cliente = ?', [id]);
        res.json({ message: 'Registro excluído com sucesso.' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao excluir.' });
    }
};