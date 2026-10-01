import React, { useState, useRef, useEffect } from 'react';
import type { Fragility, User, Responsavel } from '../types';
import { DIMENSIONS, SOURCES, OUTRA_FONTE_PREFIXO } from '../lib/constants';
import { DatePickerInput } from './DatePickerInput';
import { serializeResponsaveis, parseResponsaveis } from '../lib/utils';
import { AlertCircle, Plus, X, Pencil, Trash2, Send } from 'lucide-react';
import { motion } from 'motion/react';

interface ActionFormProps {
    user: User;
    cart: Fragility[];
    onSaveToCart: (fragility: Fragility) => void;
    onEditCartItem: (idx: number) => void;
    onRemoveCartItem: (idx: number) => void;
    onReview: () => void;
    revisaoAberta: boolean;
    showAlert: (title: string, message: string) => void;
}

const MAGIC_DADOS: Record<string, Partial<Fragility> & { responsaveis: string[] }> = {
    "Infraestrutura": {
        fragilidade: "Falta de referências bibliográficas",
        fonte: "Relatório Enade (INEP)",
        conceito: "1",
        acao: "Renovação do acervo bibliográfico",
        prazo: "2027-05-25",
        responsaveis: ["Comissão de desenvolvimento de coleções da UEMS", "Comitê Enade", "CDE"],
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
        responsaveis: ["CDE", "Colegiado"],
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
        responsaveis: ["CDE", "Colegiado"],
        recursos: "Bolsas de monitoria, moodle e horas docentes",
        dataReuniao: "A agendar",
        minutaReuniao: "Pendente"
    }
};

type CampoForm = 'tipo' | 'fragilidade' | 'fonte' | 'conceito' | 'acao' | 'prazo' | 'responsavel' | 'recursos' | 'dataReuniao' | 'minutaReuniao';
// Ordem do formulário: o foco vai para o primeiro campo com erro.
const ORDEM_CAMPOS: CampoForm[] = ['tipo', 'fragilidade', 'fonte', 'conceito', 'acao', 'prazo', 'responsavel', 'recursos', 'dataReuniao', 'minutaReuniao'];

const CLASSE_ROTULO = 'mb-0 text-[13px] font-semibold text-ink normal-case tracking-normal';
const CLASSE_INPUT = 'input-uems h-11 py-0';
const CLASSE_TEXTAREA = 'input-uems py-3 leading-relaxed';
const CLASSE_ERRO_INPUT = ' !border-seal-nao-executada';

const dataBR = (val?: string) => (val && /^\d{4}-\d{2}-\d{2}$/.test(val) ? val.split('-').reverse().join('/') : val) || '—';

function Secao({ num, titulo, children }: { num: string; titulo: string; children: React.ReactNode }) {
    return (
        <section className="flex flex-col gap-5">
            <h2 className="flex items-center gap-3 m-0 after:content-[''] after:flex-1 after:h-px after:bg-rule">
                <span className="font-mono text-[13px] font-medium text-uems-gold-dark">{num}</span>
                <span className="font-serif-boletim italic text-[17px] font-semibold text-uems-dark">{titulo}</span>
            </h2>
            {children}
        </section>
    );
}

function Campo({ id, rotulo, dica, erro, grupo, children }: { id: string; rotulo: string; dica?: string; erro?: string; grupo?: boolean; children: React.ReactNode }) {
    return (
        <div id={`campo-${id}`} className="flex flex-col gap-1.5 min-w-0">
            {grupo
                ? <span id={`${id}-rotulo`} className={CLASSE_ROTULO}>{rotulo}</span>
                : <label htmlFor={id} className={CLASSE_ROTULO}>{rotulo}</label>}
            {dica && <span id={`${id}-dica`} className="text-xs leading-snug text-ink-muted">{dica}</span>}
            {children}
            {erro && (
                <span id={`${id}-erro`} role="alert" className="flex items-center gap-1.5 text-xs font-semibold text-seal-nao-executada">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {erro}
                </span>
            )}
        </div>
    );
}

