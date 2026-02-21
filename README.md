# Garage do Edu

![Garage do Edu](Frontend/SRC/ASSETS/IMG/garage%20do%20edu%20logo.jpg)

![Status](https://img.shields.io/badge/status-em%20desenvolvimento-orange) ![Node.js](https://img.shields.io/badge/backend-Node.js-43853D?logo=node.js&logoColor=white) ![React](https://img.shields.io/badge/frontend-React-61DAFB?logo=react&logoColor=white) ![License](https://img.shields.io/badge/licenca-a%20definir-lightgrey)

## Sumario
- [Descricao](#descricao)
- [Visao Geral do Estado Atual](#visao-geral-do-estado-atual)
- [Arquitetura do Projeto](#arquitetura-do-projeto)
- [Funcionalidades](#funcionalidades)
- [Backlog Prioritario](#backlog-prioritario)
- [Como Rodar Localmente](#como-rodar-localmente)
  - [Backend](#backend)
  - [Frontend](#frontend)
  - [Testes e Diagnosticos](#testes-e-diagnosticos)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Contribuicao](#contribuicao)
- [Licenca](#licenca)
- [Autores](#autores)

## Descricao
Garage do Edu e uma plataforma em construcao para divulgar e gerenciar a venda de carros classicos. O projeto engloba uma landing page rica em interacao, um painel administrativo para gestao de estoque e um backend em Node.js responsavel por autenticacao e CRUD de carros e usuarios.

## Visao Geral do Estado Atual
- ### Frontend
  - Landing page estatico-dinamica com filtros de inventario, modal de detalhes e links de WhatsApp configurados manualmente.
  - Assets organizados em CSS, HTML e SCRIPT; arquitetura React (Vite) iniciada porem ainda sem implementacao em `SRC/`.
  - Paginas auxiliares (login, cadastro, admin) com layout definido, mas sem integracao real com API.
- ### Backend
  - API Express com rotas para autenticacao (`/auth`), usuarios (`/user`) e carros (`/cars`).
  - Integracao com MongoDB utilizando driver oficial; respostas padronizadas em helpers.
  - Middleware de seguranca basico (rate limit para auth e CORS configuravel) ja presente.

## Arquitetura do Projeto
```
Projeto/
├── API/                    # reservado para futuras integracoes externas
├── BACKEND/                # aplicacao Node.js + Express
│   ├── SRC/
│   │   ├── AUTH/           # rotas e helpers de autenticacao
│   │   ├── CONTROLLERS/    # regras de negocio por dominio
│   │   ├── DATA/           # acesso direto ao MongoDB
│   │   ├── DB/             # modulo de conexao
│   │   ├── HELPERS/        # utilitarios de resposta
│   │   └── ROUTES/         # organizacao das rotas Express
│   └── carsData.json       # dataset de exemplo para seed manual
├── Frontend/               # landing page + prototipos React
│   ├── CSS/                # estilos para landing, login e admin
│   ├── HTML/               # paginas estaticas auxiliares
│   ├── SCRIPT/             # logica vanilla JS da landing e admin
│   ├── SRC/                # esqueleto React (Vite)
│   └── Public/             # assets publicos
└── tests/
    └── auth_diagnostics.mjs# script de diagnostico das rotas de auth
```

## Funcionalidades
- ✅ Cadastro e login via `/auth/signup` e `/auth/login`, com validacao basica de email e senha e emissao de JWT.
- ✅ CRUD de carros (listar, criar, atualizar, excluir) via `/cars`, inclusive filtro `/cars/availables`.
- ✅ Lista de usuarios com exclusao e (parcial) atualizacao via `/user`.
- ✅ Landing page com filtro de inventario, modal de detalhes e links para WhatsApp pre-preenchidos.
- ⚠️ Painel admin com UI funcional porem desconectado do backend.
- ⚠️ Scripts React (`SRC/`) ainda vazios; implementacao atual usa HTML/JS tradicional.

## Backlog Prioritario
1. **Autenticacao no frontend**: conectar formularios de login e cadastro aos endpoints de auth, armazenando o token JWT com rotas protegidas no admin.
2. **Protecao de rotas no backend**: adicionar middleware de autenticacao JWT antes de permitir acesso a `/user` e operacoes de escrita em `/cars`.
3. **Validacao de dados**: aplicar validacao de corpo (Joi/Zod) para cadastros de carros e usuarios.
4. **Correcoes conhecidas**:
   - Metodo `updateUser` em `BACKEND/SRC/DATA/user.js` utiliza uma variavel `password` inexistente ao recalcular hash (gera ReferenceError em updates).
   - Arquivo `.env` com credenciais reais esta versionado; migrar valores para `.env.example` e manter segredos fora do repositorio.
5. **Integracao de dados reais no front**: substituir cards estaticos por dados retornados do backend e sincronizar modal/load more.
6. **Paginas auxiliares**: implementar `HTML/anuncio.html` para detalhes por ID e `HTML/feedback.html` consumindo futuros endpoints.

## Como Rodar Localmente
Antes de iniciar, instale [Node.js](https://nodejs.org) (>= 18) e configure o MongoDB (Atlas ou local).

### Backend
```bash
cd Projeto/BACKEND
cp .env.example .env   # crie o arquivo e preencha com seus valores
npm install
npm run dev
```
Arquivo `.env` esperado:
```
MONGO_CS=coloque_sua_connection_string
MONGO_DB_NAME=Garage_do_Edu
JWT_SECRET=defina_um_segredo_forte
AUTH_COOKIE_NAME=garage_session
AUTH_COOKIE_MAX_AGE_MS=604800000
AUTH_COOKIE_SECURE=false
AUTH_COOKIE_SAMESITE=lax
CORS_ORIGINS=http://localhost:5173
```

### Frontend
```bash
cd Projeto/Frontend
npm install
npm run dev
```
Por enquanto os assets estaticos estao em `index.html`. Utilize o servidor Vite para futuras pages em React (`SRC/`).

### Testes e Diagnosticos
O script `tests/auth_diagnostics.mjs` executa um fluxo basico de signup/login contra o backend local.
```bash
cd Projeto
env NODE_OPTIONS=--experimental-fetch node tests/auth_diagnostics.mjs
```
> Observacao: se os testes falharem por usuario duplicado, limpe a colecao `users` ou ajuste o sufixo gerado.

## Tecnologias Utilizadas
- [Node.js](https://nodejs.org/en) e [Express](https://expressjs.com/) no backend.
- [MongoDB](https://www.mongodb.com/) para persistencia.
- [JWT](https://jwt.io/) + [bcrypt](https://github.com/kelektiv/node.bcrypt.js) para autenticacao.
- [Vite](https://vitejs.dev/) com [React](https://react.dev/) iniciado no frontend.
- HTML5, CSS3 e JavaScript vanilla para a landing page atual.

## Contribuicao
Contribuicoes sao bem-vindas! Leia o guia em [CONTRIBUTING.md](CONTRIBUTING.md) antes de abrir issues ou pull requests. Por favor siga as convencoes de commit e mantenha segredos fora do versionamento.

## Licenca
Licenca ainda nao definida. Sugestao: adotar MIT ou outra licenca open-source e incluir arquivo `LICENSE` adequado.

## Autores
- Eduardo Arcos (produto e conteudo)
- Guilherme Andraz (desenvolvimento)

> Ultima revisao: 05/02/2026. Atualize este README conforme novas entregas forem concluidas.
