const bcrypt = require('bcrypt');
const db = require('./src/config/db'); // Chama a sua conexão com o banco

async function criarAdmin() {
    try {
        // Criptografa a senha "123456" para o banco aceitar
        const senhaSegura = await bcrypt.hash('123456', 10);
        
        // Insere o usuário no banco usando o seu adaptador (?)
        await db.query(
            "INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)",
            ['Administrador', 'admin@admin.com', senhaSegura, 'admin']
        );
        
        console.log("✅ Usuário Admin criado com sucesso no PostgreSQL!");
        console.log("📧 E-mail para login: admin@admin.com");
        console.log("🔑 Senha: 123456");
        process.exit(0);
        
    } catch (error) {
        console.error("❌ Erro ao criar usuário:", error);
        process.exit(1);
    }
}

criarAdmin();