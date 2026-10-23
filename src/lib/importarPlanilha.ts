import type { Fragility, User } from '../types';
import { DIMENSIONS, SOURCES, OUTRA_FONTE_PREFIXO } from './constants';
import { serializeResponsaveis } from './utils';

// SheetJS só é baixado quando alguém importa ou pede o modelo (fica fora do bundle inicial).
const carregarXLSX = () => import('xlsx');

type Coluna = 'ano' | 'tipo' | 'fragilidade' | 'fonte' | 'conceito' | 'acao' | 'prazo' | 'responsavel' | 'recursos' | 'dataReuniao' | 'minutaReuniao';

// Cabeçalho do modelo, na ordem do formulário. "Ano" é opcional (padrão: ano atual).
const COLUNAS: { chave: Coluna; titulo: string; apelidos: string[] }[] = [
    { chave: 'ano', titulo: 'Ano', apelidos: ['ano de referencia'] },
    { chave: 'tipo', titulo: 'Dimensão', apelidos: ['dimensao', 'tipo'] },
    { chave: 'fragilidade', titulo: 'Fragilidade', apelidos: ['descricao da fragilidade'] },
    { chave: 'fonte', titulo: 'Fonte identificadora', apelidos: ['fonte'] },
    { chave: 'conceito', titulo: 'Conceito', apelidos: [] },
    { chave: 'acao', titulo: 'Ação proposta', apelidos: ['acao', 'acao pratica proposta', 'plano de acao'] },
    { chave: 'prazo', titulo: 'Data final', apelidos: ['prazo', 'data limite'] },
    { chave: 'responsavel', titulo: 'Responsáveis', apelidos: ['responsavel'] },
    { chave: 'recursos', titulo: 'Recursos necessários', apelidos: ['recursos'] },
    { chave: 'dataReuniao', titulo: 'Data da reunião', apelidos: ['reuniao', 'data de reuniao'] },
    { chave: 'minutaReuniao', titulo: 'Minuta da reunião', apelidos: ['minuta', 'ata', 'minuta da reuniao'] },
];

const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Palavras que identificam cada opção (já sem acento). Valem como começo de palavra:
// "autoavalia" casa "Autoavaliação", "docen" casa "docentes".
const CHAVES_DIMENSAO: Record<string, string[]> = {
    'Organização Didático-Pedagógica': ['organizacao', 'didat', 'pedagog'],
    'Corpo Docente e Tutorial': ['corpo', 'docen', 'tutor'],
    'Infraestrutura': ['infra'],
};
const CHAVES_FONTE: Record<string, string[]> = {
    'Relatório Enade (INEP)': ['enade', 'inep'],
    'Avaliação in loco (CEE/MS)': ['in loco', 'cee'],
    'Relatório de Autoavaliação': ['autoavalia', 'auto avalia', 'cpa'],
};

