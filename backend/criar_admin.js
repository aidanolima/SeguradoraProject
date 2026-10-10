const bcrypt = require('bcrypt');
const { Client } = require('pg'); // Usa o driver do Postgres diretamente

// ⚠️ COLE AQUI O SEU EXTERNAL DATABASE URL DO RENDER
const externalUrl = "postgresql://postgrescorretor:kDuL2CD3HAbtu2Yx9wSci0Jps2gXL6BM@dpg-db4q2vp42hec73ej6130-a.oregon-postgres.render.com/seguradora_auto";

async function criarAdmin() {
    // Configura a ligação forçando o uso de SSL
    const client = new Client({
        connectionString: externalUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const senhaSegura = await bcrypt.hash('123456', 10);
        
        // No driver nativo, usamos $1, $2 em vez de ?
        await client.query(
            "INSERT INTO usuarios (nome, email, senha, tipo) VALUES ($1, $2, $3, $4)",
            ['Administrador', 'admin@admin.com', senhaSegura, 'admin']
        );
        
        console.log("✅ Usuário Admin criado com sucesso na NUVEM!");
        process.exit(0);
        
    } catch (error) {
        console.error("❌ Erro:", error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

criarAdmin();