# Plano de Ação dos Cursos — Especificação completa

UEMS · PROE / DIGES · levantamento de 22/10/2026, a partir do código em `main` (`66a2f44`) e de `gas/Code.gs`.
O repositório só registra o backend; o que vale é o que está publicado na implantação `AKfycbzyAL5m…`.

---

## 1. Propósito

Sistema oficial para registrar e acompanhar **fragilidades** apontadas em avaliações (ENADE/INEP, avaliação in loco
CEE/MS, autoavaliação) e os **planos de ação** de cada curso de graduação da UEMS. Substitui o controle manual em
planilha por um fluxo estruturado: o coordenador envia e acompanha; a PROE supervisiona, cobra e libera correções.

## 2. Usuários e papéis

| Papel | Login | Vê | Pode |
|---|---|---|---|
| **Coordenador** (`coordenador`) | senha do curso (aba `CURSOS`) | só os registros do próprio curso (filtro no servidor, coluna C × `courseId`) | enviar lote de fragilidades; registrar acompanhamento; marcar responsáveis como feitos; cadastrar e-mail do curso; editar/excluir **um** registro quando liberado |
| **PROE** (`reitoria`) | senha institucional (`CONFIG!A1`) | todos os cursos e anos | filtrar, exportar PDF, abrir a planilha, liberar edição, definir prazos por unidade, cobrar atraso/atualização, enviar alerta de prazo, e-mail de teste |

Não existe cadastro de usuário: cada curso tem uma senha compartilhada pela coordenação.

## 3. Arquitetura

```
Navegador (React 19 + Vite + Tailwind v4, GitHub Pages /planodeacao/)
   │  fetch text/plain (sem preflight CORS)
   ▼
Google Apps Script Web App (doGet / doPost) — executa como enade@uems.br
   │  SpreadsheetApp · CacheService · PropertiesService · LockService · MailApp
   ▼
Planilha "Plano de Ação" (1Ewz43i-…)  ← é o banco de dados
```

- **Front**: `src/` — `App.tsx` (sessão e roteamento por estado), `Login`, `ActionForm` (formulário + lista para
  envio), `Dashboard` (coordenador e PROE), painéis laterais `ViewModal` / `AcompanhamentoModal`, modais auxiliares.
- **Deploy do front**: push na `main` → GitHub Actions → Pages (~1–2 min).
- **Deploy do backend**: manual — colar `Code.gs` no editor, *Gerenciar implantações → lápis → Nova versão*. Nunca
  "Nova implantação" (gera outra URL).
- **Único check automatizado**: `npm run lint` (`tsc --noEmit`). Não há testes.

## 4. Modelo de dados (planilha)

| Aba | Conteúdo | Colunas |
|---|---|---|
| `CONFIG` | senha PROE | A1 = `sha256$…` |
| `CURSOS` | login dos cursos | A hash · B courseId · C courseName (`"Curso - Unidade"`) · D Email · E Liberado (`SIM`/`NÃO`) |
| `CURSOS_EMAIL` | e-mail institucional por curso | Unidade · Curso · Grau · Email |
| `CONFIG_PRAZOS` | prazo interno por unidade | A unidade · B prazo |
| `2026`, `2027`… | fragilidades; **uma tabela por curso** dentro da aba (linha-título azul `CURSO: X - CÓD: n`, cabeçalho cinza, dados) | A ID · B Data/Hora · C Código · D Curso · E Ano · F Dimensão · G Fragilidade · H Fonte · I Conceito · J Ação · K Prazo · L Responsável · M Recursos · N Data da Reunião · O Minuta · P Acompanhamentos |
| `Atualizações` | auditoria de edições (tabela por curso) | data/hora + dados novos + fragilidade anterior |
| `Exclusões` | auditoria de exclusões (tabela por curso) | data/hora + linha removida |
| `Log_Acessos` | log de ações | Data/Hora · Papel · Código · Curso · Ação · Detalhe |

Formatos embutidos em texto:
- **ID**: 6 caracteres hexadecimais maiúsculos (`gerarIdRegistro`).
- **Responsável** (L): lista serializada de `{nome, feito}` (`serializeResponsaveis`/`parseResponsaveis`).
- **Acompanhamentos** (P): blocos `"[dd/MM/yyyy HH:mm] Status / Por: … / Novo Prazo: … / Obs: …"` separados por uma
  linha de 40 hífens; também aceita JSON legado.
