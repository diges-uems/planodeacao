import { API_URL } from './constants';
import type { Fragility, Acompanhamento } from '../types';

// O Apps Script responde em duas pernas: o POST/GET para script.google.com devolve um 302
// para script.googleusercontent.com/macros/echo, e é nessa segunda perna que a
// infraestrutura do Google falha de forma intermitente — medido em produção, ela devolve
// 404 depois de 15 a 30 segundos em boa parte das tentativas, mesmo com o script tendo
// executado normalmente. Esperar 90s por uma tentativa dessas é o que fazia o login
// parecer travado e terminar em "Erro de rede".
//
// Por isso: timeout curto por tentativa (aborta a perna morta em vez de esperar) e nova
// tentativa logo em seguida. Só pode ser usado em chamadas idempotentes (leituras) — um
// 404 nessa perna NÃO garante que o script não rodou, então repetir uma escrita poderia
// duplicar registros.
const TIMEOUT_POR_TENTATIVA_MS = 20000;
const TENTATIVAS_LEITURA = 3;

async function fetchComRetry(url: string, init?: RequestInit): Promise<Response> {
    let ultimoErro: unknown = new Error('Falha ao conectar com Apps Script');

    for (let tentativa = 0; tentativa < TENTATIVAS_LEITURA; tentativa++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_POR_TENTATIVA_MS);
        try {
            const response = await fetch(url, { ...init, signal: controller.signal });
            if (response.ok) return response;
            ultimoErro = new Error(`HTTP ${response.status}`);
        } catch (e) {
            ultimoErro = e;
        } finally {
            clearTimeout(timeoutId);
        }
        if (tentativa < TENTATIVAS_LEITURA - 1) {
            await new Promise(r => setTimeout(r, 400 * (tentativa + 1)));
        }
    }

    throw ultimoErro;
}

export async function fetchDashboardData(token: string): Promise<Fragility[] | null> {
    try {
        const response = await fetchComRetry(`${API_URL}?t=${Date.now()}&token=${encodeURIComponent(token)}`);
        const data = await response.json();
        return Array.isArray(data) ? data.reverse().map((item: any, i: number) => ({ ...item, _id: `${item.ano}|${item.curso}|${item.fragilidade}|${i}` })) : null;
    } catch (e) {
        console.error("Fetch error:", e);
        return null;
    }
}

export async function submitCart(cart: Fragility[], token: string): Promise<boolean> {
    try {
        if (!API_URL) return false;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);

        const response = await fetch(`${API_URL}?t=${Date.now()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(cart.map(item => ({ ...item, token }))),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        if (!response.ok) return false;
        const data = await response.json();
        return data.success === true;
    } catch(e) {
        console.error("Submit error:", e);
        return false;
    }
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
