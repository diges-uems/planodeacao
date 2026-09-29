import React, { useEffect, useState, useMemo, useRef } from 'react';
import { fetchDashboardData, deleteFragility, updateFragility, updateResponsavel, sendTestEmail, getDeadlines, saveDeadlines, addAcompanhamento, checkLiberacao, liberarEdicao, enviarAlertaPrazo, type CursoDestinatario } from '../lib/api';
import { generatePdfHtml, sanitizeSearch, parseResponsaveis, serializeResponsaveis } from '../lib/utils';
import { DIMENSIONS } from '../lib/constants';
import type { Fragility, User, Acompanhamento } from '../types';
import { FileDown, RefreshCw, Plus, LogOut, Edit2, Trash2, Search, Database, Mail, ClipboardList, Unlock, BellRing, Info, Check, MoreHorizontal, ArrowRight } from 'lucide-react';
import { ConfirmModal, MissingCoursesModal } from './Modals';
import { EditModal } from './EditModal';
import { AcompanhamentoModal } from './AcompanhamentoModal';
import { ViewModal } from './ViewModal';
import { AlertaPrazoModal } from './AlertaPrazoModal';

interface DashboardProps {
    user: User;
    onNewRecord?: () => void;
    onLogout: () => void;
    onEdit?: (fragility: Fragility) => void;
    onShowAlert: (title: string, message: string) => void;
    onConsumirLiberacao?: () => void;
    onPodeEditarAtualizado?: (podeEditar: boolean) => void;
}

const DIA_MS = 86_400_000;

function parseDate(dStr: string | null | undefined): Date | null {
    if (!dStr) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) return new Date(dStr + "T00:00:00");
    const parts = dStr.split('/');
    if (parts.length === 3) return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    const d = new Date(dStr); // ISO com hora (ex.: dataReuniao)
    return isNaN(d.getTime()) ? null : d;
}

function getStatus(row: Fragility) {
    return row.statusAtual || (row.acompanhamentos && row.acompanhamentos.length > 0 ? row.acompanhamentos[row.acompanhamentos.length - 1].status : null);
}

function isFinalizado(row: Fragility) {
    const s = getStatus(row);
    return s === 'Concluída' || s === 'Não executada';
}

function hojeMeiaNoite() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return hoje;
}

type CategoriaPrazo = 'vencidos' | 'proximos' | 'noPrazo' | 'encerrados';

// Encerrado (concluída/não executada) sai da contagem; o resto é classificado só pelo prazo,
// independente do status declarado ("Em execução" vencido entra em Vencidos).
function categoriaPrazo(row: Fragility): CategoriaPrazo {
    if (isFinalizado(row)) return 'encerrados';
    const fim = parseDate(row.prazo);
    if (!fim) return 'noPrazo';
    const dias = Math.round((fim.getTime() - hojeMeiaNoite().getTime()) / DIA_MS);
    return dias < 0 ? 'vencidos' : dias <= 30 ? 'proximos' : 'noPrazo';
}

const FILTROS_PRAZO: { id: 'todos' | CategoriaPrazo; rotulo: string; cor?: string }[] = [
    { id: 'todos', rotulo: 'Todos' },
    { id: 'vencidos', rotulo: 'Vencidos', cor: 'var(--color-seal-nao-executada)' },
    { id: 'proximos', rotulo: 'Próximos 30 dias', cor: 'var(--color-seal-pendente)' },
    { id: 'noPrazo', rotulo: 'No prazo', cor: 'var(--color-seal-aguardando)' },
    { id: 'encerrados', rotulo: 'Encerrados', cor: 'var(--color-seal-concluida)' },
];

const BTN_CABECALHO = 'h-9 px-2.5 sm:px-3.5 shrink-0 rounded-md text-[13px] font-semibold flex items-center gap-2 border border-white/25 text-[#E6ECF5] hover:bg-white/10 transition-colors';

// Barra de decurso do prazo: da data da reunião (início do plano) até o prazo final.
function PrazoBar({ row }: { row: Fragility }) {
    const fim = parseDate(row.prazo);
    if (!fim || isFinalizado(row)) return null;
    const hoje = hojeMeiaNoite();
    const inicio = parseDate(row.dataReuniao);
    const dias = Math.round((fim.getTime() - hoje.getTime()) / DIA_MS);
    const pct = inicio && fim > inicio
        ? Math.min(100, Math.max(0, ((hoje.getTime() - inicio.getTime()) / (fim.getTime() - inicio.getTime())) * 100))
        : (dias < 0 ? 100 : 0);

    const cor = dias < 0 ? 'var(--color-seal-nao-executada)'
        : dias <= 30 ? 'var(--color-seal-pendente)'
        : 'var(--color-seal-aguardando)';
    const texto = dias < 0 ? `Vencido há ${-dias} dia${dias === -1 ? '' : 's'}`
        : dias === 0 ? 'Vence hoje'
        : `Faltam ${dias} dia${dias === 1 ? '' : 's'}`;

    return (
        <div className="flex flex-col gap-2 max-w-[200px]">
            <div className="h-1.5 rounded-full bg-[#E6E9EF] overflow-hidden" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Decurso do prazo">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cor }} />
            </div>
            <span className="text-xs font-semibold" style={{ color: cor }}>{texto}</span>
        </div>
    );
}

