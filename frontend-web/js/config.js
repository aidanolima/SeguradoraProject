// js/config.js

// DETECÇÃO AUTOMÁTICA DE AMBIENTE
// Se o site estiver rodando em "127.0.0.1" ou "localhost", é Desenvolvimento.
// Caso contrário, assume que é Produção (Nuvem).
const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';

const CONFIG = {
    development: {
        API_BASE_URL: 'http://localhost:3000', // Aponta para o seu Node.js local
    },
    production: {
        API_BASE_URL: 'https://seguradoraproject.onrender.com', // Sua URL da nuvem (quando tiver)
    }
};

const ENV = isLocal ? CONFIG.development : CONFIG.production;

// Variáveis Globais para usar nos outros arquivos
const BASE_API_URL = ENV.API_BASE_URL;
const API_URL = `${BASE_API_URL}/auth`; // Atalho para login

console.log(`[Ambiente] Rodando em: ${isLocal ? 'DESENVOLVIMENTO (Local)' : 'PRODUÇÃO (Nuvem)'}`);
console.log(`[API] Conectando em: ${BASE_API_URL}`);