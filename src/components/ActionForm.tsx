import React, { useState } from 'react';
import type { Fragility, User, Responsavel } from '../types';
import { DIMENSIONS, SOURCES, OUTRA_FONTE_PREFIXO } from '../lib/constants';
import { DatePickerInput } from './DatePickerInput';
import { parseResponsaveis, serializeResponsaveis } from '../lib/utils';

interface ActionFormProps {
    user: User;
    cartLength: number;
    onSaveToCart: (fragility: Fragility) => void;
    onReview: () => void;
    showAlert: (title: string, message: string) => void;
}

const MAGIC_DADOS: Record<string, Partial<Fragility>> = {
    "Infraestrutura": {
        fragilidade: "Falta de referências bibliográficas",
        fonte: "Relatório Enade (INEP)",
        conceito: "1",
        acao: "Renovação do acervo bibliográfico",
        prazo: "2027-05-25",
        responsavel: "Comissão de desenvolvimento de coleções da UEMS, Comitê Enade e CDE",
        recursos: "Reuniões, Livros novos",
        dataReuniao: "25/05/2026",
        minutaReuniao: "Ata nº 05/2026 - Aprovada (Drive)"
    },
    "Organização Didático-Pedagógica": {
        fragilidade: "Estrutura curricular pouco flexível",
        fonte: "Avaliação in loco (CEE/MS)",
        conceito: "1",
        acao: "Reformulação do PPC e implementação de um sistema por créditos",
        prazo: "2028-06-10",
        responsavel: "CDE e Colegiado",
        recursos: "Reuniões da comissão e pedagógicas",
        dataReuniao: "10/06/2026",
        minutaReuniao: "Link SEI nº 12345/2026"
    },
    "Corpo Docente e Tutorial": {
        fragilidade: "Lacunas formativas iniciais",
        fonte: "Relatório de Autoavaliação",
        conceito: "-",
        acao: "Implementar programa de nivelamento e monitoria acadêmica (1º e 2º ano) com formalização no PPC",
        prazo: "2026-12-01",
        responsavel: "CDE e Colegiado",
        recursos: "Bolsas de monitoria, moodle e horas docentes",
        dataReuniao: "A agendar",
        minutaReuniao: "Pendente"
    }
};

