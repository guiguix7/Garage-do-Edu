# Guia de Contribuicao

Obrigado por considerar contribuir com o projeto Garage do Edu! Siga os passos abaixo para mantermos um fluxo organizado.

## Requisitos Basicos
- Utilize Node.js 18 ou superior.
- Configure o arquivo `.env` do backend a partir de `.env.example` antes de rodar os testes.
- Execute `npm install` tanto em `Projeto/BACKEND` quanto em `Projeto/Frontend`.

## Fluxo de Trabalho
1. Abra uma issue descrevendo a melhoria ou correcoes desejadas.
2. Crie um fork ou uma branch dedicada (`feat/nome`, `fix/nome`).
3. Garanta que o lint e os testes relevantes estejam passando antes do commit.
4. Utilize mensagens de commit objetivas (ex.: `feat: integra carros com API`).
5. Abra o pull request referenciando a issue correspondente e descreva claramente o que mudou.

## Padroes de Codigo
- JavaScript: prefira ES2020+, padrao de modulos `type: module` no backend.
- CSS/HTML: mantenha classes sem espacos e utilize BEM quando possivel.
- Comentarios devem explicar blocos complexos, evitando redundancia.

## Testes
- Rode `node tests/auth_diagnostics.mjs` (com experimental-fetch habilitado) para validar fluxo de autenticacao.
- Adicione testes para novas funcionalidades sempre que viavel.

## Revisao de Codigo
- Espere revisao de pelo menos uma pessoa antes de fazer merge.
- Esteja preparado para responder perguntas e aplicar ajustes sugeridos.

## Comunidade
- Mantenha a conversa cordial e inclusiva.
- Respeite o codigo de conduta padrao: nada de assedio, discriminacao ou linguagem ofensiva.

Boas contribuicoes!
