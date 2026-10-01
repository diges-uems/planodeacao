# Plano de Ação dos Cursos — UEMS (PROE/DIGES)

Sistema para registrar e acompanhar as fragilidades dos cursos de graduação da Universidade Estadual
de Mato Grosso do Sul (ENADE, avaliação in loco e autoavaliação) e os planos de ação de cada uma.

- **Coordenações de curso** entram com a senha do curso, registram fragilidades (montando uma lista e
  enviando tudo de uma vez), acompanham prazos e registram o andamento das ações.
- **PROE** entra com a senha institucional e vê o panorama de todos os cursos: indicadores, cursos sem
  registro, prazos internos e liberação de edição.

Site publicado: https://diges-uems.github.io/planodeacao/

## Arquitetura

- **Frontend**: React 19, TypeScript, Vite e Tailwind CSS v4; ícones `lucide-react`, animações `motion/react`.
  Publicado como site estático no GitHub Pages.
- **Backend**: Google Apps Script (`gas/Code.gs`) vinculado à planilha "Plano de Ação" no Google Sheets,
  expondo `doGet`/`doPost`. Não há servidor próprio.
- **Autenticação**: o login devolve um token assinado (HMAC, válido por 12h) com o papel (`reitoria` = PROE
  ou `coordenador`) e o curso. Todas as chamadas exigem o token, e o backend devolve ao coordenador apenas
  os registros do próprio curso.

## Executar localmente

Pré-requisito: Node.js ≥ 18.

```bash
npm install
npm run dev     # http://localhost:3000/planodeacao/
npm run lint    # checagem de tipos (tsc --noEmit)
npm run build   # gera dist/
```

A URL do backend fica em `src/lib/constants.ts` (`API_URL`).

## Publicação

- **Frontend**: todo push na branch `main` publica no GitHub Pages (`.github/workflows/deploy.yml`), em 1–2 minutos.
- **Backend**: o código de `gas/Code.gs` é só o registro; vale o que está publicado no Apps Script. Para
  publicar uma alteração, cole o código no editor do Apps Script e vá em *Implantar → Gerenciar implantações →
  editar a implantação em uso → Versão: Nova versão*. **Não crie uma nova implantação**: isso gera outra URL
  e o site continuaria apontando para a antiga.

## Planilha

Abas usadas pelo Apps Script:

| Aba | Conteúdo |
| --- | --- |
| `CONFIG` | Senha mestre da PROE (linha 1, coluna 1). |
| `CURSOS` | `hash`, `courseId`, `courseName`, `Email`, `Liberado` — senhas dos cursos e liberação de edição. |
| `CURSOS_EMAIL` | E-mails das coordenações para os avisos. |
| `CONFIG_PRAZOS` | Prazos internos definidos pela PROE. |
| `2026`, `2027`… | Uma aba por ano de referência, com uma tabela por curso. |
| `Log_Acessos`, `Atualizações`, `Exclusões` | Histórico de acessos e alterações. |

## Mais informações

- Segurança: [SECURITY.md](./SECURITY.md)
- Passagem de responsabilidade e manutenção: [HANDOVER.md](./HANDOVER.md)
