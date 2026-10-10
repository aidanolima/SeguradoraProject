CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    id_usuario INTEGER GENERATED ALWAYS AS (id) STORED UNIQUE,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(180) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    tipo VARCHAR(30) NOT NULL DEFAULT 'usuario',
    url_foto TEXT,
    reset_token TEXT,
    reset_token_expires TIMESTAMP,
    data_criacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clientes (
    id_cliente SERIAL PRIMARY KEY,
    nome_razao_social VARCHAR(180) NOT NULL,
    documento VARCHAR(30),
    email VARCHAR(180),
    telefone VARCHAR(30),
    endereco_cep VARCHAR(20),
    endereco_logradouro VARCHAR(180),
    endereco_bairro VARCHAR(120),
    endereco_cidade VARCHAR(120),
    endereco_uf CHAR(2),
    data_cadastro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS veiculos (
    id_veiculo SERIAL PRIMARY KEY,
    id_cliente INTEGER NOT NULL REFERENCES clientes(id_cliente) ON DELETE CASCADE,
    fabricante VARCHAR(100),
    modelo VARCHAR(120),
    ano_modelo VARCHAR(10),
    placa VARCHAR(20),
    chassi VARCHAR(40),
    codigo_fipe VARCHAR(30),
    uso_veiculo VARCHAR(80),
    blindado BOOLEAN NOT NULL DEFAULT FALSE,
    kit_gas BOOLEAN NOT NULL DEFAULT FALSE,
    zero_km BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS propostas (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(180) NOT NULL,
    documento VARCHAR(30),
    email VARCHAR(180),
    telefone VARCHAR(30),
    placa VARCHAR(20),
    modelo VARCHAR(120),
    cep VARCHAR(20),
    endereco VARCHAR(180),
    bairro VARCHAR(120),
    cidade VARCHAR(120),
    uf CHAR(2),
    numero VARCHAR(30),
    complemento VARCHAR(120),
    fabricante VARCHAR(100),
    chassi VARCHAR(40),
    ano_modelo VARCHAR(10),
    fipe VARCHAR(30),
    utilizacao VARCHAR(80),
    blindado VARCHAR(20),
    kit_gas VARCHAR(20),
    zero_km VARCHAR(20),
    cep_pernoite VARCHAR(20),
    cobertura_casco VARCHAR(80),
    carro_reserva VARCHAR(80),
    forma_pagamento VARCHAR(80),
    observacoes TEXT,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    data_cadastro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS apolices (
    id SERIAL PRIMARY KEY,
    id_apolice INTEGER GENERATED ALWAYS AS (id) STORED UNIQUE,
    numero_apolice VARCHAR(80),
    numero_proposta VARCHAR(80),
    veiculo_id INTEGER REFERENCES propostas(id) ON DELETE SET NULL,
    id_veiculo INTEGER REFERENCES veiculos(id_veiculo) ON DELETE SET NULL,
    arquivo_pdf TEXT,
    premio_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    premio_liquido NUMERIC(12, 2) NOT NULL DEFAULT 0,
    franquia_casco NUMERIC(12, 2) NOT NULL DEFAULT 0,
    vigencia_inicio DATE,
    vigencia_fim DATE,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    valor_comissao NUMERIC(12, 2) NOT NULL DEFAULT 0,
    valor_repasse NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'EMITIDA',
    data_emissao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cobertura_rcf_material NUMERIC(12, 2),
    cobertura_vidros VARCHAR(80),
    carro_reserva VARCHAR(80),
    forma_pagamento VARCHAR(80),
    qtd_parcelas INTEGER
);

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_propostas_usuario_id ON propostas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_apolices_usuario_id ON apolices(usuario_id);
CREATE INDEX IF NOT EXISTS idx_apolices_status ON apolices(status);
