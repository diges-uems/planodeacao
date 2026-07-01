# Plano de Ação UEMS — PROE/DIGES

Este projeto é o frontend do sistema de Plano de Ação da Universidade Estadual de Mato Grosso do Sul (UEMS), focado no gerenciamento e acompanhamento de fragilidades acadêmicas. O sistema conecta um frontend moderno a um backend baseado em Google Apps Script + Google Sheets.

## Arquitetura

*   **Frontend**: React 19, TypeScript, Tailwind CSS v4, Vite, e componentes animados via `motion/react`.
*   **Backend / Banco de Dados**: Google Apps Script e Google Sheets, utilizando `doGet` e `doPost` para expor uma API REST.

## Pré-requisitos

*   Node.js ≥ 18

## Instalação e Execução Local

1.  Instale as dependências:
    ```bash
    npm install
    ```
2.  A URL do Apps Script está configurada diretamente no arquivo `src/lib/constants.ts` (variável `API_URL`). Isso facilita o deploy estático no GitHub Pages. Para alterar o backend, edite este arquivo.
3.  Inicie o servidor de desenvolvimento:
    ```bash
    npm run dev
    ```

## Configuração do Google Sheets

Para que o backend funcione corretamente, crie as seguintes abas no seu Google Sheets vinculado ao Apps Script:

*   `DADOS`: Tabela principal para armazenamento das fragilidades e acompanhamentos.
*   `CONFIG`: Contém a senha master e o salt. (Linha 1, Coluna 1 = senha master).
*   `CURSOS`: Cadastro de cursos com as colunas: `hash`, `courseId`, `courseName`. O `hash` é o base64 da senha do coordenador.
*   `CONFIG_PRAZOS`: Armazena as configurações de prazos limite (criado automaticamente na primeira execução de save_deadlines).

## Links Úteis

*   Aviso de segurança: consulte [SECURITY.md](./SECURITY.md).
*   Projeto criado no Google AI Studio: [https://aistudio.google.com/](https://aistudio.google.com/)
