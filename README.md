# Plano de Ação dos Cursos — UEMS (PROE/DIGES)

Sistema web para registrar e acompanhar as **fragilidades** dos cursos de graduação da Universidade Estadual de
Mato Grosso do Sul (apontadas pelo ENADE, pela avaliação in loco e pela autoavaliação) e os **planos de ação**
de cada uma. Site publicado: https://diges-uems.github.io/planodeacao/

## 1. O que é e para quem

Substitui o controle manual em planilha por um fluxo estruturado. Não há cadastro de usuários: cada curso tem
uma senha compartilhada pela coordenação, e a PROE tem uma senha institucional.

| Perfil | Como entra | O que faz |
| --- | --- | --- |
| **Coordenação de curso** | senha do curso | Registra fragilidades e ações, acompanha prazos e andamento, marca responsáveis como concluídos. Vê só os dados do próprio curso. |
| **PROE** | senha institucional | Vê todos os cursos e anos, acompanha indicadores, define prazos por unidade, libera edição, cobra atrasos, exporta PDF. |

## 2. Funcionalidades

**Coordenação**
- **Registro de fragilidades**: formulário com dimensão (Organização Didático-Pedagógica, Corpo Docente e
  Tutorial, Infraestrutura), fonte (Relatório Enade/INEP, avaliação in loco CEE/MS, autoavaliação ou "Outra"),
  conceito, ação proposta, prazo, responsáveis, recursos, data e minuta da reunião.
- **Lista para envio**: monta várias fragilidades e envia tudo de uma vez ("Revisar e enviar"). O rascunho fica
  salvo no navegador até o envio dar certo.
- **Importação de planilha**: carrega várias fragilidades de um arquivo `.xlsx`, `.xls`, `.ods` ou `.csv`
  (há modelo para baixar); elas entram na lista para revisão antes do envio.
- **Acompanhamento**: registra o status de cada ação (Em execução, Concluída, Não concluída, Suspensa, Prazo
  prorrogado, Não executada), com observações e novo prazo.
- **Painel por prazo**: filtros Vencidos, Próximos 30 dias, No prazo e Encerrados; marcação de responsáveis
  como feitos; cadastro do e-mail do curso para avisos.
- **Edição/exclusão controlada**: só depois de liberada pela PROE (uso único, ver abaixo).

**PROE**
- Painel com indicadores (destaque para "Cursos sem registro") e filtros por ano, curso e unidade.
- **Prazos internos por unidade** e alerta de prazo por e-mail aos cursos.
- **Cobrança** de atraso e de atualização por e-mail.
- **Liberar edição**: o coordenador pede por e-mail (enade@uems.br); a PROE libera no painel (ou digita `SIM`
  na coluna "Liberado" da aba `CURSOS`). Vale para editar ou excluir **um** registro; depois volta a `NÃO`.
- **Exportar PDF** (janela de impressão) e atalho para abrir a planilha.

Toda edição, exclusão e ação relevante é registrada nas abas de auditoria da planilha.

## 3. Como funciona

```
Navegador (React + Vite, GitHub Pages)  ──fetch──▶  Google Apps Script (Web App)  ──▶  Planilha "Plano de Ação"
```

- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS v4, `lucide-react` (ícones), `motion` (animações) e
  `xlsx` (importação de planilhas, carregado só quando necessário). Site estático, sem servidor próprio.
- **Backend**: Google Apps Script (funções `doGet`/`doPost`; código fora deste repositório público), executado como a conta
  institucional do projeto. A **planilha do Google Sheets é o banco de dados**.
- **Autenticação**: o login devolve um token assinado (HMAC, válido por 12 h) com o papel (`reitoria` ou
  `coordenador`) e o curso. Toda chamada exige o token; o backend devolve ao coordenador apenas os registros do
  próprio curso. Senhas ficam em hash (HMAC-SHA256 com "pepper" guardado nas propriedades do script).
- **Sessão no navegador**: `sessionStorage`, expira após 30 min sem atividade.
- **Fluxo de dados**: o frontend chama a URL do Web App (`API_URL` em `src/lib/constants.ts`); o script lê/grava
  as abas, usa `LockService` nas escritas, `CacheService` para cache e idempotência, e `MailApp` para e-mails.
- **Resiliência**: o Apps Script às vezes demora ou falha de forma intermitente (instabilidade do Google).
  `src/lib/api.ts` faz novas tentativas (leituras com tentativas paralelas; escritas repetidas com
  identificadores de idempotência `loteId`/`opId`).

Documentação detalhada: [SPEC.md](./SPEC.md) (modelo de dados, API, regras de negócio, riscos conhecidos) e
[CLAUDE.md](./CLAUDE.md) / [AGENTS.md](./AGENTS.md) (regras críticas para quem mantém o código).

## 4. Estrutura de pastas

```
.
├── src/
│   ├── App.tsx              sessão e navegação entre telas (login, formulário, painel)
│   ├── components/          Login, ActionForm (formulário e lista), Dashboard, ViewModal,
│   │                        AcompanhamentoModal, ListaEnvioModal, EditModal, AlertaPrazoModal, ...
│   ├── lib/
│   │   ├── api.ts           chamadas ao Apps Script (retentativas, idempotência)
│   │   ├── constants.ts     API_URL, dimensões e fontes
│   │   ├── importarPlanilha.ts  leitura de .xlsx/.csv e modelo para download
│   │   └── utils.ts         datas, responsáveis, acompanhamentos
│   ├── index.css            tema (tokens de cor e fontes da UEMS)
│   └── types.ts
├── public/                  imagens, favicons e manifesto
├── .github/workflows/deploy.yml   publicação no GitHub Pages
├── SPEC.md · HANDOVER.md · SECURITY.md · PRODUCT.md · CLAUDE.md · AGENTS.md
└── vite.config.ts · tsconfig.json · package.json
```

