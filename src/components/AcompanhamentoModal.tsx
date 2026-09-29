import React, { useEffect, useState } from 'react';
import type { Fragility, User, Acompanhamento, StatusAcompanhamento } from '../types';
import { X, Check, Loader2, ClipboardList } from 'lucide-react';
import { formatDateTimeBR, parseResponsaveis } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { DatePickerInput } from './DatePickerInput';

interface AcompanhamentoModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: Fragility | null;
    currentUser: User;
    onSave: (acompanhamento: Acompanhamento) => Promise<void>;
    onToggleResponsavel: (index: number, feito: boolean) => Promise<void>;
    isProcessing: boolean;
}

const STATUS_OPTIONS: StatusAcompanhamento[] = [
    'Em execução',
    'Concluída',
    'Prazo prorrogado',
    'Não executada'
];

const CLASSE_ROTULO = 'mb-0 text-[13px] font-semibold text-ink normal-case tracking-normal';

const getStatusSeal = (s: string): React.CSSProperties => {
    switch (s) {
        case 'Em execução': return { color: 'var(--color-seal-pendente)', background: 'var(--color-seal-pendente-bg)' };
        case 'Em Andamento': return { color: 'var(--color-seal-aguardando)', background: 'var(--color-seal-aguardando-bg)' };
        case 'Concluída': return { color: 'var(--color-seal-concluida)', background: 'var(--color-seal-concluida-bg)' };
        case 'Não Concluída': return { color: 'var(--color-seal-nao-executada)', background: 'var(--color-seal-nao-executada-bg)' };
        case 'Suspensa': return { color: 'var(--color-seal-pendente)', background: 'var(--color-seal-pendente-bg)' };
        case 'Prazo prorrogado': return { color: 'var(--color-seal-prorrogado)', background: 'var(--color-seal-prorrogado-bg)' };
        case 'Não executada': return { color: 'var(--color-seal-nao-executada)', background: 'var(--color-seal-nao-executada-bg)' };
        default: return { color: 'var(--color-ink-muted)', background: '#EEF0F4' };
    }
};

function Secao({ titulo, extra, children }: { titulo: string; extra?: React.ReactNode; children: React.ReactNode }) {
    return (
        <section className="flex flex-col gap-3">
            <h3 className="flex items-center gap-3 font-serif-boletim italic text-[13px] font-semibold text-uems-gold-dark after:content-[''] after:flex-1 after:h-px after:bg-rule">
                {titulo}
                {extra && <span className="not-italic font-sans text-xs font-medium text-ink-muted">{extra}</span>}
            </h3>
            {children}
        </section>
    );
}

