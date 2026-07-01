import React, { useEffect, useState, useMemo, useRef } from 'react';
import { fetchDashboardData, deleteFragility, updateFragility, sendTestEmail, getDeadlines, saveDeadlines, addAcompanhamento } from '../lib/api';
import { generatePdfHtml, sanitizeSearch, formatDateTimeBR } from '../lib/utils';
import { DIMENSIONS } from '../lib/constants';
import type { Fragility, User, Acompanhamento } from '../types';
import { FileDown, RefreshCw, Plus, LogOut, Edit2, Trash2, Search, Target, AlertTriangle, Clock, MapPin, Database, SearchX, Mail, ClipboardList } from 'lucide-react';
import { ConfirmModal, MissingCoursesModal } from './Modals';
import { EditModal } from './EditModal';
import { AcompanhamentoModal } from './AcompanhamentoModal';

interface DashboardProps {
    user: User;
    onNewRecord?: () => void;
    onLogout: () => void;
    onEdit?: (fragility: Fragility) => void;
    onShowAlert: (title: string, message: string) => void;
    onConsumirLiberacao?: () => void;
}

export function Dashboard({ user, onNewRecord, onLogout, onEdit, onShowAlert, onConsumirLiberacao }: DashboardProps) {
    const isProe = user.role === 'reitoria';
    const [data, setData] = useState<Fragility[]>([]);
    const [loading, setLoading] = useState(true);
    const [itemToDelete, setItemToDelete] = useState<Fragility | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [itemToEdit, setItemToEdit] = useState<Fragility | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [itemToAcompanhar, setItemToAcompanhar] = useState<Fragility | null>(null);
    const [isAcompanhando, setIsAcompanhando] = useState(false);
    
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

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 25;

    const [selectedForPdf, setSelectedForPdf] = useState<Set<string>>(new Set());

    const loadData = async () => {
        setLoading(true);
        const [result, deadlines] = await Promise.all([
            fetchDashboardData(),
            isProe ? getDeadlines() : Promise.resolve({})
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

        return filtered;
    }, [data, user, isProe, searchCourse, selectedDimensao, selectedAno, selectedUnit]);

    const paginatedData = filteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE) || 1;

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const allIds = new Set(filteredData.map(i => i._id || `${i.ano}|${i.curso}|${i.fragilidade}`));
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
        const success = await deleteFragility(itemToDelete.ano, itemToDelete.curso, itemToDelete.fragilidade, itemToDelete.codigoCurso, itemToDelete.id);
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
        const success = await updateFragility(itemToEdit.ano, itemToEdit.curso, itemToEdit.fragilidade, itemToEdit.codigoCurso, newData, itemToEdit.id);
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
        const success = await addAcompanhamento(itemToAcompanhar.ano, itemToAcompanhar.curso, itemToAcompanhar.fragilidade, acompanhamento, itemToAcompanhar.id);
        if (success) {
            setData(prev => prev.map(d => {
                if (d.ano === itemToAcompanhar.ano && d.curso === itemToAcompanhar.curso && d.fragilidade === itemToAcompanhar.fragilidade) {
                    const acompanhamentos = d.acompanhamentos ? [...d.acompanhamentos] : [];
                    acompanhamentos.push(acompanhamento);
                    return { ...d, acompanhamentos, statusAtual: acompanhamento.status };
                }
                return d;
            }));
            onShowAlert("Sucesso", "Acompanhamento registrado.");
        } else {
            onShowAlert("Erro", "Falha ao registrar acompanhamento.");
        }
        setIsAcompanhando(false);
        setItemToAcompanhar(null);
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

    const renderConceito = (conceito: string) => {
        const val = parseInt(conceito);
        if (isNaN(val)) return <span className="text-sm font-normal text-slate-700">N/A</span>;
        return <span className="text-sm font-normal text-slate-700">NOTA: {conceito}</span>;
    };

    const handleDeadlineChange = (unit: string, value: string) => {
        const updated = { ...proeDeadlines, [unit]: value };
        setProeDeadlines(updated);
        
        if (deadlineSaveTimer.current) {
            clearTimeout(deadlineSaveTimer.current);
        }
        
        deadlineSaveTimer.current = setTimeout(() => {
            saveDeadlines(updated);
        }, 500);
    };

    const renderStatusBadge = (row: Fragility) => {
        const status = row.statusAtual || (row.acompanhamentos && row.acompanhamentos.length > 0 ? row.acompanhamentos[row.acompanhamentos.length - 1].status : null);
        
        if (!status) return <span className="text-slate-400 font-medium text-sm">—</span>;
        
        return (
            <span className="text-sm font-medium text-slate-700">
                {status}
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
        return baseCourses.filter(c => !submitted.has(c));
    }, [filteredData, selectedUnit, userCourses]);

    return (
        <>
            <div className="space-y-6 w-full text-left">
                <header className="bg-gradient-to-r from-uems-dark to-uems-blue px-6 py-4 sticky top-0 z-30 flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 -mx-4 sm:-mx-6 -mt-6 sm:-mt-2 gap-4 shadow-sm">
                    <div>
                        <h1 className="text-xl font-semibold text-white">
                            {isProe ? 'Painel PROE' : user.courseName}
                        </h1>
                        <span className="text-xs font-medium text-blue-200 uppercase tracking-wide">
                            {isProe ? 'Gestão Institucional' : 'Gestão do Curso'}
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button onClick={handleExportPdf} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 flex items-center gap-2 transition-colors">
                            <FileDown className="w-4 h-4" /> Exportar PDF
                        </button>
                        <button onClick={loadData} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 flex items-center gap-2 transition-colors">
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Sincronizar
                        </button>
                        {isProe && (
                            <>
                                <button onClick={() => { sendTestEmail(); onShowAlert('Sucesso', 'Gatilho de e-mail disparado!'); }} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 flex items-center gap-2 transition-colors">
                                    <Mail className="w-4 h-4" /> Testar E-mail
                                </button>
                                <a 
                                    href="https://docs.google.com/spreadsheets/d/1Ewz43i-0necjcF9q9RniuJDIqruTFHPg62kLh46XZis/edit?gid=1841943679#gid=1841943679" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-md text-sm font-medium transition-all flex items-center gap-2"
                                >
                                    <Database className="w-4 h-4" />
                                    Abrir Planilha
                                </a>
                            </>
                        )}
                        {!isProe && onNewRecord && (
                            <button onClick={onNewRecord} className="px-4 py-2 bg-white text-uems-blue rounded-md text-sm font-semibold hover:bg-slate-50 flex items-center gap-2 transition-colors">
                                <Plus className="w-4 h-4" /> Nova
                            </button>
                        )}
                        <button onClick={onLogout} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 rounded-md text-sm font-medium transition-colors flex items-center gap-2">
                            <LogOut className="w-4 h-4" /> Sair
                        </button>
                    </div>
                </header>

                {isProe && (
                    <div className="mb-8 space-y-6">
                        <div className="flex flex-wrap items-center gap-4 p-0 w-max max-w-full text-sm">
                            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Prazo Limite (Interno):</label>
                            <select 
                                value={deadlineUnit} 
                                onChange={(e) => setDeadlineUnit(e.target.value)}
                                className="input-uems text-sm py-2 px-3 w-auto min-w-[200px]"
                            >
                                <option value="">Selecione uma Unidade...</option>
                                {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                            {deadlineUnit && (
                                <input 
                                    type="date" 
                                    value={proeDeadlines[deadlineUnit] || ''} 
                                    onChange={(e) => handleDeadlineChange(deadlineUnit, e.target.value)}
                                    className="input-uems text-sm py-2 px-3 w-auto"
                                />
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white border border-slate-200 rounded-lg p-5">
                                <div className="text-2xl font-semibold text-slate-800 font-mono">{filteredData.length}</div>
                                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mt-1">Total Registros</div>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-lg p-5">
                                <div className="text-2xl font-semibold text-slate-800 font-mono">{criticalItems}</div>
                                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mt-1">Críticos (1 e 2)</div>
                            </div>
                            <div 
                                onClick={() => setShowMissingCoursesModal(true)}
                                className="bg-white border border-slate-200 rounded-lg p-5 cursor-pointer hover:border-slate-300 transition-colors"
                            >
                                <div className="text-2xl font-semibold text-slate-800 font-mono">{missingCoursesList.length}</div>
                                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mt-1">Não Avaliados</div>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-lg p-5">
                                <div className="text-2xl font-semibold text-slate-800 font-mono">{uniqueCoursesSet}</div>
                                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mt-1">Cursos Avaliados</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between" style={{ borderLeft: '3px solid #00338C' }}>
                                <div className="text-2xl font-semibold text-slate-800 font-mono">{dim1Count}</div>
                                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mt-1">Didático-Pedagógica</div>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between" style={{ borderLeft: '3px solid #7F77DD' }}>
                                <div className="text-2xl font-semibold text-slate-800 font-mono">{dim2Count}</div>
                                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mt-1">Corpo Docente</div>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between" style={{ borderLeft: '3px solid #EF9F27' }}>
                                <div className="text-2xl font-semibold text-slate-800 font-mono">{dim3Count}</div>
                                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mt-1">Infraestrutura</div>
                            </div>
                        </div>
                    </div>
                )}
                
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
            </div>

                {!isProe && (
                    <div className="mt-6 mb-2 text-sm text-slate-500 bg-blue-50/50 p-4 rounded-lg border border-blue-100 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-uems-blue shrink-0 mt-0.5" />
                        <p>
                            {user.podeEditar ? (
                                <>A PROE liberou a edição e exclusão de registros para o seu curso. Utilize os botões na tabela abaixo.</>
                            ) : (
                                <>Para corrigir ou excluir um registro, envie um e-mail para <strong className="font-semibold text-slate-700">enade@uems.br</strong> informando o <strong>ID do Registro</strong> e solicitando a liberação. Assim que a PROE liberar, os botões de editar/excluir aparecerão aqui automaticamente. Lembre-se: a liberação vale para uma única alteração.</>
                            )}
                        </p>
                    </div>
                )}

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mt-8 flex flex-col">
                <div className="overflow-x-auto no-scrollbar flex-1 relative min-h-[400px]">
                    <table className="app-table text-left w-full min-w-[1200px]">
                        <thead>
                            <tr>
                                <th className="text-center w-14">
                                    <input type="checkbox" className="w-4 h-4 cursor-pointer" onChange={handleSelectAll} checked={filteredData.length > 0 && selectedForPdf.size === filteredData.length} />
                                </th>
                                <th className="w-[8%] text-center">Status</th>
                                {isProe && <th className="w-[12%]">Curso Institucional</th>}
                                <th className="w-[7%]">Ano Ref</th>
                                <th className="w-[16%]">Dimensão</th>
                                <th className="w-[18%]">Plano de Ação</th>
                                <th className="w-[11%]">Fonte & Conceito</th>
                                <th className="w-[11%]">Execução / Resp.</th>
                                <th className="w-[11%]">Recursos Alocados</th>
                                <th className="w-[13%]">Comprovações</th>
                                <th className="w-[8%] text-center">Ações</th>
                            </tr>
                        </thead>
                        
                        {loading ? (
                            <tbody>
                                {Array.from({ length: 7 }).map((_, i) => (
                                    <tr key={i} style={{ opacity: 1 - i * 0.1 }}>
                                        {[16, 8, 28, 20, 28, 16, 12, 12, 12, 12, 8].map((w, j) => (
                                            <td key={j} style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
                                                <div
                                                    style={{
                                                        height: '12px',
                                                        width: `${w * 4}px`,
                                                        maxWidth: '100%',
                                                        borderRadius: '6px',
                                                        background: 'linear-gradient(90deg, #f1f5f9 25%, #e8edf2 50%, #f1f5f9 75%)',
                                                        backgroundSize: '200% 100%',
                                                        animation: `shimmer 1.4s ease-in-out infinite`,
                                                        animationDelay: `${i * 0.07}s`
                                                    }}
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        ) : paginatedData.length === 0 ? (
                            <tbody>
                                <tr>
                                    <td colSpan={11} className="p-32 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <span className="text-slate-600 font-semibold text-lg">Nenhum registro encontrado</span>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        ) : (
                            <tbody>
                                {paginatedData.map((row, idx) => {
                                    const uid = row._id || `${row.ano}|${row.curso}|${row.fragilidade}`;
                                    const isChecked = selectedForPdf.has(uid);
                                    
                                    const isISODate = (val: string) => /^\d{4}-\d{2}-\d{2}$/.test(val);
                                    const prazoDisplay = isISODate(row.prazo || '') ? (row.prazo || '').split('-').reverse().join('/') : row.prazo;
                                    
                                    return (
                                        <tr key={uid} className={isChecked ? 'bg-slate-50' : ''}>
                                            <td className="text-center">
                                                <input type="checkbox" className="w-4 h-4 cursor-pointer" checked={isChecked} onChange={() => handleToggleSelect(uid)} />
                                            </td>
                                            <td className="text-center">
                                                {renderStatusBadge(row)}
                                            </td>
                                            {isProe && <td className="font-semibold text-slate-900">{row.curso}</td>}
                                            <td className="text-slate-600 font-mono text-sm">{row.ano}</td>
                                            <td>
                                                {row.id && (
                                                    <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded mb-1 inline-block">
                                                        #{row.id}
                                                    </span>
                                                )}
                                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">{row.tipo}</span>
                                                <span className="text-sm font-normal text-slate-700">{row.fragilidade}</span>
                                            </td>
                                            <td className="text-sm font-normal text-slate-700">{row.acao}</td>
                                            <td>
                                                <span className="text-sm font-medium text-slate-900 block mb-1">{row.fonte}</span>
                                                {renderConceito(row.conceito)}
                                            </td>
                                            <td>
                                                <div className="text-sm text-slate-700 space-y-1">
                                                    <div><span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Data Final:</span> {prazoDisplay}</div>
                                                    <div><span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">RP:</span> {row.responsavel}</div>
                                                </div>
                                            </td>
                                            <td className="text-sm font-normal text-slate-700">{row.recursos}</td>
                                            <td>
                                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Data: {formatDateTimeBR(row.dataReuniao)}</span>
                                                {row.minutaReuniao && (
                                                    <span className="text-sm text-uems-blue font-medium break-words block cursor-pointer hover:underline">{row.minutaReuniao}</span>
                                                )}
                                            </td>
                                            <td className="text-center group">
                                                <div className="flex flex-wrap gap-2 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {!isProe && (
                                                        <button onClick={() => setItemToAcompanhar(row)} className="text-slate-400 hover:text-slate-700 bg-transparent hover:bg-transparent transition-colors p-1" title="Acompanhamento">
                                                            <ClipboardList className="w-[14px] h-[14px]" />
                                                        </button>
                                                    )}
                                                    {!isProe && user.podeEditar && (
                                                        <>
                                                            <button onClick={() => setItemToEdit(row)} className="text-slate-400 hover:text-slate-700 bg-transparent hover:bg-transparent transition-colors p-1" title="Editar">
                                                                <Edit2 className="w-[14px] h-[14px]" />
                                                            </button>
                                                            <button onClick={() => setItemToDelete(row)} className="text-slate-400 hover:text-red-600 bg-transparent hover:bg-transparent transition-colors p-1" title="Excluir">
                                                                <Trash2 className="w-[14px] h-[14px]" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        )}
                    </table>
                </div>

                {filteredData.length > ITEMS_PER_PAGE && (
                    <div className="border-t border-slate-100 px-6 py-4 bg-white flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                            Mostrando {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredData.length)}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length)} de <span className="text-slate-800">{filteredData.length}</span>
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
                isProcessing={isAcompanhando}
            />
        </>
    );
}
