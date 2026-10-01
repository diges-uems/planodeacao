# Plano de Ação dos Cursos — UEMS

Sistema de fragilidades e planos de ação por curso (ENADE / avaliação institucional) da UEMS.
Usuários: **coordenadores de curso** (senha do curso) e **PROE** (senha institucional). Interface e
textos em português do Brasil.

## Stack e comandos

- React + TypeScript + Vite + Tailwind v4 (`src/`). Ícones `lucide-react`, animação `motion/react`.
- Backend: **Google Apps Script** preso à planilha "Plano de Ação" (`gas/Code.gs`). Sem servidor próprio.
- `npm run dev` (porta 3000, base `/planodeacao/`), `npm run lint` = `tsc --noEmit` (único check; não há testes).
- Deploy do front: **push na `main` publica no GitHub Pages** (`.github/workflows/deploy.yml`) →
  https://diges-uems.github.io/planodeacao/. Leva ~1–2 min.
- Preview no app: `.claude/launch.json` → servidor `plano-acao`.

## Backend (Apps Script) — regras críticas

- URL em uso: `API_URL` em `src/lib/constants.ts` → implantação **`AKfycbzyAL5m…`** (única ativa).
  As antigas (`AKfycby8ib`, `AKfycbzVUpywmk`, `AKfycbz9RMin1h`, `AKfycbyZ1quKun`) foram **arquivadas** em 29/09/2026.
- **Publicar código novo do `gas/Code.gs`**: colar no editor do Apps Script → Implantar → Gerenciar
  implantações → lápis na implantação `AKfycbzyAL5m…` → Versão: **Nova versão**. **Nunca "Nova implantação"**
  (gera outra URL; o site continuaria na antiga e a antiga sem a correção ficaria exposta). Todas se chamam
  "Sem título" — confira pela URL. O repositório só registra; vale o que está publicado.
- Projeto Apps Script: `1T0B6kJbu_DMjw5aeLJ7bGWSVpcY_24XDxSJqiHluQCGEgPdV8GT_rn8m`, conta `enade@uems.br`,
  planilha `1Ewz43i-0necjcF9q9RniuJDIqruTFHPg62kLh46XZis`. Abas: `CONFIG`, `CURSOS`, `CURSOS_EMAIL`,
  `CONFIG_PRAZOS`, abas de ano (`2026`…, uma tabela por curso), `Log_Acessos`, `Atualizações`, `Exclusões`.
- Auth: login devolve token HMAC (`gerarToken`/`validarToken`, validade 12h) com `role`
  (`reitoria` = PROE | `coordenador`), `courseId`, `courseName`. Todo GET/POST exige token.
- **Segurança**: `doGet` devolve ao coordenador **só as linhas do próprio curso** (coluna C × `claims.courseId`,
  mesma comparação das escritas no `doPost`); `get_deadlines` só para PROE. Ações do `doPost` já checam papel/curso.
  Não volte a filtrar dados sensíveis só no navegador.
- **Lentidão/instabilidade do Google**: o Apps Script responde 302 → `googleusercontent` e essa perna falha
  com 404/timeout de forma intermitente; respostas boas às vezes levam 10–20s. Não é o nosso código (execuções
  rodam em <1s). Mitigações em `src/lib/api.ts` (`fetchComRetry`): leituras com hedge (paralelas, 3s) e
  leituras pesadas **sem hedge** com 25s por tentativa / 75s total; escritas repetem até 3× com idempotência
  (`loteId`, `opId`; `update_responsavel` é valor absoluto). `aquecerBackend()` no Login.
  Testes com `curl`/servidores externos podem receber 400 do Google mesmo com o site funcionando — teste pelo navegador.

## Frontend — estrutura

- `App.tsx`: sessão em `sessionStorage` (`sessao`), expira após **30 min sem atividade**; views `login`,
  `formulario` (coordenador), `dashboard`. Lista para envio (`cart`) vive aqui e fica no `localStorage` (`lista-envio-<courseId>`) até ser enviada.