export function ActionForm({ user, cartLength, onSaveToCart, onReview, showAlert }: ActionFormProps) {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 6 }, (_, i) => currentYear - 1 + i);

    const [formData, setFormData] = useState<Partial<Fragility>>({
        ano: currentYear.toString(),
        codigoCurso: user.courseId || '',
        curso: user.courseName || '',
        tipo: '',
        fragilidade: '',
        fonte: '',
        conceito: '',
        acao: '',
        prazo: '',
        responsavel: '',
        recursos: '',
        dataReuniao: '',
        minutaReuniao: ''
    });

    const [typedFields, setTypedFields] = useState<Set<string>>(new Set());
    const [outraFonteTexto, setOutraFonteTexto] = useState('');
    const [responsaveis, setResponsaveis] = useState<Responsavel[]>([{ nome: '', feito: false }]);

    const handleResponsavelNomeChange = (index: number, nome: string) => {
        setResponsaveis(prev => prev.map((r, i) => i === index ? { ...r, nome } : r));
    };

    const handleAddResponsavel = () => {
        setResponsaveis(prev => [...prev, { nome: '', feito: false }]);
    };

    const handleRemoveResponsavel = (index: number) => {
        setResponsaveis(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== index));
    };

    const fonteEhOutra = formData.fonte === 'Outra' || formData.fonte?.startsWith(OUTRA_FONTE_PREFIXO);
    const fonteSelectValue = fonteEhOutra ? 'Outra' : (formData.fonte || '');

    const handleMagicFocus = (field: keyof Fragility) => {
        if (user.courseName !== 'Teste' || !formData.tipo) return;
        const magicData = MAGIC_DADOS[formData.tipo];
        if (!magicData) return;

        if (typedFields.has(field as string)) return;

        const textToType = magicData[field] || '';
        if (!textToType) return;

        if (field === 'responsavel') {
            setResponsaveis(parseResponsaveis(textToType as string));
        } else {
            setFormData(prev => ({ ...prev, [field]: textToType }));
        }
        setTypedFields(prev => new Set(prev).add(field as string));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleFonteSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value === 'Outra') {
            setFormData(prev => ({ ...prev, fonte: outraFonteTexto ? OUTRA_FONTE_PREFIXO + outraFonteTexto : 'Outra' }));
        } else {
            setOutraFonteTexto('');
            setFormData(prev => ({ ...prev, fonte: value }));
        }
    };

    const handleOutraFonteTextoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const texto = e.target.value;
        setOutraFonteTexto(texto);
        setFormData(prev => ({ ...prev, fonte: OUTRA_FONTE_PREFIXO + texto }));
    };

    const handleRadioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTipo = e.target.value;
        
        if (user.courseName === 'Teste') {
            setFormData(prev => ({
                ...prev,
                tipo: newTipo,
                fragilidade: '', fonte: '', conceito: '', acao: '',
                prazo: '', responsavel: '', recursos: '', dataReuniao: '', minutaReuniao: ''
            }));
            setTypedFields(new Set());
            setOutraFonteTexto('');
            setResponsaveis([{ nome: '', feito: false }]);
        } else {
            setFormData(prev => ({ 
                ...prev, 
                tipo: newTipo
            }));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.fragilidade?.trim() || !formData.conceito?.trim()) {
            showAlert("Atenção", "Preencha os campos obrigatórios.");
            return;
        }

        if (fonteEhOutra && !outraFonteTexto.trim()) {
            showAlert("Atenção", "Descreva a fonte identificadora em \"Outra\".");
            return;
        }

        if (!responsaveis.some(r => r.nome.trim())) {
            showAlert("Atenção", "Informe ao menos um responsável.");
            return;
        }

        onSaveToCart({
            ano: formData.ano!,
            codigoCurso: formData.codigoCurso!,
            curso: formData.curso!,
            tipo: formData.tipo || "N/A",
            fragilidade: formData.fragilidade.trim(),
            fonte: fonteEhOutra ? OUTRA_FONTE_PREFIXO + outraFonteTexto.trim() : formData.fonte!,
            conceito: formData.conceito.trim(),
            acao: formData.acao!.trim(),
            prazo: formData.prazo!.trim(),
            responsavel: serializeResponsaveis(responsaveis),
            recursos: formData.recursos!.trim(),
            dataReuniao: formData.dataReuniao!.trim(),
            minutaReuniao: formData.minutaReuniao!.trim()
        });

        setFormData(prev => ({
            ...prev,
            tipo: '',
            fragilidade: '',
            fonte: '',
            conceito: '',
            acao: '',
            prazo: '',
            responsavel: '',
            recursos: '',
            dataReuniao: '',
            minutaReuniao: ''
        }));
        setTypedFields(new Set());
        setOutraFonteTexto('');
        setResponsaveis([{ nome: '', feito: false }]);
    };

    const handleReviewClick = () => {
        if (cartLength === 0) {
            showAlert("Atenção", "A sua lista está vazia. Adicione e salve pelo menos uma fragilidade.");
            return;
        }

        const hasPendingData = Boolean(
            formData.fragilidade?.trim() || formData.acao?.trim() || formData.conceito?.trim() ||
            formData.prazo?.trim() || responsaveis.some(r => r.nome.trim()) || formData.recursos?.trim() ||
            formData.dataReuniao?.trim() || formData.minutaReuniao?.trim()
        );

        if (hasPendingData) {
            showAlert("Atenção", "Tem dados preenchidos no formulário. Clique em 'Salvar Fragilidade' primeiro ou limpe os campos.");
            return;
        }

        onReview();
    };

    return (
        <section className="bg-white border border-slate-200 rounded-lg p-8 sm:p-12">
            <header className="relative min-h-[140px] rounded-lg overflow-hidden flex items-end p-8 mb-10">
                <img src="https://www.uems.br/anexos/imagens/conteudo/uems_imagens_2023-09-22_13-02-19.png" className="absolute inset-0 w-full h-full object-cover" alt="Plano de Ação" />
                <div className="absolute inset-0 bg-gradient-to-r from-uems-dark/90 to-uems-blue/60"></div>
                <div className="relative z-10 text-white w-full text-left">
                    <h1 className="text-2xl font-semibold mb-1">Plano de Ação</h1>
                    <p className="text-sm text-blue-100/80 w-full truncate">Submeta fragilidades e propostas de ações corretivas para a melhoria dos cursos da Universidade.</p>
                </div>
            </header>

            <form onSubmit={handleSubmit} className="text-left">
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6 pb-6 border-b border-slate-100">
                    <div className="md:col-span-1">
                        <label>Ano de Referência</label>
                        <select name="ano" value={formData.ano} onChange={handleChange} className="input-uems" required>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div className="md:col-span-3">
                        <label>Curso / Unidade Acadêmica (Bloqueado)</label>
                        <input type="text" value={formData.curso} className="input-uems" readOnly tabIndex={-1} />
                    </div>
                </div>

                <div className="section-group">
                    <span className="section-group-title">Dimensão</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {DIMENSIONS.map((dim) => (
                            <label key={dim} className={`border border-slate-200 rounded-md p-4 cursor-pointer transition-colors ${formData.tipo === dim ? 'border-uems-blue bg-blue-50/40 border-l-[3px] border-l-[#C8A84B]' : 'bg-white hover:bg-slate-50'}`}>
                                <input 
                                    type="radio" 
                                    name="tipo" 
                                    value={dim} 
                                    checked={formData.tipo === dim}
                                    onChange={handleRadioChange}
                                    className="hidden" 
                                    required 
                                />
                                <span className={`text-sm font-medium ${formData.tipo === dim ? 'text-uems-blue' : 'text-slate-700'}`}>{dim}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="section-group">
                    <span className="section-group-title">Identificação</span>
                    <div className="space-y-6">
                        <div>
                            <label>Descrição da Fragilidade</label>
                            <textarea 
                                name="fragilidade" 
                                value={formData.fragilidade} 
                                onChange={handleChange} 
                                onFocus={() => handleMagicFocus('fragilidade')}
                                rows={3} 
                                required 
                                className="input-uems" 
                                placeholder="Relate o problema (PPC, titulação, espaços, equipamentos...)"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label>Fonte Identificadora</label>
                                <select
                                    name="fonte"
                                    value={fonteSelectValue}
                                    onChange={handleFonteSelectChange}
                                    onFocus={() => handleMagicFocus('fonte')}
                                    required
                                    className="input-uems"
                                >
                                    <option value="">Selecione...</option>
                                    {SOURCES.map(source => <option key={source} value={source}>{source}</option>)}
                                </select>
                                {fonteEhOutra && (
                                    <input
                                        type="text"
                                        value={outraFonteTexto}
                                        onChange={handleOutraFonteTextoChange}
                                        required
                                        className="input-uems mt-2"
                                        placeholder="Descreva a fonte identificadora"
                                    />
                                )}
                            </div>
                            <div>
                                <label>Conceito</label>
                                <input 
                                    type="text" 
                                    name="conceito" 
                                    value={formData.conceito} 
                                    onChange={handleChange} 
                                    onFocus={() => handleMagicFocus('conceito')}
                                    required 
                                    className="input-uems" 
                                    placeholder="Ex: 1 a 5 ou N/A" 
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="section-group">
                    <span className="section-group-title">Plano de ação</span>
                    <div className="space-y-6">
                        <div>
                            <label>Ação Prática Proposta</label>
                            <textarea 
                                name="acao" 
                                value={formData.acao} 
                                onChange={handleChange} 
                                onFocus={() => handleMagicFocus('acao')}
                                rows={3} 
                                required 
                                className="input-uems" 
                                placeholder="Quais medidas serão tomadas?"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div onFocus={() => handleMagicFocus('prazo')}>
                                <label>Data Final</label>
                                <DatePickerInput 
                                    name="prazo"
                                    value={formData.prazo || ''}
                                    onChange={handleChange}
                                    className="input-uems"
                                    placeholder="Ex: 6 meses"
                                    required
                                />
                            </div>
                            <div>
                                <label>Responsável</label>
                                <div className="space-y-2">
                                    {responsaveis.map((r, index) => (
                                        <div key={index} className="flex gap-2">
                                            <input
                                                type="text"
                                                value={r.nome}
                                                onChange={(e) => handleResponsavelNomeChange(index, e.target.value)}
                                                onFocus={() => handleMagicFocus('responsavel')}
                                                required={index === 0}
                                                className="input-uems flex-1"
                                                placeholder="Ex: Coordenador"
                                            />
                                            {responsaveis.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveResponsavel(index)}
                                                    className="text-slate-400 hover:text-red-500 bg-transparent hover:bg-transparent px-2"
                                                    title="Remover responsável"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={handleAddResponsavel}
                                        className="text-xs font-semibold text-uems-blue hover:text-uems-dark bg-transparent hover:bg-transparent px-0"
                                    >
                                        + Adicionar responsável
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label>Recursos Necessários</label>
                            <textarea 
                                name="recursos" 
                                value={formData.recursos} 
                                onChange={handleChange} 
                                onFocus={() => handleMagicFocus('recursos')}
                                rows={2} 
                                required 
                                className="input-uems" 
                                placeholder="Financeiros, humanos..."
                            />
                        </div>
                    </div>
                </div>

                <div className="section-group">
                    <span className="section-group-title">Validação</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
                        <div>
                            <label>Data de Reunião</label>
                            <input 
                                type="text" 
                                name="dataReuniao" 
                                value={formData.dataReuniao} 
                                onChange={handleChange} 
                                onFocus={() => handleMagicFocus('dataReuniao')}
                                required 
                                className="input-uems" 
                                placeholder="Ex: 15/04/2026, ou 'A agendar'" 
                            />
                        </div>
                        <div>
                            <label>Minuta da Reunião</label>
                            <input 
                                type="text" 
                                name="minutaReuniao" 
                                value={formData.minutaReuniao} 
                                onChange={handleChange} 
                                onFocus={() => handleMagicFocus('minutaReuniao')}
                                required 
                                className="input-uems" 
                                placeholder="Cole o link do Drive, SEI ou Ata..." 
                            />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-10 border-t border-slate-100 mt-8">
                    <button type="submit"
                        className="border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium rounded-md py-2.5 px-5 flex-1">
                        Salvar na lista
                    </button>
                    <button type="button" onClick={handleReviewClick}
                        className="bg-uems-blue text-white text-sm font-semibold rounded-md py-2.5 px-5 hover:bg-uems-dark flex-1 flex items-center justify-center gap-2">
                        Revisar e enviar
                        {cartLength > 0 && (
                            <span className="bg-white text-uems-blue text-xs font-bold px-2 py-0.5 rounded ml-2">
                                {cartLength}
                            </span>
                        )}
                    </button>
                </div>
            </form>
        </section>
    );
}
