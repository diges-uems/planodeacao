import { API_URL } from './constants';
import type { Fragility, Acompanhamento } from '../types';

// O Apps Script responde em duas pernas: o POST/GET para script.google.com devolve um 302
// para script.googleusercontent.com/macros/echo, e é nessa segunda perna que a
// infraestrutura do Google falha de forma intermitente. Medido em produção com o script
// instrumentado: o nosso código executa em ~55ms, mas a requisição inteira leva de 2,5s a
// 40s, e cerca de metade das tentativas morre com 404 depois de 12 a 30 segundos. A
// latência é toda do dispatch do Apps Script, não do backend — não há o que otimizar lá.
//
// Como esperar uma tentativa travada é o que o usuário sente como "login lento", as
// leituras usam requisições sobrepostas (hedged requests): dispara-se uma tentativa e, se
// ela não responder em HEDGE_MS, dispara-se outra em paralelo sem cancelar a primeira,
// aproveitando a que responder antes. Com ~50% de falha por tentativa, isso derruba o
// tempo típico para o de uma chamada boa (~1s).
//
// Só pode ser usado em chamadas idempotentes (leituras): um 404 nessa perna NÃO garante
// que o script deixou de rodar, então sobrepor ou repetir uma escrita duplicaria registros.
const HEDGE_MS = 3000;
const TIMEOUT_TENTATIVA_MS = 12000;
const TIMEOUT_TOTAL_MS = 40000;
const TENTATIVAS_LEITURA = 3;