export function ActionForm({ user, cart, onSaveToCart, onEditCartItem, onRemoveCartItem, onReview, revisaoAberta, showAlert }: ActionFormProps) {
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
    const [erros, setErros] = useState<Partial<Record<CampoForm, string>>>({});

    const limparErro = (campo: CampoForm) => setErros(prev => {
        if (!prev[campo]) return prev;
        const { [campo]: _, ...resto } = prev;
        return resto;
    });

    const handleResponsavelNomeChange = (index: number, nome: string) => {
        setResponsaveis(prev => prev.map((r, i) => i === index ? { ...r, nome } : r));
        limparErro('responsavel');
    };

    const handleAddResponsavel = () => {
        setResponsaveis(prev => [...prev, { nome: '', feito: false }]);
    };

    const handleRemoveResponsavel = (index: number) => {
        setResponsaveis(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== index));
    };

    const fonteEhOutra = formData.fonte === 'Outra' || formData.fonte?.startsWith(OUTRA_FONTE_PREFIXO);
    const fonteSelectValue = fonteEhOutra ? 'Outra' : (formData.fonte || '');

    const typingIntervalsRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

    useEffect(() => {
        const intervals = typingIntervalsRef.current;
        return () => {
            Object.values(intervals).forEach(clearInterval);
        };
    }, []);

    const typeIntoField = (field: keyof Fragility, fullText: string) => {
        let charCount = 0;
        const velocidade = 18; // ms por caractere

        const interval = setInterval(() => {
            charCount++;
            const parcial = fullText.slice(0, charCount);
            setFormData(prev => ({ ...prev, [field]: parcial }));

            if (charCount >= fullText.length) {
                clearInterval(interval);
                delete typingIntervalsRef.current[field as string];
            }
        }, velocidade);

        typingIntervalsRef.current[field as string] = interval;
    };

    const typeResponsaveisSequencial = (nomes: string[]) => {
        setResponsaveis([{ nome: '', feito: false }]);
        let nomeIndex = 0;
        let charCount = 0;
        const velocidade = 18;

        const interval = setInterval(() => {
            charCount++;
            const idx = nomeIndex; // o updater roda depois; nomeIndex já pode ter avançado
            const nomeAtual = nomes[idx];
            const parcial = nomeAtual.slice(0, charCount);

            setResponsaveis(prev => prev.map((r, i) => i === idx ? { ...r, nome: parcial } : r));

            if (charCount >= nomeAtual.length) {
                nomeIndex++;
                charCount = 0;
                if (nomeIndex < nomes.length) {
                    setResponsaveis(prev => [...prev, { nome: '', feito: false }]);
                } else {
                    clearInterval(interval);
                    delete typingIntervalsRef.current['responsavel'];
                }
            }
        }, velocidade);

        typingIntervalsRef.current['responsavel'] = interval;
    };

    const handleMagicFocus = (field: keyof Fragility) => {
        if (user.courseName !== 'Teste' || !formData.tipo) return;
        const magicData = MAGIC_DADOS[formData.tipo];
        if (!magicData) return;

        if (typedFields.has(field as string)) return;

        limparErro(field as CampoForm);

        if (field === 'responsavel') {
            if (!magicData.responsaveis || magicData.responsaveis.length === 0) return;
            setTypedFields(prev => new Set(prev).add(field as string));
            typeResponsaveisSequencial(magicData.responsaveis);
            return;
        }

        const textToType = magicData[field] || '';
        if (!textToType) return;

        setTypedFields(prev => new Set(prev).add(field as string));
        typeIntoField(field, textToType as string);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
        limparErro(e.target.name as CampoForm);
    };

    const handleFonteSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value === 'Outra') {
            setFormData(prev => ({ ...prev, fonte: outraFonteTexto ? OUTRA_FONTE_PREFIXO + outraFonteTexto : 'Outra' }));
        } else {
            setOutraFonteTexto('');
            setFormData(prev => ({ ...prev, fonte: value }));
        }
        limparErro('fonte');
    };

    const handleOutraFonteTextoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const texto = e.target.value;
        setOutraFonteTexto(texto);
        setFormData(prev => ({ ...prev, fonte: OUTRA_FONTE_PREFIXO + texto }));
        limparErro('fonte');
    };

    const handleRadioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTipo = e.target.value;
        limparErro('tipo');

        if (user.courseName === 'Teste') {
            Object.values(typingIntervalsRef.current).forEach(clearInterval);
            typingIntervalsRef.current = {};
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

    const limparFormulario = () => {
        Object.values(typingIntervalsRef.current).forEach(clearInterval);
        typingIntervalsRef.current = {};
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
        setErros({});
    };

    const validar = (): Partial<Record<CampoForm, string>> => {
        const e: Partial<Record<CampoForm, string>> = {};
        const vazio = (v?: string) => !v || !v.trim();
        if (vazio(formData.tipo)) e.tipo = 'Escolha a dimensão da fragilidade.';
        if (vazio(formData.fragilidade)) e.fragilidade = 'Descreva a fragilidade.';
        if (!fonteSelectValue) e.fonte = 'Escolha a fonte identificadora.';
        else if (fonteEhOutra && !outraFonteTexto.trim()) e.fonte = 'Descreva a fonte identificadora.';
        if (vazio(formData.conceito)) e.conceito = 'Informe o conceito: 1 a 5, Suficiente, Insuficiente ou N/A.';
        if (vazio(formData.acao)) e.acao = 'Descreva a ação proposta.';
        if (vazio(formData.prazo)) e.prazo = 'Escolha a data final.';
        if (!responsaveis.some(r => r.nome.trim())) e.responsavel = 'Informe ao menos um responsável.';
        if (vazio(formData.recursos)) e.recursos = 'Informe os recursos necessários.';
        if (vazio(formData.dataReuniao)) e.dataReuniao = 'Informe a data da reunião ou “A agendar”.';
        if (vazio(formData.minutaReuniao)) e.minutaReuniao = 'Cole o link da ata ou o número do processo SEI.';
        return e;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const encontrados = validar();
        if (Object.keys(encontrados).length > 0) {
            setErros(encontrados);
            const primeiro = ORDEM_CAMPOS.find(c => encontrados[c]);
            const bloco = primeiro && document.getElementById(`campo-${primeiro}`);
            const alvo = bloco?.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea');
            bloco?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            alvo?.focus({ preventScroll: true });
            return;
        }

        onSaveToCart({
            ano: formData.ano!,
            codigoCurso: formData.codigoCurso!,
            curso: formData.curso!,
            tipo: formData.tipo || "N/A",
            fragilidade: formData.fragilidade!.trim(),
            fonte: fonteEhOutra ? OUTRA_FONTE_PREFIXO + outraFonteTexto.trim() : formData.fonte!,
            conceito: formData.conceito!.trim(),
            acao: formData.acao!.trim(),
            prazo: formData.prazo!.trim(),
            responsavel: serializeResponsaveis(responsaveis),
            recursos: formData.recursos!.trim(),
            dataReuniao: formData.dataReuniao!.trim(),
            minutaReuniao: formData.minutaReuniao!.trim()
        });

        limparFormulario();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleReviewClick = () => {
        if (cart.length === 0) {
            showAlert("Atenção", "A sua lista está vazia. Adicione e salve pelo menos uma fragilidade.");
            return;
        }

        const hasPendingData = Boolean(
            formData.fragilidade?.trim() || formData.acao?.trim() || formData.conceito?.trim() ||
            formData.prazo?.trim() || responsaveis.some(r => r.nome.trim()) || formData.recursos?.trim() ||
            formData.dataReuniao?.trim() || formData.minutaReuniao?.trim()
        );

        if (hasPendingData) {
            showAlert("Atenção", "Tem dados preenchidos no formulário. Clique em 'Salvar na lista' primeiro ou limpe os campos.");
            return;
        }

        onReview();
    };

    const invalido = (campo: CampoForm) => erros[campo] ? CLASSE_ERRO_INPUT : '';
    const descricao = (campo: CampoForm) => [`${campo}-dica`, erros[campo] ? `${campo}-erro` : ''].filter(Boolean).join(' ');

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-8 items-start">
            <form onSubmit={handleSubmit} noValidate className="bg-white border border-rule rounded-lg px-6 py-8 sm:px-12 sm:py-10 flex flex-col gap-9 text-left">
                <div className="flex flex-col gap-1.5">
                    <h1 className="font-serif-boletim text-[28px] font-semibold text-uems-dark leading-tight">Nova fragilidade</h1>
                    <p className="text-sm text-ink-muted leading-relaxed">Uma fragilidade por vez. Salve na lista e envie tudo junto no final. Todos os campos são obrigatórios.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[180px_minmax(0,1fr)] gap-6 px-5 py-4 bg-[#FAFAF8] border border-rule rounded-md">
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="ano" className={CLASSE_ROTULO}>Ano de referência</label>
                        <select id="ano" name="ano" value={formData.ano} onChange={handleChange} className={CLASSE_INPUT}>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1.5 min-w-0">
                        <span className={CLASSE_ROTULO}>Curso</span>
                        <span className="h-11 flex items-center gap-2.5 min-w-0">
                            <span className="text-[15px] font-semibold text-uems-dark truncate">{formData.curso}</span>
                            <span className="text-xs text-ink-muted shrink-0">definido pelo seu acesso</span>
                        </span>
                    </div>
                </div>

                <Secao num="01" titulo="Dimensão">
                    <div id="campo-tipo" className="flex flex-col gap-1.5">
                        <fieldset aria-describedby={erros.tipo ? 'tipo-erro' : undefined} className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-0 p-0 m-0">
                            <legend className="sr-only">Dimensão da fragilidade</legend>
                            {DIMENSIONS.map((dim) => {
                                const ativo = formData.tipo === dim;
                                return (
                                    <label key={dim} className={`mb-0 flex items-center gap-3 min-h-14 px-4 rounded-md cursor-pointer normal-case tracking-normal text-sm transition-colors ${ativo ? 'border-2 border-uems-blue bg-[#F2F5FB] text-uems-blue font-semibold px-[15px]' : `border bg-white text-ink font-medium hover:border-[#B9C0CC] ${erros.tipo ? 'border-seal-nao-executada' : 'border-rule'}`}`}>
                                        <input type="radio" name="tipo" value={dim} checked={ativo} onChange={handleRadioChange} className="w-[18px] h-[18px] accent-uems-blue shrink-0" />
                                        {dim}
                                    </label>
                                );
                            })}
                        </fieldset>
                        {erros.tipo && (
                            <span id="tipo-erro" role="alert" className="flex items-center gap-1.5 text-xs font-semibold text-seal-nao-executada">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {erros.tipo}
                            </span>
                        )}
                    </div>
                </Secao>

                <Secao num="02" titulo="Identificação">
                    <Campo id="fragilidade" rotulo="Descrição da fragilidade" dica="Relate o problema: PPC, titulação, espaços, equipamentos…" erro={erros.fragilidade}>
                        <textarea id="fragilidade" name="fragilidade" value={formData.fragilidade} onChange={handleChange} onFocus={() => handleMagicFocus('fragilidade')} rows={3} aria-invalid={!!erros.fragilidade} aria-describedby={descricao('fragilidade')} className={CLASSE_TEXTAREA + invalido('fragilidade')} />
                    </Campo>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        <Campo id="fonte" rotulo="Fonte identificadora" dica="Onde a fragilidade foi apontada" erro={erros.fonte}>
                            <select id="fonte" name="fonte" value={fonteSelectValue} onChange={handleFonteSelectChange} onFocus={() => handleMagicFocus('fonte')} aria-invalid={!!erros.fonte} aria-describedby={descricao('fonte')} className={CLASSE_INPUT + invalido('fonte')}>
                                <option value="">Selecione…</option>
                                {SOURCES.map(source => <option key={source} value={source}>{source}</option>)}
                            </select>
                            {fonteEhOutra && (
                                <input type="text" aria-label="Descreva a fonte identificadora" value={outraFonteTexto} onChange={handleOutraFonteTextoChange} className={CLASSE_INPUT + ' mt-1' + (erros.fonte && !outraFonteTexto.trim() ? CLASSE_ERRO_INPUT : '')} placeholder="Descreva a fonte identificadora" />
                            )}
                        </Campo>
                        <Campo id="conceito" rotulo="Conceito" dica="1 a 5, Suficiente, Insuficiente ou N/A" erro={erros.conceito}>
                            <input id="conceito" type="text" name="conceito" value={formData.conceito} onChange={handleChange} onFocus={() => handleMagicFocus('conceito')} aria-invalid={!!erros.conceito} aria-describedby={descricao('conceito')} className={CLASSE_INPUT + invalido('conceito')} />
                        </Campo>
                    </div>
                </Secao>

                <Secao num="03" titulo="Plano de ação">
                    <Campo id="acao" rotulo="Ação prática proposta" dica="Quais medidas serão tomadas" erro={erros.acao}>
                        <textarea id="acao" name="acao" value={formData.acao} onChange={handleChange} onFocus={() => handleMagicFocus('acao')} rows={3} aria-invalid={!!erros.acao} aria-describedby={descricao('acao')} className={CLASSE_TEXTAREA + invalido('acao')} />
                    </Campo>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        <div onFocus={() => handleMagicFocus('prazo')}>
                            <Campo id="prazo" rotulo="Data final" dica="Até quando a ação deve estar concluída" erro={erros.prazo} grupo>
                                <DatePickerInput
                                    name="prazo"
                                    value={formData.prazo || ''}
                                    onChange={handleChange}
                                    className={CLASSE_INPUT + invalido('prazo')}
                                    placeholder="Escolha no calendário"
                                />
                            </Campo>
                        </div>
                        <Campo id="responsavel" rotulo="Responsáveis" dica="Quem executa a ação; cada um marca a sua parte depois" erro={erros.responsavel} grupo>
                            <div className="flex flex-col gap-2">
                                {responsaveis.map((r, index) => (
                                    <div key={index} className="flex gap-1">
                                        <input
                                            type="text"
                                            aria-label={`Responsável ${index + 1}`}
                                            value={r.nome}
                                            onChange={(e) => handleResponsavelNomeChange(index, e.target.value)}
                                            onFocus={() => handleMagicFocus('responsavel')}
                                            className={`${CLASSE_INPUT} flex-1${index === 0 ? invalido('responsavel') : ''}`}
                                            placeholder="Ex.: Coordenação"
                                        />
                                        {responsaveis.length > 1 && (
                                            <button type="button" onClick={() => handleRemoveResponsavel(index)} aria-label={`Remover responsável ${index + 1}`} className="w-11 h-11 shrink-0 flex items-center justify-center rounded-md text-ink-muted hover:bg-slate-100 hover:text-ink transition-colors">
                                                <X className="w-[18px] h-[18px]" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button type="button" onClick={handleAddResponsavel} className="self-start h-9 px-3 rounded-md border border-dashed border-[#B9C0CC] text-[13px] font-semibold text-uems-blue flex items-center gap-1.5 hover:bg-[#F2F5FB] transition-colors">
                                    <Plus className="w-4 h-4" /> Adicionar responsável
                                </button>
                            </div>
                        </Campo>
                    </div>
                    <Campo id="recursos" rotulo="Recursos necessários" dica="Financeiros, humanos, materiais" erro={erros.recursos}>
                        <textarea id="recursos" name="recursos" value={formData.recursos} onChange={handleChange} onFocus={() => handleMagicFocus('recursos')} rows={2} aria-invalid={!!erros.recursos} aria-describedby={descricao('recursos')} className={CLASSE_TEXTAREA + invalido('recursos')} />
                    </Campo>
                </Secao>

                <Secao num="04" titulo="Validação">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        <Campo id="dataReuniao" rotulo="Data da reunião" dica="Data em que o plano foi aprovado, ou “A agendar”" erro={erros.dataReuniao}>
                            <input id="dataReuniao" type="text" name="dataReuniao" value={formData.dataReuniao} onChange={handleChange} onFocus={() => handleMagicFocus('dataReuniao')} aria-invalid={!!erros.dataReuniao} aria-describedby={descricao('dataReuniao')} className={CLASSE_INPUT + invalido('dataReuniao')} placeholder="Ex.: 15/04/2026" />
                        </Campo>
                        <Campo id="minutaReuniao" rotulo="Minuta da reunião" dica="Link do Drive, processo SEI ou ata" erro={erros.minutaReuniao}>
                            <input id="minutaReuniao" type="text" name="minutaReuniao" value={formData.minutaReuniao} onChange={handleChange} onFocus={() => handleMagicFocus('minutaReuniao')} aria-invalid={!!erros.minutaReuniao} aria-describedby={descricao('minutaReuniao')} className={CLASSE_INPUT + invalido('minutaReuniao')} />
                        </Campo>
                    </div>
                </Secao>

                <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-6 border-t border-rule">
                    <button type="button" onClick={limparFormulario} className="h-11 px-4 rounded-md text-sm font-semibold text-ink-muted hover:text-ink hover:bg-slate-50 transition-colors">
                        Limpar formulário
                    </button>
                    <button type="submit" className="h-11 px-5 rounded-md bg-uems-blue hover:bg-[#002A73] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                        <Plus className="w-4 h-4" /> Salvar na lista
                    </button>
                </div>
            </form>

            {/* Some enquanto a revisão está aberta: o mesmo layoutId faz a lista "sair" daqui para a tela cheia. */}
            {!revisaoAberta && (
            <motion.aside layoutId="lista-envio" transition={{ type: 'spring', stiffness: 260, damping: 32 }} style={{ borderRadius: 8 }} aria-label="Lista para envio" className="bg-white border border-rule flex flex-col lg:sticky lg:top-24">
                <div className="flex items-center justify-between px-6 py-5 border-b-2 border-uems-gold">
                    <h2 className="font-serif-boletim italic text-[17px] font-semibold text-uems-dark">Lista para envio</h2>
                    <span className="font-mono text-xs font-medium text-uems-blue bg-seal-aguardando-bg px-2 py-0.5 rounded-full">{cart.length}</span>
                </div>
                {cart.length === 0 ? (
                    <p className="px-6 py-6 text-sm text-ink-muted leading-relaxed">Nenhuma fragilidade salva ainda. Preencha o formulário e clique em “Salvar na lista”.</p>
                ) : (
                    <ul className="flex flex-col max-h-[50vh] overflow-y-auto">
                        {cart.map((item, idx) => {
                            const nResp = parseResponsaveis(item.responsavel).filter(r => r.nome.trim()).length;
                            return (
                                <li key={idx} className="flex items-start gap-1 pl-6 pr-3 py-4 border-b border-rule">
                                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                                        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{item.tipo} · {item.ano}</span>
                                        <span className="text-sm font-semibold leading-snug text-ink">{item.fragilidade}</span>
                                        <span className="text-xs text-ink-muted">Prazo {dataBR(item.prazo)} · {nResp} {nResp === 1 ? 'responsável' : 'responsáveis'}</span>
                                    </div>
                                    <button type="button" onClick={() => onEditCartItem(idx)} aria-label={`Editar item ${idx + 1}`} className="w-11 h-11 shrink-0 flex items-center justify-center rounded-md text-ink-muted hover:bg-slate-100 hover:text-ink transition-colors">
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button type="button" onClick={() => onRemoveCartItem(idx)} aria-label={`Remover item ${idx + 1}`} className="w-11 h-11 shrink-0 flex items-center justify-center rounded-md text-ink-muted hover:bg-seal-nao-executada-bg hover:text-seal-nao-executada transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
                <div className="px-6 py-5 flex flex-col gap-3">
                    <button type="button" onClick={handleReviewClick} disabled={cart.length === 0} className="h-11 rounded-md bg-uems-blue hover:bg-[#002A73] disabled:bg-[#B9C0CC] disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                        <Send className="w-4 h-4" /> Revisar e enviar
                    </button>
                    <p className="text-xs text-ink-muted leading-relaxed text-center">Nada é enviado à PROE até você confirmar na revisão.</p>
                </div>
            </motion.aside>
            )}
        </div>
    );
}