export function Dashboard({ user, onNewRecord, onLogout, onEdit, onShowAlert, onConsumirLiberacao, onPodeEditarAtualizado }: DashboardProps) {
    const isProe = user.role === 'reitoria';
    const [data, setData] = useState<Fragility[]>([]);
    const [loading, setLoading] = useState(true);
    const [itemToDelete, setItemToDelete] = useState<Fragility | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [itemToEdit, setItemToEdit] = useState<Fragility | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [itemToAcompanhar, setItemToAcompanhar] = useState<Fragility | null>(null);
    const [isAcompanhando, setIsAcompanhando] = useState(false);
    const [itemToView, setItemToView] = useState<Fragility | null>(null);
    
    const [filterAnos, setFilterAnos] = useState<string[]>([]);
    const [selectedAno, setSelectedAno] = useState('');
    const [selectedDimensao, setSelectedDimensao] = useState('');
    const [searchCourse, setSearchCourse] = useState('');
    const [selectedUnit, setSelectedUnit] = useState('');
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    
    const [deadlineUnit, setDeadlineUnit] = useState<string>('');
    const [proeDeadlines, setProeDeadlines] = useState<Record<string, string>>({});
    const deadlineSaveTimer = useRef<NodeJS.Timeout | null>(null);
    
    const [showMissingCoursesModal, setShowMissingCoursesModal] = useState(false);

    // Menu "Mais" do cabeçalho da PROE: fecha com clique fora ou Esc.
    const [menuMaisAberto, setMenuMaisAberto] = useState(false);
    const menuMaisRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!menuMaisAberto) return;
        const fora = (e: MouseEvent) => { if (!menuMaisRef.current?.contains(e.target as Node)) setMenuMaisAberto(false); };
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuMaisAberto(false); };
        document.addEventListener('mousedown', fora);
        document.addEventListener('keydown', esc);
        return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc); };
    }, [menuMaisAberto]);

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 25;

    const [selectedForPdf, setSelectedForPdf] = useState<Set<string>>(new Set());

    const loadData = async () => {
        setLoading(true);
        const [result, deadlines] = await Promise.all([
            fetchDashboardData(user.token),
            isProe ? getDeadlines(user.token) : Promise.resolve({})
        ]);
        
        if (result) {
            setData(result);
            const years = Array.from(new Set(result.map(i => String(i.ano)))).sort((a, b) => Number(b) - Number(a));
            setFilterAnos(years);
        } else {
            onShowAlert('Erro', 'Falha ao carregar dados. Verifique sua conexão.');
        }
        
        if (isProe) {
            setProeDeadlines(deadlines);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    // Coordenador: verifica periodicamente se a PROE liberou edição/exclusão,
    // sem precisar recarregar a página.
    const podeEditarAnteriorRef = useRef(user.podeEditar);
    useEffect(() => {
        podeEditarAnteriorRef.current = user.podeEditar;
    }, [user.podeEditar]);

    useEffect(() => {
        if (isProe || !onPodeEditarAtualizado) return;
        // Cada painel aberto consome execuções do Apps Script, que tem limite de execuções
        // simultâneas: a 8s, com hedge e sem trava, as consultas se empilhavam quando o
        // Google demorava e atrasavam quem estava gravando. Agora: 30s, uma por vez e só
        // com a aba visível.
        let emAndamento = false;
        const verificar = async () => {
            if (emAndamento || document.hidden) return;
            emAndamento = true;
            try {
                const podeEditar = await checkLiberacao(user.token);
                if (podeEditar !== null) {
                    if (podeEditar && !podeEditarAnteriorRef.current) {
                        onShowAlert("Edição liberada", "A PROE liberou a edição/exclusão de um registro do seu curso. Os botões já estão disponíveis na tabela.");
                    }
                    podeEditarAnteriorRef.current = podeEditar;
                    onPodeEditarAtualizado(podeEditar);
                }
            } finally {
                emAndamento = false;
            }
        };
        const interval = setInterval(verificar, 30000);
        const aoVoltar = () => { if (!document.hidden) verificar(); };
        document.addEventListener('visibilitychange', aoVoltar);
        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', aoVoltar);
        };
    }, [isProe, user.token, onPodeEditarAtualizado, onShowAlert]);

    const [liberandoCodigoCurso, setLiberandoCodigoCurso] = useState<string | null>(null);

    const handleLiberarEdicao = async (codigoCurso: string, curso: string) => {
        setLiberandoCodigoCurso(codigoCurso);
        const success = await liberarEdicao(codigoCurso, user.token);
        setLiberandoCodigoCurso(null);
        if (success) {
            onShowAlert("Sucesso", `Edição/exclusão liberada para ${curso}. O coordenador não precisa recarregar a página.`);
        } else {
            onShowAlert("Erro", "Falha ao liberar edição.");
        }
    };

    const [isAlertaPrazoOpen, setIsAlertaPrazoOpen] = useState(false);
    const [isEnviandoAlertaPrazo, setIsEnviandoAlertaPrazo] = useState(false);

    const handleEnviarAlertaPrazo = async (prazo: string, mensagem: string, destinatarios: CursoDestinatario[], extras: string[]) => {
        setIsEnviandoAlertaPrazo(true);
        const result = await enviarAlertaPrazo(prazo, mensagem, destinatarios, extras, user.token);
        setIsEnviandoAlertaPrazo(false);
        if (result.success) {
            setIsAlertaPrazoOpen(false);
            const semEmailMsg = result.semEmail && result.semEmail.length > 0
                ? ` ${result.semEmail.length} curso(s) sem e-mail preenchido não receberam (veja o log na planilha): ${result.semEmail.join(', ')}.`
                : '';
            onShowAlert("Alerta enviado", `${result.enviados || 0} destinatário(s) notificado(s).${semEmailMsg}`);
        } else {
            onShowAlert("Erro", result.message || "Falha ao enviar o alerta de prazo.");
        }
    };

    const userCourses = user.courses || {};

    const availableUnits = useMemo(() => {
        return Array.from(new Set(
            Object.values(userCourses)
                .map(c => {
                    const parts = c.split('||');
                    if (parts.length > 1) {
                        const nameParts = parts[1].split(' - ');
                        return nameParts.length > 1 ? nameParts[1] : '';
                    }
                    return '';
                })
                .filter(Boolean)
        )).sort();
    }, [userCourses]);

    const filteredData = useMemo(() => {
        let filtered = data.filter(d => 
            !(d.fragilidade || '').toString().toUpperCase().includes("EXCLUIR") && 
            !(d.fragilidade || '').toString().toUpperCase().includes("EXCLUÍDO")
        );

        if (!isProe) {
            filtered = filtered.filter(d => d.curso === user.courseName);
        } else {
            if (searchCourse) {
                const searchTerms = searchCourse.toLowerCase().split(' ');
                filtered = filtered.filter(d => {
                    const searchSpace = sanitizeSearch(`${d.codigoCurso || ''} ${d.curso || ''}`);
                    return searchTerms.every(term => searchSpace.includes(term));
                });
            }
            if (selectedDimensao) {
                filtered = filtered.filter(d => d.tipo === selectedDimensao);
            }
            if (selectedUnit) {
                filtered = filtered.filter(d => (d.curso || '').includes(`- ${selectedUnit}`));
            }
        }

        if (selectedAno) {
            filtered = filtered.filter(d => String(d.ano) === String(selectedAno));
        }

        if (!isProe) {
            // Coordenador: mais próximo de vencer (ou já vencido) primeiro; finalizados e sem prazo no fim.
            const chave = (d: Fragility) => {
                if (isFinalizado(d)) return Infinity;
                return parseDate(d.prazo)?.getTime() ?? Number.MAX_SAFE_INTEGER;
            };
            filtered = [...filtered].sort((a, b) => chave(a) - chave(b));
        }

        return filtered;
    }, [data, user, isProe, searchCourse, selectedDimensao, selectedAno, selectedUnit]);

    // Filtro por prazo: só no painel do coordenador; a PROE vê filteredData inteiro.
    const [filtroPrazo, setFiltroPrazo] = useState<'todos' | CategoriaPrazo>('todos');
    const contagemPrazo = useMemo(() => {
        const c: Record<'todos' | CategoriaPrazo, number> = { todos: filteredData.length, vencidos: 0, proximos: 0, noPrazo: 0, encerrados: 0 };
        filteredData.forEach(d => { c[categoriaPrazo(d)]++; });
        return c;
    }, [filteredData]);
    const dadosVisiveis = useMemo(
        () => (isProe || filtroPrazo === 'todos') ? filteredData : filteredData.filter(d => categoriaPrazo(d) === filtroPrazo),
        [filteredData, filtroPrazo, isProe]
    );

    const paginatedData = dadosVisiveis.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const totalPages = Math.ceil(dadosVisiveis.length / ITEMS_PER_PAGE) || 1;

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const allIds = new Set(dadosVisiveis.map(i => i._id || `${i.ano}|${i.curso}|${i.fragilidade}`));
            setSelectedForPdf(allIds);
        } else {
            setSelectedForPdf(new Set());
        }
    };

    const handleToggleSelect = (uid: string) => {
        const next = new Set(selectedForPdf);
        if (next.has(uid)) next.delete(uid);
        else next.add(uid);
        setSelectedForPdf(next);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        setIsDeleting(true);
        setData(prev => prev.filter(d => !(d.ano === itemToDelete.ano && d.curso === itemToDelete.curso && d.fragilidade === itemToDelete.fragilidade)));
        const success = await deleteFragility(itemToDelete.ano, itemToDelete.curso, itemToDelete.fragilidade, itemToDelete.codigoCurso, user.token, itemToDelete.id);
        if (success && !isProe) {
            onConsumirLiberacao?.();
            onShowAlert("Atenção", "A alteração foi salva. A liberação de acesso foi utilizada e voltou ao estado bloqueado. Solicite uma nova liberação à PROE caso precise corrigir outro registro.");
        }
        setIsDeleting(false);
        setItemToDelete(null);
    };

    const handleSaveEdit = async (newData: Partial<Fragility>) => {
        if (!itemToEdit) return;
        setIsEditing(true);
        const success = await updateFragility(itemToEdit.ano, itemToEdit.curso, itemToEdit.fragilidade, itemToEdit.codigoCurso, newData, user.token, itemToEdit.id);
        if (success) {
            setData(prev => prev.map(d => 
                (d.ano === itemToEdit.ano && d.curso === itemToEdit.curso && d.fragilidade === itemToEdit.fragilidade)
                    ? { ...d, ...newData } as Fragility : d
            ));
            if (!isProe) {
                onConsumirLiberacao?.();
                onShowAlert("Atenção", "A alteração foi salva. A liberação de acesso foi utilizada e voltou ao estado bloqueado. Solicite uma nova liberação à PROE caso precise corrigir outro registro.");
            }
        } else {
            onShowAlert("Erro", "Falha ao salvar edição.");
        }
        setIsEditing(false);
        setItemToEdit(null);
    };

    const handleSaveAcompanhamento = async (acompanhamento: Acompanhamento) => {
        if (!itemToAcompanhar) return;
        setIsAcompanhando(true);
        const result = await addAcompanhamento(itemToAcompanhar.ano, itemToAcompanhar.curso, itemToAcompanhar.fragilidade, acompanhamento, user.token, itemToAcompanhar.id);
        if (result.success) {
            setData(prev => prev.map(d => {
                if (d.ano === itemToAcompanhar.ano && d.curso === itemToAcompanhar.curso && d.fragilidade === itemToAcompanhar.fragilidade) {
                    const acompanhamentos = d.acompanhamentos ? [...d.acompanhamentos] : [];
                    acompanhamentos.push(acompanhamento);
                    const updatedItem = { ...d, acompanhamentos, statusAtual: acompanhamento.status };
                    if (acompanhamento.novoPrazo) {
                        updatedItem.prazo = acompanhamento.novoPrazo;
                    }
                    return updatedItem;
                }
                return d;
            }));
            onShowAlert("Sucesso", "Acompanhamento registrado.");
        } else {
            onShowAlert("Erro", result.message || "Falha ao registrar acompanhamento.");
        }
        setIsAcompanhando(false);
        setItemToAcompanhar(null);
    };

    // Usado pela janela de acompanhamento e pelo painel de detalhe: um único caminho de gravação.
    const handleToggleResponsavel = async (alvo: Fragility, index: number, feito: boolean) => {
        const lista = parseResponsaveis(alvo.responsavel);
        if (!lista[index]) return;
        lista[index] = { ...lista[index], feito };
        const responsavelSerializado = serializeResponsaveis(lista);
        const success = await updateResponsavel(alvo.ano, alvo.curso, alvo.fragilidade, alvo.codigoCurso, responsavelSerializado, user.token, alvo.id);
        if (success) {
            const mesmo = (d: Fragility) => d.ano === alvo.ano && d.curso === alvo.curso && d.fragilidade === alvo.fragilidade;
            setItemToAcompanhar(prev => prev && mesmo(prev) ? { ...prev, responsavel: responsavelSerializado } : prev);
            setItemToView(prev => prev && mesmo(prev) ? { ...prev, responsavel: responsavelSerializado } : prev);
            setData(prev => prev.map(d => mesmo(d) ? { ...d, responsavel: responsavelSerializado } : d));
        } else {
            onShowAlert("Erro", "Falha ao atualizar responsável.");
        }
    };

    const handleExportPdf = () => {
        if (selectedForPdf.size === 0) {
            onShowAlert("Atenção", "Por favor, selecione pelo menos uma fragilidade na tabela para gerar o relatório.");
            return;
        }

        const dataToExport = filteredData.filter(i => selectedForPdf.has(i._id || `${i.ano}|${i.curso}|${i.fragilidade}`));
        const escopo = isProe ? (searchCourse ? `Filtro: ${searchCourse}` : 'Todos os Cursos / Visão Geral') : user.courseName!;
        
        const html = generatePdfHtml(isProe, escopo, selectedAno || 'Todos', dataToExport);
        
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(html);
            printWindow.document.close();
            setSelectedForPdf(new Set());
        } else {
            onShowAlert("Atenção", "O seu navegador bloqueou a abertura da aba de impressão (Pop-up).");
        }
    };

    const autocompleteResults = useMemo(() => {
        if (!searchCourse) return [];
        const query = sanitizeSearch(searchCourse);
        if (!query) return [];
        const searchTerms = query.split(' ');
        return Object.values(userCourses).filter(v => {
            const searchSpace = sanitizeSearch(v.replace('||', ' '));
            return searchTerms.every(term => searchSpace.includes(term));
        }).sort((a,b) => a.localeCompare(b));
    }, [searchCourse, userCourses]);

    const getDimColor = (dim: string) => {
        if (dim === DIMENSIONS[0]) return '3px solid var(--color-uems-blue)';
        if (dim === DIMENSIONS[1]) return '3px solid #7F77DD';
        if (dim === DIMENSIONS[2]) return '3px solid #EF9F27';
        return '3px solid transparent';
    };

    const handleDeadlineChange = (unit: string, value: string) => {
        const updated = { ...proeDeadlines, [unit]: value };
        setProeDeadlines(updated);
        
        if (deadlineSaveTimer.current) {
            clearTimeout(deadlineSaveTimer.current);
        }
        
        deadlineSaveTimer.current = setTimeout(() => {
            saveDeadlines(updated, user.token);
        }, 500);
    };

    const renderStatusBadge = (row: Fragility) => {
        const status = getStatus(row);

        const datePrazo = parseDate(row.prazo);
        const now = new Date();
        now.setHours(0,0,0,0);

        let displayStatus = 'Em execução';
        let sealColor = 'var(--color-seal-pendente)';
        let sealBg = 'var(--color-seal-pendente-bg)';

        if (status === 'Concluída') {
            displayStatus = 'Concluída';
            sealColor = 'var(--color-seal-concluida)';
            sealBg = 'var(--color-seal-concluida-bg)';
        } else if (status === 'Não executada') {
            displayStatus = 'Não executada';
            sealColor = 'var(--color-seal-nao-executada)';
            sealBg = 'var(--color-seal-nao-executada-bg)';
        } else if (status === 'Em execução' || status === 'Em Andamento') {
            // Status declarado pelo coordenador tem precedência sobre o prazo vencido:
            // quem registrou que está executando já deu satisfação sobre o andamento.
            displayStatus = 'Em execução';
        } else if (datePrazo && datePrazo < now) {
            displayStatus = 'Aguardando parecer';
            sealColor = 'var(--color-seal-aguardando)';
            sealBg = 'var(--color-seal-aguardando-bg)';
        } else if (status === 'Prazo prorrogado') {
            displayStatus = 'Prazo prorrogado';
            sealColor = 'var(--color-seal-prorrogado)';
            sealBg = 'var(--color-seal-prorrogado-bg)';
        }

        return (
            <span className="status-seal" style={{ color: sealColor, background: sealBg }}>
                {displayStatus}
            </span>
        );
    };

    const criticalItems = filteredData.filter(d => parseInt(d.conceito) <= 2).length;
    const uniqueCoursesSet = new Set(filteredData.map(d => d.curso)).size;

    const dim1Count = filteredData.filter(d => d.tipo === DIMENSIONS[0]).length;
    const dim2Count = filteredData.filter(d => d.tipo === DIMENSIONS[1]).length;
    const dim3Count = filteredData.filter(d => d.tipo === DIMENSIONS[2]).length;

    const missingCoursesList = useMemo(() => {
        const submitted = new Set(filteredData.map(d => d.curso));
        let baseCourses = Object.values(userCourses).filter(c => c !== "00000001||Teste");
        if (selectedUnit) {
            baseCourses = baseCourses.filter(c => c.includes(`- ${selectedUnit}`));
        }
        // userCourses vem como "código||nome"; os registros guardam só o nome em `curso`.
        return baseCourses.filter(c => !submitted.has(c.split('||')[1] ?? c));
    }, [filteredData, selectedUnit, userCourses]);

    return (
        <>
            <div className="space-y-6 w-full text-left">
                <header className="bg-uems-dark border-b-[3px] border-uems-gold px-4 sm:px-6 py-3 sticky top-0 z-30 flex items-center justify-between mb-8 -mx-4 sm:-mx-6 -mt-6 sm:-mt-2 gap-3">
                    <div className="min-w-0">
                        <h1 className="font-serif-boletim italic text-lg sm:text-xl font-semibold text-white truncate">
                            {isProe ? 'Painel PROE' : user.courseName}
                        </h1>
                        <span className="block text-[11px] font-semibold text-[#A9BCDD] uppercase tracking-wide whitespace-nowrap">
                            {isProe ? 'Gestão Institucional' : 'Gestão do Curso'}
                        </span>
                    </div>
                    <nav aria-label="Ações do painel" className="flex flex-nowrap sm:flex-wrap justify-end gap-1.5 sm:gap-2 shrink-0">
                        {isProe && (
                            <button onClick={() => setIsAlertaPrazoOpen(true)} aria-label="Alertar prazo" className={BTN_CABECALHO}>
                                <BellRing className="w-4 h-4" /><span className="hidden sm:inline">Alertar prazo</span>
                            </button>
                        )}
                        <button onClick={handleExportPdf} aria-label="Exportar PDF" className={BTN_CABECALHO}>
                            <FileDown className="w-4 h-4" /><span className="hidden sm:inline">Exportar PDF</span>
                        </button>
                        <button onClick={loadData} aria-label="Sincronizar" className={BTN_CABECALHO}>
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /><span className="hidden sm:inline">Sincronizar</span>
                        </button>
                        {isProe && (
                            <div ref={menuMaisRef} className="relative">
                                <button onClick={() => setMenuMaisAberto(v => !v)} aria-haspopup="menu" aria-label="Mais ações" aria-expanded={menuMaisAberto} className={BTN_CABECALHO}>
                                    <MoreHorizontal className="w-4 h-4" /><span className="hidden sm:inline">Mais</span>
                                </button>
                                {menuMaisAberto && (
                                    <div role="menu" className="absolute right-0 top-full mt-2 w-56 bg-white border border-rule rounded-md shadow-lg py-1 z-40">
                                        <button
                                            role="menuitem"
                                            onClick={() => { setMenuMaisAberto(false); sendTestEmail(user.token); onShowAlert('Sucesso', 'Gatilho de e-mail disparado!'); }}
                                            className="w-full h-10 px-3 flex items-center gap-2.5 text-[13px] font-medium text-ink hover:bg-slate-50 text-left"
                                        >
                                            <Mail className="w-4 h-4 text-ink-muted" /> Testar e-mail
                                        </button>
                                        <a
                                            role="menuitem"
                                            href="https://docs.google.com/spreadsheets/d/1Ewz43i-0necjcF9q9RniuJDIqruTFHPg62kLh46XZis/edit?gid=1841943679#gid=1841943679"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={() => setMenuMaisAberto(false)}
                                            className="w-full h-10 px-3 flex items-center gap-2.5 text-[13px] font-medium text-ink hover:bg-slate-50"
                                        >
                                            <Database className="w-4 h-4 text-ink-muted" /> Abrir planilha
                                        </a>
                                    </div>
                                )}
                            </div>
                        )}
                        {!isProe && onNewRecord && (
                            <button onClick={onNewRecord} className="h-9 px-3 sm:px-3.5 shrink-0 bg-white text-uems-dark rounded-md text-[13px] font-semibold hover:bg-slate-100 flex items-center gap-2 transition-colors">
                                <Plus className="w-4 h-4" /><span className="sm:hidden">Nova</span><span className="hidden sm:inline">Nova fragilidade</span>
                            </button>
                        )}
                        <button onClick={onLogout} aria-label="Sair" className={BTN_CABECALHO}>
                            <LogOut className="w-4 h-4" /><span className="hidden sm:inline">Sair</span>
                        </button>
                    </nav>
                </header>

                {isProe && (
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-wrap items-end justify-between gap-4">
                            <div className="flex flex-col gap-1.5">
                                <h2 className="font-serif-boletim text-[28px] font-semibold text-uems-dark leading-tight">Visão geral</h2>
                                <p className="text-sm text-ink-muted">Fragilidades e planos de ação registrados pelos cursos</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2.5">
                                <label htmlFor="prazo-unidade" className="mb-0">Prazo interno</label>
                                <select
                                    id="prazo-unidade"
                                    value={deadlineUnit}
                                    onChange={(e) => setDeadlineUnit(e.target.value)}
                                    className="input-uems text-[13px] h-10 py-0 px-3 w-auto min-w-[200px]"
                                >
                                    <option value="">Selecione a unidade</option>
                                    {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                                {deadlineUnit && (
                                    <input
                                        type="date"
                                        aria-label={`Prazo interno de ${deadlineUnit}`}
                                        value={proeDeadlines[deadlineUnit] || ''}
                                        onChange={(e) => handleDeadlineChange(deadlineUnit, e.target.value)}
                                        className="input-uems text-[13px] h-10 py-0 px-3 w-auto"
                                    />
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] gap-4">
                            <div className="bg-uems-dark rounded-lg px-6 py-5 flex items-center justify-between gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[#A9BCDD]">Cursos sem registro</span>
                                    <span className="font-mono text-4xl font-medium text-white leading-none">{missingCoursesList.length}</span>
                                </div>
                                <button onClick={() => setShowMissingCoursesModal(true)} className="h-10 px-4 rounded-md bg-uems-gold hover:bg-[#D6B85E] text-uems-dark text-[13px] font-semibold flex items-center gap-2 transition-colors shrink-0">
                                    Ver cursos <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                            {[
                                { rotulo: 'Registros', valor: filteredData.length },
                                { rotulo: 'Cursos com registro', valor: uniqueCoursesSet },
                                { rotulo: 'Críticos (nota 1 e 2)', valor: criticalItems },
                            ].map(k => (
                                <div key={k.rotulo} className="bg-white border border-rule rounded-lg px-6 py-5 flex flex-col gap-1.5">
                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{k.rotulo}</span>
                                    <span className="font-mono text-[28px] font-medium text-ink leading-none">{k.valor}</span>
                                </div>
                            ))}
                        </div>

                        <div className="bg-white border border-rule rounded-lg px-6 py-4 flex flex-wrap items-center gap-x-10 gap-y-3">
                            <span className="font-serif-boletim italic text-[13px] font-semibold text-uems-gold-dark">Por dimensão</span>
                            {[
                                { rotulo: 'Didático-pedagógica', valor: dim1Count, cor: '#00338C' },
                                { rotulo: 'Corpo docente', valor: dim2Count, cor: '#7F77DD' },
                                { rotulo: 'Infraestrutura', valor: dim3Count, cor: '#EF9F27' },
                            ].map(d => (
                                <span key={d.rotulo} className="flex items-center gap-2.5 text-sm text-ink">
                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.cor }} />
                                    {d.rotulo}
                                    <span className="font-mono font-medium">{d.valor}</span>
                                </span>
                            ))}
                        </div>
                    </div>
                )}
                
                {!isProe && (
                    <div className="flex flex-col gap-5">
                        <div className="flex flex-wrap items-end justify-between gap-4">
                            <div className="flex flex-col gap-1.5">
                                <h2 className="font-serif-boletim text-[28px] font-semibold text-uems-dark leading-tight">Plano de ação</h2>
                                <p className="text-sm text-ink-muted">
                                    {filteredData.length} {filteredData.length === 1 ? 'registro' : 'registros'}, do prazo mais próximo ao mais distante
                                </p>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <label htmlFor="filtro-ano" className="!mb-0">Ano</label>
                                <select id="filtro-ano" value={selectedAno} onChange={e => { setSelectedAno(e.target.value); setCurrentPage(1); }} className="input-uems text-[13px] h-9 py-0 px-3 w-auto min-w-[160px]">
                                    <option value="">Todos os anos</option>
                                    {filterAnos.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div role="group" aria-label="Filtrar por prazo" className="flex flex-wrap gap-2">
                                {FILTROS_PRAZO.map(f => {
                                    const ativo = filtroPrazo === f.id;
                                    return (
                                        <button
                                            key={f.id}
                                            type="button"
                                            aria-pressed={ativo}
                                            onClick={() => { setFiltroPrazo(f.id); setCurrentPage(1); }}
                                            className={`h-9 px-3.5 rounded-md border text-[13px] font-semibold flex items-center gap-2 transition-colors ${ativo ? 'bg-white border-uems-blue text-uems-blue' : 'bg-transparent border-rule text-ink-muted hover:border-[#B9C0CC] hover:text-ink'}`}
                                        >
                                            {f.cor && <span className="w-2 h-2 rounded-full" style={{ background: f.cor }} />}
                                            {f.rotulo}
                                            <span className="font-mono font-medium">{contagemPrazo[f.id]}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-[13px] text-ink-muted flex items-center gap-2 max-w-xl">
                                <Info className="w-4 h-4 text-uems-blue shrink-0" />
                                {user.podeEditar ? (
                                    <span>A PROE liberou uma edição ou exclusão. Use os botões na linha do registro.</span>
                                ) : (
                                    <span>Para corrigir ou excluir, peça liberação a <a href="mailto:enade@uems.br" className="text-uems-blue underline underline-offset-2">enade@uems.br</a> com o ID do registro. Vale para uma alteração.</span>
                                )}
                            </p>
                        </div>
                    </div>
                )}

                {isProe && (
                <div className="flex flex-wrap gap-4 items-center">
                    <select value={selectedAno} onChange={e => { setSelectedAno(e.target.value); setCurrentPage(1); }} className="input-uems text-sm py-2 px-3 w-auto min-w-[140px]">
                        <option value="">Todos os Anos</option>
                        {filterAnos.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    
                    {isProe && (
                        <>
                            <select value={selectedUnit} onChange={e => { setSelectedUnit(e.target.value); setCurrentPage(1); }} className="input-uems text-sm py-2 px-3 w-auto min-w-[160px]">
                                <option value="">Todas as Unidades</option>
                                {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>

                            <select value={selectedDimensao} onChange={e => { setSelectedDimensao(e.target.value); setCurrentPage(1); }} className="input-uems text-sm py-2 px-3 w-auto min-w-[200px]">
                                <option value="">Todas as Dimensões</option>
                                {DIMENSIONS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>

                            <div className="flex-1 min-w-[250px] relative">
                                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                                    <Search className="w-4 h-4" />
                                </div>
                                <input 
                                    type="text" 
                                    value={searchCourse}
                                    onChange={e => { setSearchCourse(e.target.value); setShowAutocomplete(true); setCurrentPage(1); }}
                                    onFocus={() => setShowAutocomplete(true)}
                                    onBlur={() => setTimeout(() => setShowAutocomplete(false), 200)}
                                    placeholder="Filtrar por nome do curso ou código..." 
                                    className="input-uems text-sm py-2 pl-9 pr-3 w-full"
                                />
                                {showAutocomplete && searchCourse && (
                                    <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto divide-y divide-slate-100">
                                        {autocompleteResults.length > 0 ? (
                                            autocompleteResults.map(v => {
                                                const [c, n] = v.split('||');
                                                return (
                                                    <li key={v} className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm font-normal text-slate-700 transition-colors"
                                                        onClick={() => { setSearchCourse(`${c} - ${n}`); setShowAutocomplete(false); setCurrentPage(1); }}>
                                                        {c} - {n}
                                                    </li>
                                                );
                                            })
                                        ) : (
                                            <li className="px-4 py-2 text-sm text-slate-400 italic">Nenhum curso encontrado</li>
                                        )}
                                    </ul>
                                )}
                            </div>
                        </>
                    )}
                </div>
                )}
            </div>

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mt-8 flex flex-col">
                <div className="overflow-x-auto flex-1 relative min-h-[400px]">
                    {!isProe ? (
                    <>
                    {/* Celular: cartões no lugar da tabela */}
                    <ul className="md:hidden divide-y divide-rule">
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <li key={i} className="p-4 flex flex-col gap-3" style={{ opacity: 1 - i * 0.2 }}>
                                    {[40, 90, 70].map((w, j) => (
                                        <div key={j} style={{ height: '12px', width: `${w}%`, borderRadius: '6px', background: 'linear-gradient(90deg, #f1f5f9 25%, #e8edf2 50%, #f1f5f9 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
                                    ))}
                                </li>
                            ))
                        ) : paginatedData.length === 0 ? (
                            <li className="py-20 text-center text-slate-600 font-semibold">
                                {filteredData.length === 0 ? 'Nenhum registro encontrado' : 'Nenhum registro neste filtro'}
                            </li>
                        ) : paginatedData.map(row => {
                            const uid = row._id || `${row.ano}|${row.curso}|${row.fragilidade}`;
                            const prazoDisplay = /^\d{4}-\d{2}-\d{2}$/.test(row.prazo || '') ? (row.prazo || '').split('-').reverse().join('/') : row.prazo;
                            const responsaveis = parseResponsaveis(row.responsavel).filter(r => r.nome.trim());
                            const feitos = responsaveis.filter(r => r.feito).length;
                            const encerrado = isFinalizado(row);
                            return (
                                <li key={uid} className={`p-4 flex flex-col gap-3 ${selectedForPdf.has(uid) ? 'bg-slate-50' : ''}`}>
                                    <div className="flex items-center justify-between gap-3">
                                        {renderStatusBadge(row)}
                                        <div className="flex items-center gap-2">
                                            {row.id && <span className="font-mono text-[11px] text-ink-muted">#{row.id}</span>}
                                            <input type="checkbox" aria-label={`Selecionar registro ${row.id ? '#' + row.id : row.fragilidade} para o PDF`} className="w-5 h-5 accent-uems-blue" checked={selectedForPdf.has(uid)} onChange={() => handleToggleSelect(uid)} />
                                        </div>
                                    </div>
                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{row.tipo}</span>
                                    <button onClick={() => setItemToView(row)} className="-mt-1 text-left text-base font-semibold leading-snug text-uems-blue hover:underline">
                                        {row.fragilidade}
                                    </button>
                                    <div className="flex flex-col gap-1.5">
                                        <span className={`font-mono text-[13px] ${encerrado ? 'text-ink-muted' : ''}`}>{prazoDisplay || '—'}</span>
                                        {encerrado
                                            ? <span className="text-xs text-ink-muted">Sem contagem: {(getStatus(row) || '').toLowerCase()}</span>
                                            : <PrazoBar row={row} />}
                                    </div>
                                    {responsaveis.length > 0 && (
                                        <span className={`text-[13px] ${feitos === responsaveis.length ? 'font-semibold text-seal-concluida' : 'text-ink-muted'}`}>
                                            Responsáveis: {feitos} de {responsaveis.length} concluíram
                                        </span>
                                    )}
                                    <div className="flex gap-2">
                                        <button onClick={() => setItemToAcompanhar(row)} className="flex-1 h-11 rounded-md border border-rule bg-white text-sm font-semibold text-ink flex items-center justify-center gap-2">
                                            <ClipboardList className="w-4 h-4" /> Acompanhar
                                        </button>
                                        {user.podeEditar && (
                                            <>
                                                <button onClick={() => setItemToEdit(row)} aria-label="Editar registro" className="w-11 h-11 rounded-md border border-rule bg-white flex items-center justify-center text-ink-muted">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => setItemToDelete(row)} aria-label="Excluir registro" className="w-11 h-11 rounded-md border border-rule bg-white flex items-center justify-center text-seal-nao-executada">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                    <table className="hidden md:table app-table text-left w-full min-w-[900px]">
                        <thead>
                            <tr>
                                <th className="text-center w-12">
                                    <input type="checkbox" aria-label="Selecionar todos" className="w-4 h-4 cursor-pointer accent-uems-blue" onChange={handleSelectAll} checked={dadosVisiveis.length > 0 && selectedForPdf.size === dadosVisiveis.length} />
                                </th>
                                <th className="w-[184px]">Status</th>
                                <th>Fragilidade e ação</th>
                                <th className="w-[190px]">Prazo</th>
                                <th className="w-[230px]">Responsáveis</th>
                                <th className="w-[190px] text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} style={{ opacity: 1 - i * 0.12 }}>
                                        {[4, 28, 110, 40, 48, 30].map((w, j) => (
                                            <td key={j} className="!py-5">
                                                <div style={{ height: '12px', width: `${w * 2}px`, maxWidth: '100%', borderRadius: '6px', background: 'linear-gradient(90deg, #f1f5f9 25%, #e8edf2 50%, #f1f5f9 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite', animationDelay: `${i * 0.07}s` }} />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : paginatedData.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="!py-24 text-center">
                                        <span className="text-slate-600 font-semibold text-lg">
                                            {filteredData.length === 0 ? 'Nenhum registro encontrado' : 'Nenhum registro neste filtro'}
                                        </span>
                                    </td>
                                </tr>
                            ) : paginatedData.map(row => {
                                const uid = row._id || `${row.ano}|${row.curso}|${row.fragilidade}`;
                                const isChecked = selectedForPdf.has(uid);
                                const prazoDisplay = /^\d{4}-\d{2}-\d{2}$/.test(row.prazo || '') ? (row.prazo || '').split('-').reverse().join('/') : row.prazo;
                                const responsaveis = parseResponsaveis(row.responsavel).filter(r => r.nome.trim());
                                const feitos = responsaveis.filter(r => r.feito).length;
                                const encerrado = isFinalizado(row);
                                return (
                                    <tr key={uid} className={isChecked ? 'bg-slate-50' : ''}>
                                        <td className="text-center !py-[18px]">
                                            <input type="checkbox" aria-label={`Selecionar registro ${row.id ? '#' + row.id : row.fragilidade}`} className="w-4 h-4 cursor-pointer accent-uems-blue mt-1" checked={isChecked} onChange={() => handleToggleSelect(uid)} />
                                        </td>
                                        <td className="!py-[18px]">{renderStatusBadge(row)}</td>
                                        <td className="!py-[18px]">
                                            <div className="flex flex-col gap-1.5 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {row.id && <span className="font-mono text-[11px] font-medium text-ink-muted bg-[#EEF0F4] px-1.5 py-0.5 rounded">#{row.id}</span>}
                                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{row.tipo}</span>
                                                </div>
                                                <button onClick={() => setItemToView(row)} className="text-left text-[15px] font-semibold leading-snug text-uems-blue hover:underline focus:outline-none focus-visible:underline">
                                                    {row.fragilidade}
                                                </button>
                                                <span className="text-[13px] leading-relaxed text-ink-muted">{row.acao}</span>
                                            </div>
                                        </td>
                                        <td className="!py-[18px]">
                                            <div className="flex flex-col gap-2">
                                                <span className={`font-mono text-[13px] ${encerrado ? 'text-ink-muted' : ''}`}>{prazoDisplay || '—'}</span>
                                                {encerrado
                                                    ? <span className="text-xs text-ink-muted">Sem contagem: {(getStatus(row) || '').toLowerCase()}</span>
                                                    : <PrazoBar row={row} />}
                                            </div>
                                        </td>
                                        <td className="!py-[18px]">
                                            {responsaveis.length > 0 ? (
                                                <div className="flex flex-col gap-2">
                                                    <span className={`text-xs ${feitos === responsaveis.length ? 'font-semibold text-seal-concluida' : 'text-ink-muted'}`}>
                                                        {feitos} de {responsaveis.length} concluíram
                                                    </span>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {responsaveis.slice(0, 3).map((r, i) => (
                                                            <span key={i} title={r.nome} className={`inline-flex items-center gap-1 h-6 px-2 rounded-full border text-xs font-medium max-w-[200px] truncate ${r.feito ? 'bg-seal-concluida-bg border-[#CFE5D8] text-seal-concluida' : 'bg-white border-rule text-ink'}`}>
                                                                {r.feito && <Check className="w-3 h-3 shrink-0" />}
                                                                <span className="truncate">{r.nome}</span>
                                                            </span>
                                                        ))}
                                                        {responsaveis.length > 3 && (
                                                            <span className="inline-flex items-center h-6 px-2 rounded-full border border-rule bg-white text-xs font-medium text-ink-muted">+{responsaveis.length - 3}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : <span className="text-xs text-ink-muted">—</span>}
                                        </td>
                                        <td className="!py-[18px]">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => setItemToAcompanhar(row)} className="h-9 px-3.5 rounded-md border border-rule bg-white text-[13px] font-semibold text-ink hover:border-[#B9C0CC] flex items-center gap-2 transition-colors">
                                                    <ClipboardList className="w-4 h-4" /> Acompanhar
                                                </button>
                                                {user.podeEditar && (
                                                    <>
                                                        <button onClick={() => setItemToEdit(row)} aria-label="Editar registro" title="Editar" className="w-9 h-9 rounded-md flex items-center justify-center text-ink-muted hover:text-ink hover:bg-slate-100 transition-colors">
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => setItemToDelete(row)} aria-label="Excluir registro" title="Excluir" className="w-9 h-9 rounded-md flex items-center justify-center text-ink-muted hover:text-seal-nao-executada hover:bg-seal-nao-executada-bg transition-colors">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    </>
                    ) : (
                    <table className="app-table text-left w-full min-w-[1000px]">
                        <thead>
                            <tr>
                                <th className="text-center w-12">
                                    <input type="checkbox" aria-label="Selecionar todos" className="w-4 h-4 cursor-pointer accent-uems-blue" onChange={handleSelectAll} checked={dadosVisiveis.length > 0 && selectedForPdf.size === dadosVisiveis.length} />
                                </th>
                                <th className="w-[184px]">Status</th>
                                <th className="w-[200px]">Curso</th>
                                <th>Fragilidade e ação</th>
                                <th className="w-[190px]">Prazo</th>
                                <th className="w-[170px] text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} style={{ opacity: 1 - i * 0.12 }}>
                                        {[4, 28, 40, 110, 40, 30].map((w, j) => (
                                            <td key={j} className="!py-5">
                                                <div style={{ height: '12px', width: `${w * 2}px`, maxWidth: '100%', borderRadius: '6px', background: 'linear-gradient(90deg, #f1f5f9 25%, #e8edf2 50%, #f1f5f9 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite', animationDelay: `${i * 0.07}s` }} />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : paginatedData.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="!py-24 text-center">
                                        <span className="text-slate-600 font-semibold text-lg">Nenhum registro encontrado</span>
                                    </td>
                                </tr>
                            ) : paginatedData.map(row => {
                                const uid = row._id || `${row.ano}|${row.curso}|${row.fragilidade}`;
                                const isChecked = selectedForPdf.has(uid);
                                const prazoDisplay = /^\d{4}-\d{2}-\d{2}$/.test(row.prazo || '') ? (row.prazo || '').split('-').reverse().join('/') : row.prazo;
                                const encerrado = isFinalizado(row);
                                const liberando = liberandoCodigoCurso === row.codigoCurso;
                                return (
                                    <tr key={uid} className={isChecked ? 'bg-slate-50' : ''}>
                                        <td className="text-center !py-[18px]">
                                            <input type="checkbox" aria-label={`Selecionar registro ${row.id ? '#' + row.id : row.fragilidade}`} className="w-4 h-4 cursor-pointer accent-uems-blue mt-1" checked={isChecked} onChange={() => handleToggleSelect(uid)} />
                                        </td>
                                        <td className="!py-[18px]">{renderStatusBadge(row)}</td>
                                        <td className="!py-[18px]">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-sm font-semibold text-ink leading-snug">{row.curso}</span>
                                                <span className="font-mono text-xs text-ink-muted">{row.ano}</span>
                                            </div>
                                        </td>
                                        <td className="!py-[18px]">
                                            <div className="flex flex-col gap-1.5 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {row.id && <span className="font-mono text-[11px] font-medium text-ink-muted bg-[#EEF0F4] px-1.5 py-0.5 rounded">#{row.id}</span>}
                                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{row.tipo}</span>
                                                </div>
                                                <button onClick={() => setItemToView(row)} className="text-left text-[15px] font-semibold leading-snug text-uems-blue hover:underline focus:outline-none focus-visible:underline">
                                                    {row.fragilidade}
                                                </button>
                                                <span className="text-[13px] leading-relaxed text-ink-muted">{row.acao}</span>
                                            </div>
                                        </td>
                                        <td className="!py-[18px]">
                                            <div className="flex flex-col gap-2">
                                                <span className={`font-mono text-[13px] ${encerrado ? 'text-ink-muted' : ''}`}>{prazoDisplay || '—'}</span>
                                                {encerrado
                                                    ? <span className="text-xs text-ink-muted">Sem contagem: {(getStatus(row) || '').toLowerCase()}</span>
                                                    : <PrazoBar row={row} />}
                                            </div>
                                        </td>
                                        <td className="!py-[18px]">
                                            <div className="flex justify-end">
                                                <button
                                                    onClick={() => handleLiberarEdicao(row.codigoCurso, row.curso)}
                                                    disabled={liberando}
                                                    title={`Liberar uma edição ou exclusão para ${row.curso}`}
                                                    className="h-9 px-3.5 rounded-md border border-rule bg-white text-[13px] font-semibold text-ink hover:border-[#B9C0CC] flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-wait"
                                                >
                                                    {liberando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                                                    Liberar edição
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    )}
                </div>

                {dadosVisiveis.length > ITEMS_PER_PAGE && (
                    <div className="border-t border-slate-100 px-6 py-4 bg-white flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                            Mostrando {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, dadosVisiveis.length)}–{Math.min(currentPage * ITEMS_PER_PAGE, dadosVisiveis.length)} de <span className="text-slate-800">{dadosVisiveis.length}</span>
                        </span>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setCurrentPage(p => p - 1)} 
                                disabled={currentPage === 1} 
                                className="border border-slate-200 rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                            >
                                Anterior
                            </button>
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mx-2">
                                {currentPage} de {totalPages}
                            </span>
                            <button 
                                onClick={() => setCurrentPage(p => p + 1)} 
                                disabled={currentPage === totalPages} 
                                className="border border-slate-200 rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                            >
                                Próxima
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <ConfirmModal
                isOpen={!!itemToDelete}
                onClose={() => setItemToDelete(null)}
                onConfirm={confirmDelete}
                title="Confirmar exclusão?"
                message="O registro será removido do painel permanentemente."
                confirmText="Excluir"
                isProcessing={isDeleting}
            />

            <EditModal
                isOpen={!!itemToEdit}
                onClose={() => setItemToEdit(null)}
                item={itemToEdit}
                onSave={handleSaveEdit}
                isProcessing={isEditing}
            />

            <MissingCoursesModal 
                isOpen={showMissingCoursesModal}
                onClose={() => setShowMissingCoursesModal(false)}
                missingCourses={missingCoursesList}
            />

            <AcompanhamentoModal
                isOpen={!!itemToAcompanhar}
                onClose={() => setItemToAcompanhar(null)}
                item={itemToAcompanhar}
                currentUser={user}
                onSave={handleSaveAcompanhamento}
                onToggleResponsavel={(idx, feito) => itemToAcompanhar ? handleToggleResponsavel(itemToAcompanhar, idx, feito) : Promise.resolve()}
                isProcessing={isAcompanhando}
            />

            <AlertaPrazoModal
                isOpen={isAlertaPrazoOpen}
                onClose={() => setIsAlertaPrazoOpen(false)}
                unidades={availableUnits}
                token={user.token}
                onSend={handleEnviarAlertaPrazo}
                isProcessing={isEnviandoAlertaPrazo}
            />

            {itemToView && (
                <ViewModal
                    item={itemToView}
                    onClose={() => setItemToView(null)}
                    statusSeal={renderStatusBadge(itemToView)}
                    prazoBar={<PrazoBar row={itemToView} />}
                    onAcompanhar={!isProe ? () => { setItemToAcompanhar(itemToView); setItemToView(null); } : undefined}
                    onToggleResponsavel={!isProe ? (idx, feito) => handleToggleResponsavel(itemToView, idx, feito) : undefined}
                />
            )}
        </>
    );
}