- **Fonte "Outra"**: gravada como `"Outra: <texto>"`.
- Datas K, N e Ano em formato texto (`setNumberFormat("@")`) por causa do bug de fuso do Sheets.
- **ScriptProperties**: `AUTH_SECRET` (assina tokens), `PEPPER_SENHAS` (hash de senha — nunca apagar), `LOG_BUFFER`.

Domínios fixos (`constants.ts`): dimensões — Organização Didático-Pedagógica, Corpo Docente e Tutorial,
Infraestrutura. Fontes — Relatório Enade (INEP), Avaliação in loco (CEE/MS), Relatório de Autoavaliação, Outra.
Status de acompanhamento — Em execução (legado: Em Andamento), Concluída, Não Concluída, Suspensa, Prazo prorrogado,
Não executada.

## 5. Autenticação e sessão

1. `login` (POST, sem token): compara a senha com `CONFIG!A1` e depois com cada linha de `CURSOS`.
   Hash = `sha256$` + Base64(HMAC-SHA256(pepper, `sal|senha`)), sal = courseId ou `PROE`.
   Formato antigo (Base64 / texto puro) ainda aceito e regravado como hash no primeiro login.
   `CONFIG` e `CURSOS` ficam 6 h no CacheService (invalidado em toda escrita nessas abas).
2. Resposta traz token `base64(payload).base64(HMAC)` com `role`, `courseId`, `courseName`, `exp` (12 h).
3. Todo GET (`?token=`) e POST (campo `token`; no lote, em cada item) exige token válido.
4. No navegador a sessão fica em `sessionStorage` (`sessao`), sobrevive a recarregar, expira após **30 min sem
   atividade** (pointerdown/keydown/visibilitychange).

Trocar/cadastrar senha: escrever `btoa('senha')` em `CURSOS!A` (ou texto puro em `CONFIG!A1`); vira hash no primeiro
login. Senha não é recuperável pela planilha.

## 6. API

### GET
| Chamada | Papel | Retorno |
|---|---|---|
| `?token=` | ambos | array de registros de todas as abas de ano (`/^\d{4}$/`); coordenador só recebe as linhas do próprio curso |
| `?action=get_deadlines&token=` | PROE | `{deadlines: {unidade: prazo}}` |
| `?aquecer=` | — | "não autorizado" (só acorda o Apps Script na tela de login) |

### POST (`Content-Type: text/plain`, corpo JSON)
| Ação | Papel | Lock | Regra |
|---|---|---|---|
| `login` | — | não | ver §5 |
| `check_liberacao` | coord. | não | lê `CURSOS!E` ao vivo (sem cache); polling a cada 30 s, um por vez |
| *array* (lote) | coord. | sim | todos os itens com `codigoCurso` = token; idempotente por `loteId` (6 h); insere na tabela do curso na aba do ano; e-mail para enade@ (e para o curso se `NOTIFICACOES_POR_CURSO_ATIVAS`) |
| `update` | dono/PROE | sim | exige `Liberado = SIM`; escreve F–O; **revoga a liberação**; grava em `Atualizações`; e-mail |
| `delete` | dono/PROE | sim | exige `Liberado = SIM`; apaga a linha; **revoga**; grava em `Exclusões`; e-mail |
| `add_acompanhamento` | dono/PROE | sim | sem gate de liberação; idempotente por `opId`; anexa à coluna P; se `novoPrazo`, tenta regravar o prazo |
| `update_responsavel` | dono/PROE | sim | sem gate; grava só a coluna L (valor absoluto, retentativa segura) |
| `register_course_email` | dono/PROE | sim | valida formato; grava `CURSOS!D` e o espelho em `CURSOS_EMAIL` |
| `save_deadlines` | PROE | sim | limpa e regrava `CONFIG_PRAZOS` |
| `liberar_edicao` | PROE | sim | `CURSOS!E = SIM` |
| `cobrar_atraso` / `cobrar_atualizacao` | PROE | sim | e-mail ao curso (fallback enade@) |
| `listar_cursos_unidade` | PROE | sim | prévia dos destinatários do alerta |
| `enviar_alerta_prazo` | PROE | sim | e-mail a cada curso + extras, cópia enade@ |
| `test_email` | PROE | sim | e-mail de teste para enade@ |

