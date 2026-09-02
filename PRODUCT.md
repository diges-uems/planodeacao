# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Coordenadores de Curso**: acessam visão restrita ao próprio curso para registrar fragilidades institucionais (ENADE), traçar ações, atualizar status e acompanhar liberações de edição.
- **Equipe PROE (Reitoria)**: acessam dashboard administrativo unificado de todos os cursos, com filtro por ano/curso/unidade, definição de prazos internos, liberação pontual de edições e exportação de relatórios em PDF.

## Product Purpose

Coletar e gerenciar fragilidades e planos de ação institucionais ligados à avaliação ENADE dos cursos da UEMS (Universidade Estadual de Mato Grosso do Sul), substituindo controle manual em planilha por um fluxo estruturado de envio (coordenador) e acompanhamento/aprovação (PROE), com trilha de auditoria.

## Positioning

Ferramenta institucional específica da UEMS/PROE para governança do plano de ação ENADE: fluxo de liberação/auditoria manual (coluna "Liberado" na planilha) integrado a um formulário estruturado — não é um formulário genérico, é o sistema oficial de registro dessas fragilidades para a instituição.

## Operating Context

- Backend serverless: Google Apps Script (`code.gs`, `doGet`/`doPost`) + Google Sheets como banco de dados (abas `DADOS`, `CONFIG`, `CURSOS`, `CONFIG_PRAZOS`, `Atualizações`, `Exclusões`).
- Login por senha: PROE usa senha mestre (aba `CONFIG`); coordenadores usam hash Base64 de senha por curso (aba `CURSOS`).
- Fluxo de liberação manual: coordenador solicita edição por e-mail (enade@uems.br); PROE libera manualmente na planilha; botões de Editar/Excluir aparecem condicionalmente no dashboard do coordenador.
- Exportação de relatórios em PDF pela PROE.
- Formulário do coordenador tem modo "carrinho" (adiciona múltiplas fragilidades antes de enviar tudo de uma vez).

## Capabilities and Constraints

- Sem banco de dados tradicional — tudo em Google Sheets.
- Bug histórico de datas: datas armazenadas como texto simples (`setNumberFormat("@")`) para evitar conversão automática do Sheets.
- Notificações por e-mail por curso são opcionais (flag `NOTIFICACOES_POR_CURSO_ATIVAS`).
- Frontend estático (deploy no GitHub Pages), URL do backend hardcoded em `src/lib/constants.ts`.
- Idioma: português (Brasil), tom institucional/formal — sistema de uso oficial de uma universidade pública.
- Dimensões de fragilidade: Organização Didático-Pedagógica, Corpo Docente e Tutorial, Infraestrutura.
- Fontes de evidência citáveis: Relatório Enade (INEP), Avaliação in loco (CEE/MS), Relatório de Autoavaliação.

## Brand Commitments

- Identidade institucional UEMS: Navy (`#00338C`, dark `#001f4d`) + Gold (`#C8A84B`) como âncora obrigatória.
- Tela de login usa a foto institucional oficial da UEMS como background (`https://www.uems.br/anexos/imagens/conteudo/uems_imagens_2023-09-22_13-02-19.png`) — constraint dura do usuário, deve permanecer no redesign.
- Selo/etiqueta "UEMS • PROE" identifica o sistema.
- Nenhum logo local em arquivo (sem `/public` com assets) — só a foto remota acima e ícones via `lucide-react`.

## Evidence on Hand

- `HANDOVER.md` e `README.md` na raiz do projeto documentam arquitetura, papéis, fluxos e histórico de mudanças — autoria do próprio usuário (Bruno Lopes, DIGES/PROE-UEMS).
- Implementação incumbente (`src/components/*.tsx`, `src/index.css`) é a evidência visual atual — tratada como anti-referência para o redesign, não como sistema a preservar.

## Product Principles

- Clareza de papel: coordenador só vê e edita o próprio curso; PROE vê e governa tudo.
- Rastreabilidade e auditoria em cada edição/exclusão liberada.
- Confiança institucional: é sistema oficial de uma universidade pública, a estética precisa comunicar credibilidade, não estilo genérico de startup.
- Eficiência para o coordenador preencher múltiplas fragilidades em sequência (fluxo carrinho).
- Facilidade de supervisão para a PROE (filtros, prazos, exportação).

## Accessibility & Inclusion

Sem requisito explícito registrado pelo usuário. Por ser sistema de universidade pública brasileira, seguir WCAG AA como piso razoável (contraste, foco visível, navegação por teclado) é o padrão assumido até indicação em contrário.
