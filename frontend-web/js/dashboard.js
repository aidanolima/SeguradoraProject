// ==========================================
// 3. LISTAR USUÁRIOS (BOTÕES IDÊNTICOS)
// ==========================================
async function carregarUsuarios() {
    const tbody = document.getElementById('lista-usuarios');
    if(!tbody) return; 

    try {
        const res = await fetch(`${API_URL}/usuarios`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            if (res.status === 403) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red">Acesso restrito a Admins.</td></tr>';
                return;
            }
            throw new Error('Erro ao buscar usuários');
        }

        const lista = await res.json();
        if (typeof atualizarCard === "function") atualizarCard('total-usuarios', lista.length);

        tbody.innerHTML = '';

        lista.forEach(u => {
            const tr = document.createElement('tr');
            
            const badgeClass = u.tipo === 'admin' ? 'badge-admin' : 'badge-user';
            const tipoLabel = u.tipo === 'admin' ? 'ADMIN' : u.tipo.toUpperCase();

            // Estilo Comum para garantir identidade visual
            const estiloBotao = `
                display: inline-block; 
                width: 80px; 
                padding: 8px 0; 
                font-size: 13px; 
                font-weight: bold; 
                font-family: sans-serif;
                text-align: center; 
                border-radius: 4px; 
                border: none; 
                cursor: pointer;
                text-decoration: none;
                line-height: normal;
                color: white;
            `;

            tr.innerHTML = `
                <td>${u.id}</td>
                <td>${u.nome}</td>
                <td>${u.email}</td>
                <td><span class="badge ${badgeClass}">${tipoLabel}</span></td>
                <td style="text-align: center; white-space: nowrap;">
                    
                    <a href="registro.html?id=${u.id}&origin=dashboard" 
                       style="${estiloBotao} background-color: #ffa000; margin-right: 5px;">
                       Editar
                    </a>

                    <button onclick="excluirItem('usuarios', ${u.id})" 
                            style="${estiloBotao} background-color: #d32f2f;">
                        Excluir
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error('Erro Usuários:', error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Erro ao carregar usuários.</td></tr>';
    }
}