function distancia(a: string, b: string): number {
    let ant = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        const atual = [i];
        for (let j = 1; j <= b.length; j++) {
            atual[j] = Math.min(ant[j] + 1, atual[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        ant = atual;
    }
    return ant[b.length];
}

// Texto livre → opção oficial, em três tentativas:
// 1) igual ou abreviado ("infra", "Relatório Enade"); 2) palavra-chave ("Enade", "Autoavaliação");
// 3) erro de digitação pequeno ("Infraestrutra"). Ambíguo ou nada parecido → null.
function reconhecer(valor: string, chaves: Record<string, string[]>): { opcao: string; aproximado: boolean } | null {
    const v = norm(valor);
    if (!v) return null;
    const opcoes = Object.keys(chaves);
    const unica = (lista: string[]) => (lista.length === 1 ? lista[0] : null);

    const porNome = unica(opcoes.filter(o => { const n = norm(o); return n === v || n.startsWith(v) || v.startsWith(n); }));
    if (porNome) return { opcao: porNome, aproximado: false };

    const palavras = v.split(' ');
    const porChave = unica(opcoes.filter(o => chaves[o].some(k => k.includes(' ') ? v.includes(k) : palavras.some(p => p.startsWith(k)))));
    if (porChave) return { opcao: porChave, aproximado: false };

    // "Infraestrutra" (nome inteiro, até 2 letras) ou "Enad" (palavra-chave, 1 letra).
    const perto = unica(opcoes.filter(o =>
        (v.length >= 8 && distancia(v, norm(o)) <= 2) ||
        chaves[o].some(k => !k.includes(' ') && k.length >= 5 && palavras.some(p => distancia(p, k) <= 1))));
    return perto ? { opcao: perto, aproximado: true } : null;
}

const pad = (n: number) => String(n).padStart(2, '0');

function validaData(y: number, m: number, d: number) {
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? { y, m, d } : null;
}

// Data em célula do Excel vem como número de série; em CSV vem como texto dd/mm/aaaa.
function lerData(valor: unknown, SSF: typeof import('xlsx').SSF): { y: number; m: number; d: number } | null {
    if (typeof valor === 'number' && valor > 0) {
        const p = SSF.parse_date_code(valor);
        return p ? validaData(p.y, p.m, p.d) : null;
    }
    const s = String(valor ?? '').trim();
    let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
    if (m) {
        const y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
        return validaData(y, Number(m[2]), Number(m[1]));
    }
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return validaData(Number(m[1]), Number(m[2]), Number(m[3]));
    return null;
}

// CSV salvo pelo Excel em português vem em Windows-1252; o resto em UTF-8.
function decodificarTexto(buf: ArrayBuffer): string {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch { return new TextDecoder('windows-1252').decode(buf); }
}

export interface ResultadoImportacao {
    itens: Fragility[];
    erros: string[];   // linha recusada: "Linha 4: falta a ação proposta."
    avisos: string[];  // linha importada, mas vale conferir
}

export async function lerPlanilha(arquivo: File, user: User): Promise<ResultadoImportacao> {
    const XLSX = await carregarXLSX();
    const buf = await arquivo.arrayBuffer();
    const ehTexto = /\.(csv|txt)$/i.test(arquivo.name);
    // raw: em CSV não deixa o SheetJS "adivinhar" datas (ele lê 05/06 como 6 de maio).
    const wb = ehTexto
        ? XLSX.read(decodificarTexto(buf), { type: 'string', raw: true })
        : XLSX.read(buf, { type: 'array' });

    const nomeAba = wb.SheetNames.find(n => norm(n) === 'plano') ?? wb.SheetNames[0];
    const linhas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nomeAba], { header: 1, defval: '', blankrows: true });
    if (linhas.length === 0) return { itens: [], erros: ['A planilha está vazia.'], avisos: [] };

    // Acha cada coluna pelo título, em qualquer ordem.
    const cabecalho = (linhas[0] as unknown[]).map(norm);
    const indice = {} as Record<Coluna, number>;
    for (const c of COLUNAS) {
        indice[c.chave] = cabecalho.findIndex(h => h === norm(c.titulo) || c.apelidos.includes(h));
    }
    const faltando = COLUNAS.filter(c => c.chave !== 'ano' && indice[c.chave] < 0).map(c => c.titulo);
    if (faltando.length) {
        return { itens: [], erros: [`Colunas não encontradas na primeira linha: ${faltando.join(', ')}. Use o modelo.`], avisos: [] };
    }

    const anoAtual = String(new Date().getFullYear());
    const itens: Fragility[] = [];
    const erros: string[] = [];
    const avisos: string[] = [];  // item entrou, mas vale conferir

    linhas.slice(1).forEach((linha, i) => {
        const bruto = (c: Coluna) => (indice[c] >= 0 ? (linha as unknown[])[indice[c]] : '');
        const txt = (c: Coluna) => String(bruto(c) ?? '').trim();
        if (COLUNAS.every(c => !txt(c.chave))) return; // linha em branco

        const problemas: string[] = [];
        const alertas: string[] = [];

        const dim = reconhecer(txt('tipo'), CHAVES_DIMENSAO);
        const tipo = dim?.opcao;
        if (!dim) problemas.push(txt('tipo') ? `dimensão "${txt('tipo')}" não reconhecida (use ${DIMENSIONS.join(', ')})` : 'falta a dimensão');
        else if (dim.aproximado) alertas.push(`dimensão "${txt('tipo')}" entendida como "${dim.opcao}"`);

        const fonteTxt = txt('fonte');
        let fonte = '';
        if (!fonteTxt) problemas.push('falta a fonte');
        else if (norm(fonteTxt).startsWith('outra')) {
            const resto = fonteTxt.replace(/^outra\s*:?\s*/i, '').trim();
            if (resto) fonte = OUTRA_FONTE_PREFIXO + resto; else problemas.push('fonte "Outra" sem descrição');
        } else {
            const f = reconhecer(fonteTxt, CHAVES_FONTE);
            fonte = f ? f.opcao : OUTRA_FONTE_PREFIXO + fonteTxt;
            if (!f) alertas.push(`fonte "${fonteTxt}" entrou como "Outra" — se for uma das fontes da lista, corrija`);
            else if (f.aproximado) alertas.push(`fonte "${fonteTxt}" entendida como "${f.opcao}"`);
        }

        const d = lerData(bruto('prazo'), XLSX.SSF);
        if (!d) problemas.push(txt('prazo') ? `data final "${txt('prazo')}" inválida (use dd/mm/aaaa)` : 'falta a data final');

        // Data da reunião aceita texto livre ("A agendar"); se for data do Excel, vira dd/mm/aaaa.
        const dr = typeof bruto('dataReuniao') === 'number' ? lerData(bruto('dataReuniao'), XLSX.SSF) : null;
        const dataReuniao = dr ? `${pad(dr.d)}/${pad(dr.m)}/${dr.y}` : txt('dataReuniao');

        const nomes = txt('responsavel').split(/[;\n]/).map(n => n.trim()).filter(Boolean);
        if (!nomes.length) problemas.push('faltam os responsáveis');
        else if (nomes.length === 1 && nomes[0].includes(',')) {
            alertas.push(`responsáveis "${nomes[0]}" entraram como um só — para separar, use ponto e vírgula (;)`);
        }

        const obrigatorios: [Coluna, string][] = [
            ['fragilidade', 'falta a fragilidade'], ['conceito', 'falta o conceito'], ['acao', 'falta a ação proposta'],
            ['recursos', 'faltam os recursos'], ['minutaReuniao', 'falta a minuta da reunião'],
        ];
        for (const [c, msg] of obrigatorios) if (!txt(c)) problemas.push(msg);
        if (!dataReuniao) problemas.push('falta a data da reunião (ou "A agendar")');

        const ano = txt('ano') || anoAtual;
        if (!/^\d{4}$/.test(ano)) problemas.push(`ano "${ano}" inválido`);

        if (problemas.length) {
            erros.push(`Linha ${i + 2}: ${problemas.join('; ')}.`);
            return;
        }
        if (alertas.length) avisos.push(`Linha ${i + 2}: ${alertas.join('; ')}.`);
        itens.push({
            ano,
            codigoCurso: user.courseId || '',
            curso: user.courseName || '',
            tipo: tipo!,
            fragilidade: txt('fragilidade'),
            fonte,
            conceito: txt('conceito'),
            acao: txt('acao'),
            prazo: `${d!.y}-${pad(d!.m)}-${pad(d!.d)}`,
            responsavel: serializeResponsaveis(nomes.map(nome => ({ nome, feito: false }))),
            recursos: txt('recursos'),
            dataReuniao,
            minutaReuniao: txt('minutaReuniao'),
        });
    });

    if (!itens.length && !erros.length) erros.push('Nenhuma linha preenchida abaixo do cabeçalho.');
    return { itens, erros, avisos };
}