async function fetchComRetry(url: string, init?: RequestInit, opcoes?: { hedge?: boolean }): Promise<Response> {
    // Sobrepor requisições multiplica a carga no Apps Script, que tem cota de execuções
    // simultâneas. Para a leitura do dashboard — que lê TODAS as abas de ano — três
    // tentativas em paralelo pesavam o suficiente para atrasar quem estava tentando
    // gravar. Chamadas pesadas usam hedge: false e apenas repetem em sequência.
    const usarHedge = opcoes?.hedge !== false;
    const controllers: AbortController[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Nunca aborta o controller da tentativa vencedora: o corpo da resposta só é lido
    // depois que fetchComRetry retorna, e abortar invalidaria essa leitura.
    const limpar = (vencedor?: AbortController) => {
        timers.forEach(clearTimeout);
        controllers.forEach(c => {
            if (c === vencedor) return;
            try { c.abort(); } catch { /* já finalizada */ }
        });
    };

    // Cada tentativa usa uma URL própria: o parâmetro t=... evita que as requisições
    // sobrepostas caiam em cache intermediário e devolvam a mesma resposta morta.
    const tentativa = async (controller: AbortController): Promise<{ response: Response; controller: AbortController }> => {
        const separador = url.includes('?') ? '&' : '?';
        const response = await fetch(`${url}${separador}h=${Date.now()}${Math.random()}`, {
            ...init,
            signal: controller.signal
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return { response, controller };
    };

    return new Promise<Response>((resolve, reject) => {
        let pendentes = 0;
        let disparadas = 0;
        let resolvida = false;
        let ultimoErro: unknown = new Error('Falha ao conectar com Apps Script');

        const concluir = (resultado: { response: Response; controller: AbortController }) => {
            if (resolvida) return;
            resolvida = true;
            limpar(resultado.controller);
            resolve(resultado.response);
        };

        const falhar = () => {
            if (resolvida) return;
            resolvida = true;
            limpar();
            reject(ultimoErro);
        };

        const disparar = () => {
            if (resolvida || disparadas >= TENTATIVAS_LEITURA) return;
            disparadas++;
            pendentes++;

            const controller = new AbortController();
            controllers.push(controller);

            tentativa(controller).then(concluir).catch(e => {
                ultimoErro = e;
                pendentes--;
                // Se a tentativa morreu antes do prazo do hedge, não espera: dispara já.
                if (pendentes === 0 && disparadas < TENTATIVAS_LEITURA) disparar();
                else if (pendentes === 0 && disparadas >= TENTATIVAS_LEITURA) falhar();
            });

            if (disparadas < TENTATIVAS_LEITURA) {
                timers.push(setTimeout(
                    usarHedge
                        // Com hedge: dispara outra em paralelo, sem cancelar esta.
                        ? disparar
                        // Sem hedge: aborta esta tentativa, o que faz o catch acima
                        // disparar a próxima — uma de cada vez, sem multiplicar a carga.
                        : () => { try { controller.abort(); } catch { /* já finalizada */ } },
                    usarHedge ? HEDGE_MS : TIMEOUT_TENTATIVA_MS
                ));
            }
        };

        timers.push(setTimeout(() => {
            ultimoErro = new Error('Tempo esgotado ao conectar com Apps Script');
            falhar();
        }, TIMEOUT_TOTAL_MS));

        disparar();
    });
}

export async function fetchDashboardData(token: string): Promise<Fragility[] | null> {
    try {
        const response = await fetchComRetry(`${API_URL}?t=${Date.now()}&token=${encodeURIComponent(token)}`, undefined, { hedge: false });
        const data = await response.json();
        return Array.isArray(data) ? data.reverse().map((item: any, i: number) => ({ ...item, _id: `${item.ano}|${item.curso}|${item.fragilidade}|${i}` })) : null;
    } catch (e) {
        console.error("Fetch error:", e);
        return null;
    }
}

export async function submitCart(cart: Fragility[], token: string): Promise<boolean> {
    if (!API_URL) return false;

    // A resposta do Apps Script volta por um redirect que falha de forma intermitente:
    // o script grava os registros, mas a resposta se perde. Sem retentativa o usuário via
    // "falha ao enviar" e reenviava o carrinho, duplicando tudo na planilha.
    // O loteId é gerado UMA vez e repetido em todas as tentativas — o backend reconhece
    // um lote já gravado e responde sucesso sem inserir de novo, então repetir é seguro.
    const loteId = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
    const corpo = JSON.stringify(cart.map(item => ({ ...item, token, loteId })));

    for (let tentativa = 0; tentativa < 3; tentativa++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000);
        try {
            const response = await fetch(`${API_URL}?t=${Date.now()}&lote=${loteId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: corpo,
                signal: controller.signal
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success === true) return true;
                // Disputa de lock no backend: a mensagem pede para tentar de novo.
                if (typeof data.message === 'string' && data.message.includes('processando outro envio')) {
                    await new Promise(r => setTimeout(r, 3000));
                    continue;
                }
                return false;
            }
        } catch (e) {
            console.error(`Submit error (tentativa ${tentativa + 1}):`, e);
        } finally {
            clearTimeout(timeoutId);
        }

        if (tentativa < 2) await new Promise(r => setTimeout(r, 1500 * (tentativa + 1)));
    }

    return false;
}

export async function deleteFragility(ano: string, curso: string, fragilidadeAntiga: string, codigoCurso: string, token: string, id?: string): Promise<boolean> {
    try {
        if (!API_URL) return false;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);

        const response = await fetch(`${API_URL}?t=${Date.now()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'delete', ano, curso, fragilidadeAntiga, codigoCurso, id, token }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        if (!response.ok) return false;
        const data = await response.json();
        return data.success === true;
    } catch(e) {
        console.error("Delete error:", e);
        return false;
    }
}

export async function updateFragility(
    ano: string, 
    curso: string, 
    fragilidadeAntiga: string,
    codigoCurso: string,
    newData: Partial<Fragility>,
    token: string,
    id?: string
): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);

        const response = await fetch(`${API_URL}?t=${Date.now()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'update',
                ano,
                curso,
                fragilidadeAntiga,
                codigoCurso,
                newData,
                id,
                token
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const data = await response.json();
        return data.success === true;
    } catch(e) {
        console.error("Update error:", e);
        return false;
    }
}

export async function updateResponsavel(
    ano: string,
    curso: string,
    fragilidadeAntiga: string,
    codigoCurso: string,
    responsavel: string,
    token: string,
    id?: string
): Promise<boolean> {
    try {
        if (!API_URL) return false;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);

        const response = await fetch(`${API_URL}?t=${Date.now()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'update_responsavel',
                ano,
                curso,
                fragilidadeAntiga,
                codigoCurso,
                responsavel,
                id,
                token
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        if (!response.ok) return false;
        const data = await response.json();
        return data.success === true;
    } catch(e) {
        console.error("Update responsavel error:", e);
        return false;
    }
}

export async function sendTestEmail(token: string): Promise<boolean> {
    try {
        if (!API_URL) return false;
        const payload = { action: 'test_email', token };
        const response = await fetch(`${API_URL}?t=${Date.now()}`, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'text/plain',
            },
        });
        if (!response.ok) return false;
        const data = await response.json();
        return data.success === true;
    } catch (error) {
        console.error("Test email erro:", error);
        return false;
    }
}

export async function checkLiberacao(token: string): Promise<boolean | null> {
    try {
        if (!API_URL) return null;
        const response = await fetchComRetry(`${API_URL}?t=${Date.now()}`, {
            method: 'POST',
            body: JSON.stringify({ action: 'check_liberacao', token }),
            headers: { 'Content-Type': 'text/plain' },
        });
        const data = await response.json();
        return data.success === true ? Boolean(data.podeEditar) : null;
    } catch (error) {
        console.error("Check liberação erro:", error);
        return null;
    }
}

export async function liberarEdicao(codigoCurso: string, token: string): Promise<boolean> {
    try {
        if (!API_URL) return false;
        const response = await fetch(`${API_URL}?t=${Date.now()}`, {
            method: 'POST',
            body: JSON.stringify({ action: 'liberar_edicao', codigoCurso, token }),
            headers: { 'Content-Type': 'text/plain' },
        });
        if (!response.ok) return false;
        const data = await response.json();
        return data.success === true;
    } catch (error) {
        console.error("Liberar edição erro:", error);
        return false;
    }
}

export interface CursoDestinatario {
    codigoCurso: string;
    curso: string;
    email: string;
}

export async function listarCursosUnidade(unidade: string, token: string): Promise<{ success: boolean; cursos?: CursoDestinatario[]; message?: string }> {
    try {
        if (!API_URL) return { success: false, message: 'URL da API não configurada.' };
        const response = await fetch(`${API_URL}?t=${Date.now()}`, {
            method: 'POST',
            body: JSON.stringify({ action: 'listar_cursos_unidade', unidade, token }),
            headers: { 'Content-Type': 'text/plain' },
        });
        if (!response.ok) return { success: false, message: 'Falha na comunicação com o servidor.' };
        return await response.json();
    } catch (error) {
        console.error("Listar cursos da unidade erro:", error);
        return { success: false, message: 'Erro de conexão.' };
    }
}

export async function enviarAlertaPrazo(prazo: string, mensagem: string, destinatarios: CursoDestinatario[], extras: string[], token: string): Promise<{ success: boolean; enviados?: number; semEmail?: string[]; message?: string }> {
    try {
        if (!API_URL) return { success: false, message: 'URL da API não configurada.' };
        const response = await fetch(`${API_URL}?t=${Date.now()}`, {
            method: 'POST',
            body: JSON.stringify({ action: 'enviar_alerta_prazo', prazo, mensagem, destinatarios, extras, token }),
            headers: { 'Content-Type': 'text/plain' },
        });
        if (!response.ok) return { success: false, message: 'Falha na comunicação com o servidor.' };
        return await response.json();
    } catch (error) {
        console.error("Alerta de prazo erro:", error);
        return { success: false, message: 'Erro de conexão.' };
    }
}

export async function login(password: string): Promise<any> {
    if (!API_URL) {
        return { success: false, message: "URL da API não configurada (.env.local)" };
    }

    // Login só lê a planilha, então pode ser repetido com segurança (ver fetchComRetry).
    try {
        const response = await fetchComRetry(`${API_URL}?t=${Date.now()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'login', password })
        });

        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch (err) {
            console.error("Login parse error:", err, "Response text:", text.substring(0, 100));
            return { success: false, message: "Erro no Apps Script. Por favor, atualize o code.gs e crie uma *Nova Implantação* (New deployment)." };
        }
    } catch (e) {
        console.error("Login error:", e);
        return { success: false, message: "O Google não respondeu. Tente novamente em alguns segundos." };
    }
}

export async function addAcompanhamento(
    ano: string,
    curso: string,
    fragilidadeAntiga: string,
    acompanhamento: Acompanhamento,
    token: string,
    id?: string
): Promise<{ success: boolean, message?: string }> {
    try {
        if (!API_URL) return { success: false, message: "API_URL não configurada." };
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);

        const response = await fetch(`${API_URL}?t=${Date.now()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'add_acompanhamento', ano, curso, fragilidadeAntiga, acompanhamento, id, token }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        if (!response.ok) return { success: false, message: `HTTP Error: ${response.status}` };
        const data = await response.json();
        return { success: data.success === true, message: data.message };
    } catch(e: any) {
        console.error("Add acompanhamento error:", e);
        return { success: false, message: e.message || "Erro de rede" };
    }
}

export async function getDeadlines(token: string): Promise<Record<string, string>> {
    try {
        if (!API_URL) return {};
        const response = await fetchComRetry(`${API_URL}?action=get_deadlines&t=${Date.now()}&token=${encodeURIComponent(token)}`);
        const data = await response.json();
        if (data && data.success) {
            return data.deadlines || {};
        }
        return {};
    } catch (error) {
        console.error("Get deadlines error:", error);
        return {};
    }
}

export async function saveDeadlines(deadlines: Record<string, string>, token: string): Promise<boolean> {
    try {
        if (!API_URL) return false;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);

        const response = await fetch(`${API_URL}?t=${Date.now()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'save_deadlines', deadlines, token }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        if (!response.ok) return false;
        const data = await response.json();
        return data.success === true;
    } catch(e) {
        console.error("Save deadlines error:", e);
        return false;
    }
}

export async function registerCourseEmail(courseId: string, email: string, token: string): Promise<boolean> {
    try {
        if (!API_URL) return false;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);

        const response = await fetch(`${API_URL}?t=${Date.now()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'register_course_email', courseId, email, token }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        if (!response.ok) return false;
        const data = await response.json();
        return data.success === true;
    } catch(e) {
        console.error("Register course email error:", e);
        return false;
    }
}