Dono = coluna C da linha encontrada na planilha (nunca o que o cliente manda). Linha localizada por ID; sem ID ou ID
não achado, cai para busca por curso + texto da fragilidade.

Lock: `tryLock(25 s)`; sem lock responde "O sistema está processando outro envio…" e o front repete.
E-mails de notificação (lote/update/delete) vão para uma fila despachada **depois** de soltar o lock; cobrança, alerta
e teste são enviados na hora.

## 7. Regras de negócio

- **Liberação de uso único**: coordenador pede por e-mail → PROE clica "Liberar edição" (ou digita SIM) → coordenador
  edita ou exclui **um** registro do curso → liberação volta a `NÃO`. A liberação vale para o curso, não para um
  registro específico.
- **Exclusão visível**: registros cuja fragilidade contém "EXCLUIR"/"EXCLUÍDO" são ocultados do painel.
- **Filtros do coordenador** por prazo: Vencidos (inclui "Em execução" vencido), Próximos 30 dias, No prazo,
  Encerrados (Concluída + Não executada). Ordenação pelo prazo mais próximo. Status atual = último acompanhamento.
- **PROE**: KPIs com "Cursos sem registro" em destaque (exclui o curso Teste), filtros por ano/curso/unidade,
  seleção para PDF (janela com `window.print()`, conteúdo escapado com `escapeHTML`).
- **Lista para envio**: vários registros montados antes de enviar; fica em `localStorage` (`lista-envio-<courseId>`)
  até o envio dar certo. Preenchimento demo automático só no curso "Teste".
- Unidade do curso = texto após o último `" - "` do nome.

## 8. Resiliência (instabilidade do Google)

O Apps Script responde 302 → `googleusercontent`, e essa perna falha (404/timeout) de forma intermitente; respostas
boas às vezes levam 10–20 s. Mitigações em `src/lib/api.ts`:
- leituras leves com **hedge** (nova tentativa paralela a cada 3 s, até 3, teto 40 s);
- leituras pesadas (dashboard, check_liberacao) **sem hedge**: 25 s por tentativa, 75 s no total;
- escritas de lote, acompanhamento e responsável: até 3 tentativas com o mesmo `loteId`/`opId`;
- `update`, `delete`, `liberar_edicao`, `save_deadlines`, `register_course_email`, alerta e cobrança: **uma tentativa só**.

---

## 9. Erros e riscos

Gravidade: **Alta** = pode vazar dados, corromper a planilha ou perder informação sem ninguém notar ·
**Média** = falha visível, auditoria enfraquecida ou abuso por usuário já logado · **Baixa** = incômodo ou dívida.
"Verificar" = depende do estado da planilha/produção, que não consegui ver.

### 9.1 Bugs

| # | Gravidade | Problema | Onde | Efeito |
|---|---|---|---|---|
| B1 | **Alta** (verificar) | "Prazo prorrogado" não grava o novo prazo. O código procura "Prazo" no cabeçalho da **linha 1**, mas nas abas de ano a linha 1 é o título `CURSO: …` da primeira tabela. `idxPrazo` fica 0 e nada é escrito. | `Code.gs` ~1225 | A tela mostra o prazo novo (estado local) até recarregar; depois volta o antigo. Filtros "Vencidos" ficam errados. O prazo está sempre na coluna K — basta escrever nela. |
| B2 | Média | `update` e `delete` não repetem nem têm `opId`. Se a resposta se perde, o usuário vê "Falha", mas a alteração foi feita **e a liberação foi consumida**; ao tentar de novo recebe "Edição não autorizada". | `api.ts` 179–238 | Coordenador precisa pedir nova liberação por algo que já deu certo; chamados desnecessários para a PROE. |
| B3 | Média (verificar) | O Sheets converte texto só com dígitos em número no `setValues`. Coluna C (código do curso) e A (ID) não são formatadas como texto. Código com zero à esquerda (`00000001`) vira `1`, e `String(r[2]) !== courseId`. | `inserirRegistroEmTabelaCurso` | Coordenador deixa de ver os próprios registros e não consegue acompanhá-los. ~6% dos IDs saem só com dígitos e perdem zeros à esquerda na exibição. |
| B4 | Baixa | Atualização local após acompanhamento/responsável casa registros por `ano+curso+fragilidade`, não por ID. | `Dashboard.tsx` 368, 396 | Dois registros com o mesmo texto mudam juntos na tela (só até recarregar). |
| B5 | Baixa | "E-mail de teste" mostra sucesso sem esperar a resposta. | `Dashboard.tsx` 547 | Falso positivo. |
| B6 | Baixa | Registros cuja fragilidade contém "excluir"/"excluído" por motivo legítimo somem do painel. | `Dashboard.tsx` 260 | Dado invisível sem aviso. |
| B7 | Baixa | O coordenador também é filtrado no front por **nome** do curso (`d.curso === courseName`), além do filtro por código no servidor. | `Dashboard.tsx` 266 | Renomear o curso em `CURSOS` sem renomear nas abas de ano esconde os registros antigos. |

