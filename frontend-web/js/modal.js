/*
  MODAL SYSTEM v2.0
  - showAlert: Exibe mensagem informativa.
  - showConfirm: Exibe pergunta com Sim/Não.
*/

// Cria o HTML do modal se não existir
function createModalElement() {
    let overlay = document.getElementById('custom-modal-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'custom-modal-overlay';
        overlay.className = 'custom-modal-overlay';
        overlay.innerHTML = `
            <div class="custom-modal-box" id="custom-modal-box">
                <div class="custom-modal-title" id="custom-modal-title"></div>
                <div class="custom-modal-text" id="custom-modal-text"></div>
                <div id="custom-modal-actions" style="margin-top: 20px; display: flex; gap: 10px; justify-content: center;"></div>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    return overlay;
}

// 1. ALERTA SIMPLES (Sucesso/Erro)
function showAlert(titulo, mensagem, tipo = 'success', callback = null) {
    createModalElement();
    
    const overlay = document.getElementById('custom-modal-overlay');
    const box = document.getElementById('custom-modal-box');
    const titleEl = document.getElementById('custom-modal-title');
    const textEl = document.getElementById('custom-modal-text');
    const actionsEl = document.getElementById('custom-modal-actions');

    // Configura Textos
    titleEl.innerText = titulo;
    textEl.innerText = mensagem;

    // Configura Estilo (Erro ou Sucesso)
    if (tipo === 'error') box.classList.add('error');
    else box.classList.remove('error');

    // Configura Botão Único
    actionsEl.innerHTML = `<button class="custom-modal-btn" id="modal-btn-ok">Entendi</button>`;
    
    // Ação do Botão
    document.getElementById('modal-btn-ok').onclick = function() {
        closeAlert();
        if (callback) callback(); // Executa ação após fechar, se houver
    };

    overlay.classList.add('active');
}

// 2. CONFIRMAÇÃO (Sim/Não)
function showConfirm(titulo, mensagem, onConfirm) {
    createModalElement();

    const overlay = document.getElementById('custom-modal-overlay');
    const box = document.getElementById('custom-modal-box');
    const titleEl = document.getElementById('custom-modal-title');
    const textEl = document.getElementById('custom-modal-text');
    const actionsEl = document.getElementById('custom-modal-actions');

    titleEl.innerText = titulo;
    textEl.innerText = mensagem;
    
    // Remove estilo de erro caso exista
    box.classList.remove('error');

    // Cria os dois botões
    actionsEl.innerHTML = `
        <button class="custom-modal-btn" id="modal-btn-cancel" style="background-color: #ccc; color: #333;">Cancelar</button>
        <button class="custom-modal-btn" id="modal-btn-confirm" style="background-color: #e53935;">Sim, Excluir</button>
    `;

    // Ação Cancelar
    document.getElementById('modal-btn-cancel').onclick = closeAlert;

    // Ação Confirmar
    document.getElementById('modal-btn-confirm').onclick = function() {
        closeAlert();
        if (onConfirm) onConfirm(); // Executa a função de exclusão
    };

    overlay.classList.add('active');
}

function closeAlert() {
    const overlay = document.getElementById('custom-modal-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}