export function AcompanhamentoModal({ isOpen, onClose, item, currentUser, onSave, onToggleResponsavel, isProcessing }: AcompanhamentoModalProps) {
    const [status, setStatus] = useState<StatusAcompanhamento>('Concluída');
    const [descricao, setDescricao] = useState('');
    const [registradoPor, setRegistradoPor] = useState(currentUser.role === 'reitoria' ? 'PROE' : (currentUser.courseName || ''));
    const [novoPrazo, setNovoPrazo] = useState('');
    // Índice do responsável cujo clique ainda está sendo gravado na planilha. O envio
    // leva alguns segundos (Apps Script), e sem sinal nenhum o usuário clicava de novo
    // achando que não tinha pego.
    const [salvandoResponsavel, setSalvandoResponsavel] = useState<number | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', aoTeclar);
        return () => window.removeEventListener('keydown', aoTeclar);
    }, [isOpen, onClose]);

    if (!isOpen || !item) return null;

    const responsaveis = parseResponsaveis(item.responsavel);
    const concluidos = responsaveis.filter(r => r.feito).length;

    const handleToggle = async (idx: number, feito: boolean) => {
        setSalvandoResponsavel(idx);
        try {
            await onToggleResponsavel(idx, feito);
        } finally {
            setSalvandoResponsavel(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const payload: Acompanhamento = {
            dataRegistro: new Date().toISOString(),
            status,
            descricao,
            registradoPor
        };

        if (status === 'Prazo prorrogado' && novoPrazo) {
            payload.novoPrazo = novoPrazo;
        }

        await onSave(payload);

        setDescricao('');
        setNovoPrazo('');
        setStatus('Concluída');
    };

    const acompanhamentos = [...(item.acompanhamentos || [])].reverse();

    return (
        <AnimatePresence>
            {isOpen && item && (
                <div className="fixed inset-0 z-[70] flex justify-end">
                    <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
                    <motion.aside
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="acomp-titulo"
                        initial={{ x: 32, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 32, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="relative w-full max-w-[560px] h-full bg-white shadow-[-12px_0_32px_rgba(16,24,38,0.12)] flex flex-col text-left"
                    >
                        <header className="flex items-center justify-between gap-4 px-7 py-4 border-b border-rule shrink-0">
                            <div className="flex items-center gap-3 min-w-0">
                                {item.id && <span className="font-mono text-xs font-medium text-ink-muted bg-[#EEF0F4] px-2 py-0.5 rounded">#{item.id}</span>}
                                <h2 id="acomp-titulo" className="font-serif-boletim italic text-lg font-semibold text-uems-dark">Acompanhamento</h2>
                            </div>
                            <button type="button" onClick={onClose} aria-label="Fechar (Esc)" className="w-11 h-11 flex items-center justify-center rounded-md text-ink-muted hover:bg-slate-100 hover:text-ink transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </header>

                        <div className="flex-1 overflow-y-auto px-7 py-6 flex flex-col gap-7">
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{item.tipo}</span>
                                <p className="text-lg font-bold leading-snug text-ink whitespace-pre-wrap">{item.fragilidade}</p>
                            </div>

                            {responsaveis.length > 0 && (
                                <Secao titulo="Responsáveis" extra={`${concluidos} de ${responsaveis.length} concluíram`}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {responsaveis.map((r, idx) => {
                                            const salvando = salvandoResponsavel === idx;
                                            return (
                                                <label key={idx} className={`flex items-center gap-3 min-h-11 px-3 mb-0 rounded-md border text-sm font-normal normal-case tracking-normal transition-colors ${salvando ? 'border-uems-blue/40 bg-seal-aguardando-bg cursor-wait' : r.feito ? 'border-[#CFE5D8] bg-seal-concluida-bg cursor-pointer' : 'border-rule cursor-pointer hover:border-[#B9C0CC]'}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={r.feito}
                                                        disabled={isProcessing || salvandoResponsavel !== null}
                                                        onChange={(e) => handleToggle(idx, e.target.checked)}
                                                        className="w-[18px] h-[18px] accent-seal-concluida shrink-0"
                                                    />
                                                    <span className={`flex-1 min-w-0 truncate ${r.feito ? 'text-seal-concluida font-medium' : 'text-ink'}`} title={r.nome}>{r.nome}</span>
                                                    {salvando
                                                        ? <Loader2 className="w-4 h-4 animate-spin text-uems-blue shrink-0" aria-label="Salvando" />
                                                        : r.feito && <Check className="w-4 h-4 text-seal-concluida shrink-0" aria-label="Concluiu sua parte" />}
                                                </label>
                                            );
                                        })}
                                    </div>
                                </Secao>
                            )}

                            <Secao titulo="Novo acompanhamento">
                                <form id="form-acompanhamento" onSubmit={handleSubmit} className="flex flex-col gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <label htmlFor="acomp-status" className={CLASSE_ROTULO}>Status</label>
                                        <select id="acomp-status" value={status} onChange={(e) => setStatus(e.target.value as StatusAcompanhamento)} className="input-uems h-11 py-0" required>
                                            {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    </div>

                                    {status === 'Prazo prorrogado' && (
                                        <div className="flex flex-col gap-1.5">
                                            <span className={CLASSE_ROTULO}>Novo prazo</span>
                                            <DatePickerInput
                                                name="novoPrazo"
                                                value={novoPrazo}
                                                onChange={(e) => setNovoPrazo(e.target.value)}
                                                required
                                                className="input-uems h-11 py-0"
                                                placeholder="Escolha no calendário"
                                            />
                                        </div>
                                    )}

                                    <div className="flex flex-col gap-1.5">
                                        <label htmlFor="acomp-descricao" className={CLASSE_ROTULO}>Descrição ou justificativa</label>
                                        <textarea
                                            id="acomp-descricao"
                                            value={descricao}
                                            onChange={(e) => setDescricao(e.target.value)}
                                            rows={3}
                                            className="input-uems py-3 leading-relaxed"
                                            placeholder={status === 'Não executada' ? 'Por que não foi executada?' : status === 'Prazo prorrogado' ? 'Justificativa para a prorrogação…' : status === 'Em execução' ? 'O que já foi feito e o que falta?' : 'Descreva o andamento…'}
                                            required
                                        />
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <label htmlFor="acomp-por" className={CLASSE_ROTULO}>Registrado por</label>
                                        <input id="acomp-por" type="text" value={registradoPor} onChange={(e) => setRegistradoPor(e.target.value)} className="input-uems h-11 py-0" required />
                                    </div>
                                </form>
                            </Secao>

                            <Secao titulo="Histórico">
                                {acompanhamentos.length > 0 ? (
                                    <ol className="flex flex-col gap-3">
                                        {acompanhamentos.map((acomp, idx) => (
                                            <li key={idx} className="border border-rule rounded-md p-4 flex flex-col gap-2">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <span className="status-seal" style={getStatusSeal(acomp.status)}>{acomp.status}</span>
                                                    <span className="font-mono text-xs text-ink-muted">{formatDateTimeBR(acomp.dataRegistro)}</span>
                                                </div>
                                                {acomp.descricao && <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">{acomp.descricao}</p>}
                                                {acomp.registradoPor && <span className="text-xs text-ink-muted">Por {acomp.registradoPor}</span>}
                                            </li>
                                        ))}
                                    </ol>
                                ) : (
                                    <p className="p-5 border border-dashed border-rule rounded-md text-sm text-ink-muted text-center">Nenhum acompanhamento registrado ainda.</p>
                                )}
                            </Secao>
                        </div>

                        <footer className="flex gap-3 px-7 py-5 border-t border-rule shrink-0">
                            <button
                                type="submit"
                                form="form-acompanhamento"
                                disabled={isProcessing}
                                className="flex-1 h-11 rounded-md bg-uems-blue hover:bg-[#002A73] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                            >
                                {isProcessing
                                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Registrando…</>
                                    : <><ClipboardList className="w-4 h-4" /> Registrar acompanhamento</>}
                            </button>
                            <button type="button" onClick={onClose} className="h-11 px-5 rounded-md border border-rule bg-white text-sm font-semibold text-ink hover:border-[#B9C0CC] transition-colors">
                                Fechar
                            </button>
                        </footer>
                    </motion.aside>
                </div>
            )}
        </AnimatePresence>
    );
}