## 5. Como rodar localmente

Pré-requisito: Node.js 20 (o mesmo do deploy; versões ≥ 18 costumam funcionar).

```bash
npm install
npm run dev     # http://localhost:3000/planodeacao/
npm run lint    # checagem de tipos (tsc --noEmit) — único check; não há testes
npm run build   # gera dist/
```

O site local conversa com o **backend real** (`API_URL`), ou seja, com a planilha de produção. Para testes,
use o curso "Teste".

## 6. Configuração

- **Frontend**: não usa variáveis de ambiente. A URL do backend está fixa em `src/lib/constants.ts` (`API_URL`);
  trocar de backend exige editar esse arquivo e publicar.
- `.env.example` (`GEMINI_API_KEY`, `APP_URL`) é herança do Google AI Studio e **não é usado pelo código**.
- **Apps Script** — Propriedades do script (nunca versionar valores): `PEPPER_SENHAS` (**não apagar**: sem ele
  nenhuma senha confere), `AUTH_SECRET` (assina tokens) e `LOG_BUFFER`. Constante no código:
  `NOTIFICACOES_POR_CURSO_ATIVAS` (`false` = só a PROE recebe e-mails; `true` = cada curso também).
- **Senhas**: para cadastrar/trocar a senha de um curso, escreva `btoa('senha')` na coluna A da aba `CURSOS`;
  vira hash no primeiro login. Senhas não são recuperáveis pela planilha.

### Planilha (banco de dados)

| Aba | Conteúdo |
| --- | --- |
| `CONFIG` | Senha institucional da PROE (célula A1). |
| `CURSOS` | `hash`, `courseId`, `courseName`, `Email`, `Liberado` — senha, e-mail e liberação de edição por curso. |
| `CURSOS_EMAIL` | E-mails das coordenações para os avisos. |
| `CONFIG_PRAZOS` | Prazos internos por unidade. |
| `2026`, `2027`… | Uma aba por ano de referência, com uma tabela por curso. |
| `Log_Acessos`, `Atualizações`, `Exclusões` | Histórico de ações e auditoria. |

## 7. Deploy / publicação

- **Frontend**: todo push na branch `main` dispara o GitHub Actions (`.github/workflows/deploy.yml`:
  `npm ci` → `npm run build` → GitHub Pages) e o site atualiza em 1–2 minutos. Também pode ser disparado
  manualmente (`workflow_dispatch`).
- **Backend** (manual): por segurança, o código do Apps Script **não fica neste repositório público**
  (a pasta `gas/` está no `.gitignore`). Para publicar uma alteração, abra o
  projeto [plano-de-acao-uems-backend](https://script.google.com/d/1T0B6kJbu_DMjw5aeLJ7bGWSVpcY_24XDxSJqiHluQCGEgPdV8GT_rn8m/edit)
  (conta institucional da DIGES/PROE; também gerenciável via `clasp`), atualize o código e
  vá em *Implantar → Gerenciar implantações → lápis na implantação em uso → Versão: Nova versão*.
  **Nunca use "Nova implantação"**: ela gera outra URL e o site continuaria apontando para a antiga.
  Todas as implantações aparecem como "Sem título" — confira pela URL em `API_URL`.

## 8. Integrações

- **Google Apps Script + Google Sheets** (backend e banco de dados).
- **Gmail/MailApp**: avisos de envio, edição e exclusão para enade@uems.br; cobranças e alertas de prazo para
  os cursos (sujeito à cota diária de e-mails do Google).
- **GitHub Pages / GitHub Actions** (hospedagem e deploy do frontend).

## 9. Manutenção e problemas comuns

- **Site lento ou "falha ao carregar"**: costuma ser instabilidade do Google (respostas de 10–40 s); aguarde e
  tente de novo. Teste pelo navegador (chamadas por `curl` podem receber erro 400 mesmo com o site funcionando).
- **"O sistema está processando outro envio"**: outra gravação está em andamento; o site repete sozinho.
- **Coordenador sem acesso a editar/excluir**: a PROE precisa liberar (coluna `Liberado` = `SIM` em `CURSOS`).
- **Coordenador não vê seus registros**: confira se o nome/código do curso em `CURSOS` bate com o das abas de ano.
- **Alteração no backend não apareceu**: faltou publicar como *Nova versão* na implantação em uso.
- **Registros "sumiram" do painel**: fragilidades com "EXCLUIR/EXCLUÍDO" no texto ficam ocultas (é como a
  exclusão aparece).
- **Riscos e pendências conhecidos** (login sem limite de tentativas, backup da planilha, validação de dados no
  backend etc.) estão listados em [SPEC.md](./SPEC.md), seção 9. Segurança: [SECURITY.md](./SECURITY.md).
- Passagem de responsabilidade: [HANDOVER.md](./HANDOVER.md) (parte dele ainda descreve o modelo anterior de
  senha e deve ser revisada).

## 10. Responsável

**DIGES/PROE – UEMS**. Contato: enade@uems.br. Desenvolvido em 2026 por Bruno Lopes (DIGES/PROE).