- `Login.tsx`: foto `public/campus-uems.jpg` (src relativo `campus-uems.jpg`), rótulo Senha, olho 44px,
  Caps Lock, contato "Problemas para acessar? ✉ enade@uems.br". **Não recolocar** a dica
  "Coordenação usa a senha do curso; a PROE, a senha institucional" (usuário pediu para tirar).
- `Dashboard.tsx` (coordenador e PROE): cabeçalho azul-marinho; coordenador com filtros por prazo
  (Vencidos / Próximos 30 dias / No prazo / Encerrados — "Em execução" vencido conta como Vencido; Encerrados =
  Concluída + Não executada), ordenação pelo prazo mais próximo, `PrazoBar`, tabela de 6 colunas e
  **cartões abaixo de `md`**; PROE com menu "Mais", KPIs ("Cursos sem registro" em destaque), tabela própria
  e "Liberar edição". `handleToggleResponsavel(registro, idx, feito)` é o único caminho de gravação de responsável.
- `ViewModal.tsx` = painel lateral de detalhe; `AcompanhamentoModal.tsx` = painel lateral de acompanhamento
  (ambos à direita, Esc fecha). `ActionForm.tsx` = formulário com seções 01–04, erros inline e lista para envio
  lateral (revisão final continua no `CartModal`). Preenchimento demo automático só no curso "Teste".
- Mockup/revisão visual de referência: https://claude.ai/artifact/NFQq8WRX2sbLVmf56pexeH

## Design system (src/index.css)

- Tokens: `uems-blue #00338C`, `uems-dark #001529`, `uems-gold #C8A84B`, `uems-gold-dark #93732A`,
  `paper #F3F4F7`, `ink #101826`, `ink-muted #4B5568`, `rule #DDE1E8`; selos `seal-*`
  (`seal-pendente` = `#7A5A12`, escurecido por contraste). Fontes: Noto Serif (títulos itálicos),
  Public Sans (texto), IBM Plex Mono (números/IDs).
- Seções: título serif itálico + linha fina (`after:h-px after:bg-rule`). **Sem borda dourada lateral.**
  `.gold-rule` (linha dourada no topo) é identidade — o aviso "side-tab" do revisor sobre ela é falso positivo.
- **Barras de rolagem sempre em pílula arredondada**, nunca quadradas (estilo global; regra de Firefox só
  dentro de `@supports (-moz-appearance:none)` — no Chrome `scrollbar-width/color` desligam o estilo).

## Armadilhas já encontradas

- Estilo global de `<label>` (11px, maiúsculas): em labels que não são rótulo de campo, adicionar
  `mb-0 normal-case tracking-normal font-normal`.
- `.input-uems` fica em `@layer components` para utilitários (`pl-9`, `h-11`, `py-0`) sobrescreverem o padding.
- Registros com "EXCLUIR"/"EXCLUÍDO" na fragilidade são **ocultados** do painel (é assim que a exclusão
  aparece); texto de teste nunca deve conter essas palavras.
- `userCourses` vem como `"código||nome"`; `d.curso` é só o nome — comparar pela parte após `||`.
- Testes locais: simular sessão via `sessionStorage.setItem('sessao', …)` e interceptar `window.fetch` para
  `script.google.com`. O app regrava a sessão no `visibilitychange`, então para trocar de papel clique "Sair" antes.
  Não digitar senhas no site publicado — o usuário faz o login.

## Como trabalhar neste projeto

- Responder em português. **Perguntar antes de cada commit/push** (o usuário confirma com "commit e push").
- Mensagens de commit em português, imperativo, com corpo explicando o porquê; trailer `Co-Authored-By`.
- Mudanças visíveis: rodar `npm run lint`, testar no preview local (sessão simulada) e, quando possível,
  no site publicado; mostrar evidência.
- Arquivos soltos na raiz (`Artboard 4.png`, `favicon.png`, `brag-output/`) não são do projeto — não commitar.
