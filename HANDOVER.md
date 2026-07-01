# HANDOVER: Sistema Plano de Ação (ENADE) - UEMS/PROE

## 1. Visão Geral do Sistema
Este sistema foi projetado para coletar e gerenciar fragilidades e planos de ação relacionados à avaliação institucional (ENADE) dos cursos da UEMS.
Ele é utilizado por:
- **Coordenadores de Curso**: Acessam uma visão restrita (dashboard/formulário) para inserir as fragilidades, traçar ações, verificar os status e preencher atualizações relativas exclusivamente ao seu curso.
- **Equipe PROE (Reitoria)**: Acessam um dashboard administrativo com visão unificada de todos os cursos, podendo filtrar por ano, curso e unidade, definir prazos internos, aprovar a liberação de edições dos coordenadores e exportar relatórios (PDF).

## 2. Arquitetura
A arquitetura baseia-se num modelo *serverless* com uso nativo das ferramentas do Google Workspace:
- **Frontend**: Aplicação React, gerada via Vite. O código fica neste repositório. O estilo usa Tailwind CSS, focado na identidade visual da UEMS (Navy e Gold).
- **Backend e Banco de Dados**: Google Sheets e Google Apps Script. 
  - Não há um banco de dados tradicional (SQL/NoSQL) em infraestrutura de nuvem, todas as tabelas e dados estão contidos diretamente em planilhas.
  - O código do backend (`code.gs`) é executado como um Web App (via `doPost` e `doGet`) respondendo as requisições HTTP enviadas pelo frontend.

## 3. Onde estão as coisas
- **Planilha Principal**: Pode ser acessada via link (id `1Ewz43i-0necjcF9q9RniuJDIqruTFHPg62kLh46XZis`) a partir do botão "Abrir Planilha" (apenas PROE).
- **Código do Backend**: Está no arquivo `code.gs`, que deve ser colado em Extensões -> Apps Script na Planilha Principal.
- **Integração Frontend-Backend**: No frontend, o arquivo `/src/lib/api.ts` contém as chamadas e o endereço (URL) da implantação do Apps Script (`API_URL`). 
- **Como publicar (Deploy) alterações no Backend**:
  1. No Google Apps Script, após salvar `code.gs`, clique em **Implantar** -> **Gerenciar implantações**.
  2. Escolha o item da implantação atual, clique no ícone de lápis (Editar).
  3. No campo "Versão", selecione **Nova versão**.
  4. Clique em **Implantar**. (O uso da opção "Nova versão" é obrigatório, caso contrário o link antigo continuará executando código desatualizado).

## 4. Papéis de Usuário
- **Reitoria (PROE)**: Loga no frontend usando uma senha mestre (definida na aba `CONFIG` da planilha). Visualiza tudo e pode acessar botões como "Exportar PDF" e "Abrir Planilha". É quem autoriza alterações nos dados.
- **Coordenadores**: Logam utilizando um hash Base64 da senha e acessam unicamente os dados do próprio curso. Visualizam avisos e só podem editar/excluir registros após liberação pontual da PROE.

## 5. Fluxos Principais
1. **Cadastro e Envio**: Coordenador acessa o painel, preenche o formulário "Plano de Ação" (que tem modo "carrinho" para adicionar múltiplas fragilidades). Ele revisa e envia tudo de uma vez.
2. **Dashboard e Acompanhamento**: PROE monitora tudo no painel, define limites de datas/prazos (que refletem na aba `CONFIG_PRAZOS`) e exporta para PDF. O coordenador pode preencher acompanhamentos de cada fragilidade.
3. **Solicitação de Edição/Exclusão (Fluxo manual de liberação)**: 
   - Se o coordenador quiser corrigir algo após o envio, ele solicita por e-mail para enade@uems.br.
   - A equipe PROE abre a planilha manualmente (na aba `CURSOS`) e digita **SIM** na coluna "Liberado" correspondente à linha daquele curso.
   - Os botões de Editar/Excluir passam a aparecer automaticamente no Dashboard do coordenador, e as rotas do backend são destravadas para ele.
   - Qualquer edição ou exclusão do coordenador é registrada em abas de auditoria (`Atualizações` ou `Exclusões`) para rastreabilidade pela PROE.

## 6. Pontos de Atenção Conhecidos (Bugs Históricos)
- **Bug de Datas no Sheets**: Ao receber datas como "dd/MM/yyyy", o Sheets por vezes tentava converter automaticamente para um objeto `Date` embutindo o fuso horário padrão, criando dessincronia na exibição. O sistema utiliza a função `formatarDataSegura()` no backend e força o armazenamento da coluna de datas com "texto simples" (via `setNumberFormat("@")` por script) para prevenir esse comportamento.
- **Notificações de Cursos**: O envio de e-mails diretos para as coordenações só ocorre se a flag global `NOTIFICACOES_POR_CURSO_ATIVAS` no `code.gs` for configurada para `true`. O sistema depende da aba `CURSOS_EMAIL` ou da coluna Email na aba `CURSOS` para achar os contatos.

## 7. Contato e Autoria
Desenvolvido por **Bruno Lopes** (DIND/PROE - UEMS) — 2026.

*Nota sobre Manutenção*: Este sistema foi construído com o apoio de ferramentas de Inteligência Artificial (Google AI Studio Build / Claude / Gemini). Caso um futuro mantenedor da UEMS precise alterar fluxos ou estilos e não tenha proficiência total nas linguagens base, é recomendado que utilize ferramentas semelhantes de IA com este código como contexto, descrevendo o ajuste ou correção desejados em linguagem natural. A própria IA guiará as modificações nas duas pontas (React e Sheets).

## Histórico de Alterações

- **01/07/2026**: Correção do filtro de leitura de abas no backend (`doGet`) para incluir exclusivamente abas de ano com 4 dígitos (whitelist), e remoção do botão de Acompanhamento para usuários com perfil PROE no Dashboard.
- **01/07/2026**: Refatoração do modelo de liberação e auditoria manual (coluna Liberado e registro de edições/exclusões), atualização da identidade visual para o padrão Navy/Gold da UEMS, e geração deste documento HANDOVER.md.