### 9.2 Segurança

| # | Gravidade | Risco | Detalhe | Correção sugerida |
|---|---|---|---|---|
| S1 | **Alta** | **Login sem limite de tentativas.** | Cada tentativa é testada contra a PROE e os 64 cursos: qualquer senha de qualquer curso serve. A URL do Web App está no bundle público. | Contador por janela no CacheService (ex.: 10 falhas/5 min globais → atraso/bloqueio); senhas longas por curso. |
| S2 | **Alta** | **Injeção de fórmula na planilha.** | Texto livre (fragilidade, ação, recursos, minuta, responsável, acompanhamento) é gravado com `setValues`; valor começando com `=` vira fórmula. `IMPORTXML`/`IMAGE`/`HYPERLINK` podem mandar conteúdo da planilha para um servidor externo quando a PROE abre a aba. | No servidor, prefixar com `'` todo texto que comece com `= + - @`, ou formatar as colunas como texto antes de gravar. |
| S3 | **Alta** | **`ano` do lote não é validado.** | `inserirRegistroEmTabelaCurso(item.ano, …)` aceita qualquer nome de aba: um coordenador logado pode escrever em `CURSOS`, `CONFIG`, `Log_Acessos`, `Atualizações`. A função ainda **apaga colunas além da 16ª** e insere linhas na aba alvo. | Exigir `/^\d{4}$/` (e faixa razoável) em `ano` no lote, `update`, `delete`, `add_acompanhamento`, `update_responsavel`. |
| S4 | **Alta** (verificar) | **Credenciais padrão conhecidas.** | O código (repositório público) recria `CONFIG` com `uems2026` e `CURSOS` com o curso Teste, senha `teste`, `Liberado = SIM`, se as abas sumirem. Se a linha Teste em produção ainda usa `teste`, qualquer pessoa entra como coordenador — e combina com S2/S3. | Trocar a senha do curso Teste (ou removê-lo); tirar os padrões do código (falhar em vez de criar). |
| S5 | Média | **HTML não escapado nos e-mails.** | Fragilidade, ação, curso e ID entram crus no HTML enviado a enade@uems.br. | Escapar `& < > " '` antes de montar `detalhesHTML`. |
| S6 | Média | **Auditoria usa dados do cliente.** | `Atualizações`, `Exclusões` e e-mails gravam `data.curso`, `data.codigoCurso`, `data.fragilidadeAntiga` enviados pelo navegador; `registradoPor` do acompanhamento também vem do cliente. | Usar os valores da linha encontrada (`linhaExcluida`, `values[rowIndex-1]`) e o `courseName` do token. |
| S7 | Média | **Busca por texto como plano B.** | Sem ID achado, `encontrarLinhaPorId` usa curso + fragilidade e pega a primeira coincidência — com registros duplicados (já houve), pode alterar/acompanhar o registro errado. `add_acompanhamento` e `update_responsavel` não têm o freio da liberação. | Só aceitar fallback quando `id` vier vazio; se `id` veio e não foi achado, responder "não encontrado". |
| S8 | Baixa | Token na query string do GET. | Fica em histórico, logs e cabeçalhos de proxy. | Trocar a leitura para POST `{action:'get_data'}`. |
| S9 | Baixa | Token sem revogação. | Válido por 12 h mesmo após trocar senha ou "Sair". | Versão de sessão em ScriptProperties incluída no payload. |
| S10 | Baixa | Assinatura comparada com `!==`. | Comparação não constante (ruído do Apps Script torna inviável na prática). | Comparação em tempo constante. |
| S11 | Baixa | Liberação vale para o curso inteiro. | Liberado para corrigir A, o coordenador pode apagar B. Rastreável em `Exclusões`. | Liberar por ID de registro, se a PROE quiser esse rigor. |

