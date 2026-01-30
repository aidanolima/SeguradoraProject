// js/masks.js

document.addEventListener('DOMContentLoaded', () => {
    aplicarMascaras();
});

function aplicarMascaras() {
    // 1. MÁSCARA DE DINHEIRO (R$ 1.000,00)
    const inputsDinheiro = document.querySelectorAll('.mask-dinheiro');
    inputsDinheiro.forEach(input => {
        input.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, ""); // Remove tudo que não é número
            value = (Number(value) / 100).toFixed(2).toString(); // Divide por 100 para ter centavos
            value = value.replace(".", ","); // Troca ponto por vírgula
            value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1."); // Coloca ponto nos milhares
            e.target.value = "R$ " + value;
        });
    });

    // 2. MÁSCARA DE CPF (000.000.000-00)
    const inputsCPF = document.querySelectorAll('.mask-cpf');
    inputsCPF.forEach(input => {
        input.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, "");
            if (v.length > 11) v = v.slice(0, 11); // Limita tamanho
            v = v.replace(/(\d{3})(\d)/, "$1.$2");
            v = v.replace(/(\d{3})(\d)/, "$1.$2");
            v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
            e.target.value = v;
        });
    });

    // 3. MÁSCARA DE TELEFONE ((00) 00000-0000)
    const inputsTelefone = document.querySelectorAll('.mask-telefone');
    inputsTelefone.forEach(input => {
        input.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, "");
            if (v.length > 11) v = v.slice(0, 11);
            v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
            v = v.replace(/(\d)(\d{4})$/, "$1-$2");
            e.target.value = v;
        });
    });
    
    // 4. MÁSCARA DE CEP (00000-000)
    const inputsCEP = document.querySelectorAll('.mask-cep');
    inputsCEP.forEach(input => {
        input.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, "");
            if (v.length > 8) v = v.slice(0, 8);
            v = v.replace(/^(\d{5})(\d)/, "$1-$2");
            e.target.value = v;
        });
    });
}