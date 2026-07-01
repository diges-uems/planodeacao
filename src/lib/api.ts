import { API_URL } from './constants';
import type { Fragility, Acompanhamento } from '../types';

export async function fetchDashboardData(): Promise<Fragility[] | null> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);
        
        const response = await fetch(`${API_URL}?t=${Date.now()}`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        const data = await response.json();
        return Array.isArray(data) ? data.reverse().map((item: any, i: number) => ({ ...item, _id: `${item.ano}|${item.curso}|${item.fragilidade}|${i}` })) : null;
    } catch (e) {
        console.error("Fetch error:", e);
        return null;
    }
}

export async function submitCart(cart: Fragility[]): Promise<boolean> {
    try {
        if (!API_URL) return false;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);
        
        const response = await fetch(`${API_URL}?t=${Date.now()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(cart),
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

export async function deleteFragility(ano: string, curso: string, fragilidadeAntiga: string, codigoCurso: string, id?: string): Promise<boolean> {
    try {
        if (!API_URL) return false;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);
        
        const response = await fetch(`${API_URL}?t=${Date.now()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'delete', ano, curso, fragilidadeAntiga, codigoCurso, id }),
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
                id
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

export async function sendTestEmail(): Promise<boolean> {
    try {
        if (!API_URL) return false;
        const payload = { action: 'test_email' };
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

export async function login(password: string): Promise<any> {
    try {
        if (!API_URL) {
            return { success: false, message: "URL da API não configurada (.env.local)" };
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);
        
        const response = await fetch(`${API_URL}?t=${Date.now()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'login', password }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            return { success: false, message: "Erro de rede ao conectar com Apps Script" };
        }

        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch (err) {
            console.error("Login parse error:", err, "Response text:", text.substring(0, 100));
            return { success: false, message: "Erro no Apps Script. Por favor, atualize o code.gs e crie uma *Nova Implantação* (New deployment)." };
        }
    } catch(e) {
        console.error("Login error:", e);
        return { success: false, message: "Erro de conexão (CORS). Por favor, atualize o code.gs e crie uma Nova Implantação." };
    }
}

export async function addAcompanhamento(
    ano: string,
    curso: string,
    fragilidadeAntiga: string,
    acompanhamento: Acompanhamento,
    id?: string
): Promise<boolean> {
    try {
        if (!API_URL) return false;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);
        
        const response = await fetch(`${API_URL}?t=${Date.now()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'add_acompanhamento', ano, curso, fragilidadeAntiga, acompanhamento, id }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        if (!response.ok) return false;
        const data = await response.json();
        return data.success === true;
    } catch(e) {
        console.error("Add acompanhamento error:", e);
        return false;
    }
}

export async function getDeadlines(): Promise<Record<string, string>> {
    try {
        if (!API_URL) return {};
        const response = await fetch(`${API_URL}?action=get_deadlines&t=${Date.now()}`);
        if (!response.ok) return {};
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

export async function saveDeadlines(deadlines: Record<string, string>): Promise<boolean> {
    try {
        if (!API_URL) return false;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);
        
        const response = await fetch(`${API_URL}?t=${Date.now()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'save_deadlines', deadlines }),
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

export async function registerCourseEmail(courseId: string, email: string): Promise<boolean> {
    try {
        if (!API_URL) return false;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);
        
        const response = await fetch(`${API_URL}?t=${Date.now()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'register_course_email', courseId, email }),
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
