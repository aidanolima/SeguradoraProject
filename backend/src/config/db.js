const mysql = require('mysql2');

// Configuração da conexão com o banco criado no script SQL anterior
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',          // Seu usuário do MySQL
    password: '054622', // Sua senha do MySQL
    database: 'SeguradoraAuto',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Exporta o wrapper com suporte a Promises (async/await)
module.exports = pool.promise();