### 9.3 Operação e dados

| # | Gravidade | Risco | Detalhe |
|---|---|---|---|
| O1 | **Alta** | **Perda de `PEPPER_SENHAS` ou `AUTH_SECRET`.** | Sem o pepper nenhuma senha confere; sem o secret todos são deslogados (este se recria). Quem edita o projeto Apps Script pode ler ou apagar. Guardar cópia do pepper fora do projeto. |
| O2 | **Alta** | **Sem backup automático da planilha.** | É o banco inteiro; `deleteRow`, `sheet.clear()` (`CONFIG_PRAZOS`, `CURSOS_EMAIL`) e S3 destroem dados. Depende do histórico de versões do Google. Sugestão: gatilho diário que copia o arquivo para uma pasta. |
| O3 | Média | **Repositório ≠ produção.** | Deploy do backend é manual e todas as implantações se chamam "Sem título". Fácil esquecer de publicar ou publicar na errada. |
| O4 | Média | **Lock segurado por e-mails síncronos.** | `enviar_alerta_prazo` e cobranças mandam e-mails dentro do lock (1–2 s cada). Alerta para uma unidade grande trava todas as gravações; quem envia nesse momento recebe "processando outro envio" e, depois de 3 tentativas, falha. |
| O5 | Média | **Cota do MailApp.** | Toda notificação vai para enade@; alertas em massa somam. Conta Workspace: ~1.500 destinatários/dia. Ao estourar, `enviarEmail` só registra no console — ninguém fica sabendo. |
| O6 | Média | **Dependência do Google.** | Instabilidade do redirect (§8) é externa; mitigada, não resolvida. Respostas de 10–40 s ainda acontecem. |
| O7 | Baixa | **Idempotência no CacheService.** | O cache pode ser despejado antes de 6 h; exceção no meio de um lote grava parte sem marcar o `loteId` → retentativa duplica essa parte. |
| O8 | Baixa | **Buffer de log em ScriptProperties.** | Valor limitado a 9 KB; se estourar, a linha de log é descartada em silêncio. |
| O9 | Baixa | **Leitura completa a cada carga.** | `doGet` percorre todas as abas de ano; o custo cresce a cada ano. Sem problema hoje. |
| O10 | Baixa | **Rascunho no navegador.** | A lista para envio fica no `localStorage` do computador até ser enviada; em computador compartilhado, outra pessoa que logue no mesmo curso vê o rascunho. |
| O11 | Baixa | **Sem testes.** | Só `tsc`. Regras de prazo, parse de acompanhamentos e responsáveis não têm verificação. |
| O12 | Baixa | **Dependências sem uso.** | `@google/genai`, `express`, `dotenv` no `package.json` (herança do AI Studio). Não entram no bundle, mas pesam no `npm ci` e em alertas de segurança. |
| O13 | Baixa | **Documentação desatualizada.** | `PRODUCT.md`/`HANDOVER.md` ainda falam em senha Base64, aba `DADOS` e foto remota; `SECURITY.md` descreve um modelo anterior aos tokens. |

---

## 10. Ordem sugerida de correção

1. **S4** — conferir/trocar a senha do curso Teste na planilha (sem código, 1 min).
2. **O1/O2** — cópia do `PEPPER_SENHAS` em local seguro; gatilho de backup diário.
3. **S3 + S2** — validar `ano` e neutralizar fórmulas no `Code.gs` (mesma publicação).
4. **B1** — gravar o novo prazo direto na coluna K.
5. **S1** — limite de tentativas de login.
6. **S5 + S6 + S7** — escapar HTML, auditoria pelos dados da linha, fallback só sem ID.
7. **B2** — `opId` + retentativa em `update`/`delete`.
8. **B3** — conferir na planilha se há códigos com zero à esquerda; se houver, formatar C como texto.
9. Restante (Baixa) conforme surgir.

Itens 3–7 são todos no `Code.gs`: cabem numa única nova versão da implantação `AKfycbzyAL5m…`.
