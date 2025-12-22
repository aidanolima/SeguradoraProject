document.addEventListener("DOMContentLoaded", function() {
    const formLogin = document.getElementById('form-login');

    formLogin.addEventListener('submit', function(e) {
        e.preventDefault(); // Não recarrega a página

        const nome = document.getElementById('nome_login').value;
        const email = document.getElementById('email_login').value;
        const senha = document.getElementById('senha_login').value;

        // Validação simples
        if (nome && email && senha) {
            
            // Simulação de Login:
            // Vamos salvar o nome do usuário no "Local Storage" do navegador
            // para mostrar um "Olá, [Nome]" na próxima tela.
            localStorage.setItem('usuario_logado', nome);
            localStorage.setItem('email_logado', email);

            // Efeito visual no botão
            const btn = formLogin.querySelector('button');
            btn.innerText = 'Entrando...';
            btn.style.backgroundColor = '#ccc';

            // Redireciona para a tela de cadastro após 1 segundo
            setTimeout(() => {
                window.location.href = 'cadastro.html';
            }, 1000);

        } else {
            alert("Por favor, preencha todos os campos.");
        }
    });
});