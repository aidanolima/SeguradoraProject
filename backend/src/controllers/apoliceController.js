const db = require('../config/db');

// 1. LISTAR (JOIN COM CLIENTES E VEICULOS)
exports.listar = async (req, res) => {
    try {
        const sql = `
            SELECT 
                a.id_apolice, 
                a.numero_apolice, 
                c.nome_razao_social as cliente, 
                v.placa, 
                v.modelo,
                a.vigencia_inicio,
                a.vigencia_fim,
                a.premio_total
            FROM Apolices a
            INNER JOIN Veiculos v ON a.id_veiculo = v.id_veiculo
            INNER JOIN Clientes c ON v.id_cliente = c.id_cliente
            ORDER BY a.data_emissao DESC
        `;
        const [rows] = await db.execute(sql);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao listar apólices.' });
    }
};

// 2. BUSCAR VEÍCULOS DISPONÍVEIS (PARA O SELECT DO FORMULÁRIO)
exports.listarVeiculos = async (req, res) => {
    try {
        // Traz apenas veículos para preencher o <select>
        const sql = `
            SELECT v.id_veiculo, v.placa, v.modelo, c.nome_razao_social
            FROM Veiculos v
            JOIN Clientes c ON v.id_cliente = c.id_cliente
            ORDER BY c.nome_razao_social ASC
        `;
        const [rows] = await db.execute(sql);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar veículos.' });
    }
};

// 3. OBTER POR ID (PARA EDIÇÃO)
exports.obterPorId = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM Apolices WHERE id_apolice = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Apólice não encontrada' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar apólice.' });
    }
};

// 4. CRIAR APÓLICE
exports.criar = async (req, res) => {
    const d = req.body;
    try {
        const sql = `
            INSERT INTO Apolices (
                id_veiculo, numero_apolice, numero_proposta, data_emissao, 
                vigencia_inicio, vigencia_fim, premio_liquido, premio_total, 
                franquia_casco, cobertura_rcf_material, cobertura_vidros, 
                carro_reserva, forma_pagamento, qtd_parcelas
            ) VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        await db.execute(sql, [
            d.id_veiculo, d.numero_apolice, d.numero_proposta,
            d.vigencia_inicio, d.vigencia_fim, d.premio_liquido, d.premio_total,
            d.franquia_casco, d.cobertura_rcf_material, d.cobertura_vidros,
            d.carro_reserva, d.forma_pagamento, d.qtd_parcelas
        ]);

        res.status(201).json({ message: 'Apólice emitida com sucesso!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao criar apólice.' });
    }
};

// 5. ATUALIZAR
exports.atualizar = async (req, res) => {
    const d = req.body;
    const { id } = req.params;
    try {
        const sql = `
            UPDATE Apolices SET 
                numero_apolice=?, numero_proposta=?, vigencia_inicio=?, vigencia_fim=?, 
                premio_liquido=?, premio_total=?, franquia_casco=?, cobertura_rcf_material=?, 
                cobertura_vidros=?, carro_reserva=?, forma_pagamento=?, qtd_parcelas=?
            WHERE id_apolice=?
        `;
        await db.execute(sql, [
            d.numero_apolice, d.numero_proposta, d.vigencia_inicio, d.vigencia_fim,
            d.premio_liquido, d.premio_total, d.franquia_casco, d.cobertura_rcf_material,
            d.cobertura_vidros, d.carro_reserva, d.forma_pagamento, d.qtd_parcelas,
            id
        ]);
        res.json({ message: 'Apólice atualizada!' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao atualizar.' });
    }
};

// 6. EXCLUIR
exports.excluir = async (req, res) => {
    try {
        await db.execute('DELETE FROM Apolices WHERE id_apolice = ?', [req.params.id]);
        res.json({ message: 'Apólice excluída.' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao excluir.' });
    }
};