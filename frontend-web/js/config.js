// js/config.js

// 1. DETECÇÃO AUTOMÁTICA DE AMBIENTE
const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';

const CONFIG = {
    development: {
        API_BASE_URL: 'http://localhost:3000', 
    },
    production: {
        API_BASE_URL: 'https://apolicesystem.onrender.com', 
    }
};

// 2. DEFINIÇÃO GLOBAL DA API (A Mágica acontece aqui)
// Isso escolhe qual URL usar baseada no ambiente
const API_URL = isLocal ? CONFIG.development.API_BASE_URL : CONFIG.production.API_BASE_URL;

// 3. LOG PARA DEBUG (Para você saber onde está rodando)
console.log(`[Ambiente] Rodando em: ${isLocal ? 'DESENVOLVIMENTO (Local)' : 'PRODUÇÃO (Nuvem)'}`);
console.log(`[API] Conectando em: ${API_URL}`);