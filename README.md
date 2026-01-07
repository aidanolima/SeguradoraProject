# Seguradora Project

Este é um projeto de sistema de gerenciamento de apólices de seguro, desenvolvido para facilitar a administração de propostas e apólices de forma digital.

## 🚀 Funcionalidades

O sistema oferece uma gama de funcionalidades tanto para o cliente quanto para o administrador, incluindo:

-   **Autenticação de Usuário:** Sistema completo de registro, login e recuperação de senha.
-   **Dashboard Intuitivo:** Uma visão geral e centralizada para que os usuários possam acessar rapidamente as principais funcionalidades.
-   **Gerenciamento de Apólices:**
    -   Criação, visualização e atualização de apólices de seguro.
    -   Upload de documentos PDF associados a cada apólice.
-   **Gerenciamento de Propostas:**
    -   Acompanhamento do status das propostas de seguro.
-   **Relatórios:**
    -   Geração de relatórios para análise e tomada de decisão.

## 🛠️ Tecnologias Utilizadas

O projeto foi construído utilizando as seguintes tecnologias:

#### **Backend**

-   **Node.js:** Ambiente de execução para o servidor.
-   **Express.js:** Framework para a construção da API REST.
-   **MongoDB:** Banco de dados NoSQL para armazenamento dos dados (inferido a partir do uso comum com Mongoose/Node.js).
-   **Multer:** Middleware para o upload de arquivos.
-   **Dotenv:** Para gerenciamento de variáveis de ambiente.

#### **Frontend**

-   **HTML5:** Estrutura semântica das páginas.
-   **CSS3:** Estilização e design responsivo.
-   **JavaScript (Vanilla):** Manipulação do DOM e interatividade.
-   **Fetch API:** Para realizar requisições assíncronas ao backend.

## ⚙️ Como Executar o Projeto

Para executar o projeto em seu ambiente local, siga os passos abaixo.

#### **Pré-requisitos**

-   [Node.js](https://nodejs.org/en/) instalado.
-   Um servidor de banco de dados (como o MongoDB) em execução.

#### **1. Configurando o Backend**

Primeiro, clone o repositório e instale as dependências do backend.

```bash
git clone https://github.com/seu-usuario/SeguradoraProject.git
cd SeguradoraProject/backend
```

Instale as dependências:

```bash
npm install
```

Crie um arquivo `.env` na pasta `backend` e adicione as variáveis de ambiente necessárias. Um exemplo básico seria:

```
DB_CONNECT=mongodb://localhost:27017/seguradora
PORT=3000
```

Finalmente, inicie o servidor:

```bash
npm start
```

O servidor backend estará em execução em `http://localhost:3000`.

#### **2. Executando o Frontend**

O frontend é composto por arquivos estáticos. Basta abrir os arquivos `.html` diretamente em seu navegador.

1.  Navegue até a pasta `frontend-web`.
2.  Abra o arquivo `index.html` em seu navegador para iniciar pela página de login.

Certifique-se de que o arquivo `js/config.js` no frontend está configurado para apontar para a URL correta do backend (por padrão, `http://localhost:3000`).

## 📁 Estrutura do Projeto

O projeto está organizado da seguinte forma:

```
/
├── backend/                # Contém todo o código do servidor
│   ├── src/
│   │   ├── config/         # Configuração do banco de dados
│   │   ├── controllers/    # Lógica de negócio e endpoints da API
│   │   └── models/         # Schemas do banco de dados (se aplicável)
│   ├── uploads/            # Arquivos de apólice enviados
│   ├── .env                # Variáveis de ambiente
│   └── server.js           # Arquivo principal do servidor
│
└── frontend-web/           # Contém todo o código do cliente
    ├── css/                # Folhas de estilo
    ├── js/                 # Scripts JavaScript
    ├── assets/             # Imagens e outros recursos
    └── *.html              # Páginas da aplicação
```

---

Feito com por [ÁIdano lima](https://aidanolima.com.br/)
