require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'seguradora_auto',
    port: Number(process.env.DB_PORT || 5432),
    max: Number(process.env.DB_CONNECTION_LIMIT || 10),
    ssl: process.env.DB_HOST && process.env.DB_HOST.includes('render.com') ? { rejectUnauthorized: false } : false
});

const normalizeSql = (sql) => {
    let index = 0;
    return sql.replace(/\?/g, () => `$${++index}`);
};

const formatResult = (result) => {
    const rows = result.rows || [];
    const metadata = {
        rowCount: result.rowCount,
        insertId: rows[0]?.id || rows[0]?.id_usuario || rows[0]?.id_apolice || rows[0]?.id_cliente
    };

    return [rows, metadata];
};

const query = async (sql, params = []) => {
    const result = await pool.query(normalizeSql(sql), params);
    return formatResult(result);
};

const getConnection = async () => {
    const client = await pool.connect();

    return {
        query: async (sql, params = []) => formatResult(await client.query(normalizeSql(sql), params)),
        execute: async (sql, params = []) => formatResult(await client.query(normalizeSql(sql), params)),
        beginTransaction: () => client.query('BEGIN'),
        commit: () => client.query('COMMIT'),
        rollback: () => client.query('ROLLBACK'),
        release: () => client.release()
    };
};

module.exports = {
    pool,
    query,
    execute: query,
    getConnection
};