export async function baixarModelo() {
    const XLSX = await carregarXLSX();
    const wb = XLSX.utils.book_new();

    const plano = XLSX.utils.aoa_to_sheet([COLUNAS.map(c => c.titulo)]);
    plano['!cols'] = COLUNAS.map(c => ({ wch: ['fragilidade', 'acao', 'recursos'].includes(c.chave) ? 45 : 22 }));
    XLSX.utils.book_append_sheet(wb, plano, 'Plano');

    const ano = new Date().getFullYear();
    const instrucoes = XLSX.utils.aoa_to_sheet([
        ['Como preencher'],
        ['Uma fragilidade por linha, na aba "Plano". Não mude os títulos da primeira linha.'],
        ['Depois de importar, as linhas entram na Lista para envio: revise e envie pelo site.'],
        [],
        ['Coluna', 'O que escrever'],
        ['Ano', `Opcional. Se ficar vazio, usa ${ano}.`],
        ['Dimensão', DIMENSIONS.join(' / ')],
        ['Fragilidade', 'Descrição do problema.'],
        ['Fonte identificadora', `${SOURCES.filter(s => s !== 'Outra').join(' / ')} — ou outra fonte por extenso.`],
        ['Conceito', '1 a 5, Suficiente, Insuficiente ou N/A.'],
        ['Ação proposta', 'Medidas que serão tomadas.'],
        ['Data final', 'dd/mm/aaaa'],
        ['Responsáveis', 'Separe com ponto e vírgula. Ex.: Coordenação; Colegiado'],
        ['Recursos necessários', 'Financeiros, humanos, materiais.'],
        ['Data da reunião', 'dd/mm/aaaa ou "A agendar".'],
        ['Minuta da reunião', 'Link do Drive, processo SEI ou nº da ata.'],
        [],
        ['Exemplo (não copie para a aba Plano):'],
        COLUNAS.map(c => c.titulo),
        [String(ano), 'Infraestrutura', 'Falta de referências bibliográficas', 'Relatório Enade (INEP)', '2',
            'Renovação do acervo bibliográfico', `30/06/${ano + 1}`, 'Coordenação; Colegiado',
            'Compra de livros', `15/04/${ano}`, 'Ata nº 05/' + ano],
    ]);
    instrucoes['!cols'] = [{ wch: 24 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, instrucoes, 'Instruções');

    XLSX.writeFile(wb, 'modelo-plano-de-acao.xlsx');
}
