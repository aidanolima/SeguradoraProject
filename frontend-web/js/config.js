// js/config.js

// 1. DETECÇÃO AUTOMÁTICA DE AMBIENTE
const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';

// 2. DEFINIÇÃO GLOBAL DA API (A Mágica acontece aqui)
// Se for local, usa a porta 3000. Se for produção, usa o novo backend no Render.
const API_URL = isLocal 
    ? 'http://localhost:3000' 
    : 'https://seguradora-backend.onrender.com';

// 3. LOG PARA DEBUG (Para saber onde está a rodar)
console.log(`[Ambiente] Rodando em: ${isLocal ? 'DESENVOLVIMENTO (Local)' : 'PRODUÇÃO (Nuvem)'}`);
console.log(`[API] Conectando em: ${API_URL}`);