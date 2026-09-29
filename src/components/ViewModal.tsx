import React, { useEffect, useState } from 'react';
import { Fragility } from '../types';
import { X, ClipboardList, Check, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { parseResponsaveis, formatDateTimeBR } from '../lib/utils';

interface ViewModalProps {
    item: Fragility;
    onClose: () => void;
    // Selo e barra vêm do Dashboard para seguirem exatamente a mesma regra da tabela.
    statusSeal: React.ReactNode;
    prazoBar: React.ReactNode;
    // Só para o coordenador; a PROE apenas consulta.
    onAcompanhar?: () => void;
    onToggleResponsavel?: (index: number, feito: boolean) => Promise<void>;
}

const isISODate = (val: string) => /^\d{4}-\d{2}-\d{2}$/.test(val);
const dataBR = (val?: string) => (val && isISODate(val) ? val.split('-').reverse().join('/') : val) || '—';

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

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{rotulo}</span>
            <span className="text-sm text-ink leading-relaxed break-words">{children}</span>
        </div>
    );
}

export function ViewModal({ item, onClose, statusSeal, prazoBar, onAcompanhar, onToggleResponsavel }: ViewModalProps) {
    const [salvando, setSalvando] = useState<number | null>(null);

    useEffect(() => {
        const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', aoTeclar);
        return () => window.removeEventListener('keydown', aoTeclar);
    }, [onClose]);

    const responsaveis = parseResponsaveis(item.responsavel).filter(r => r.nome.trim());
    const feitos = responsaveis.filter(r => r.feito).length;
    const historico = [...(item.acompanhamentos || [])].reverse();
    const minutaEhLink = /^https?:\/\//i.test((item.minutaReuniao || '').trim());

    const alternar = async (idx: number, feito: boolean) => {
        if (!onToggleResponsavel) return;
        setSalvando(idx);
        try { await onToggleResponsavel(idx, feito); } finally { setSalvando(null); }
    };

    return (
        <div className="fixed inset-0 z-[60] flex justify-end">
            <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
            <motion.aside
                role="dialog"
                aria-modal="true"
                aria-labelledby="detalhe-titulo"
                initial={{ x: 32, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="relative w-full max-w-[560px] h-full bg-white shadow-[-12px_0_32px_rgba(16,24,38,0.12)] flex flex-col text-left"
            >
                <header className="flex items-center justify-between gap-4 px-7 py-4 border-b border-rule shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        {item.id && <span className="font-mono text-xs font-medium text-ink-muted bg-[#EEF0F4] px-2 py-0.5 rounded">#{item.id}</span>}
                        <h2 id="detalhe-titulo" className="font-serif-boletim italic text-lg font-semibold text-uems-dark">Detalhes do registro</h2>
                    </div>
                    <button onClick={onClose} aria-label="Fechar (Esc)" className="w-11 h-11 flex items-center justify-center rounded-md text-ink-muted hover:bg-slate-100 hover:text-ink transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto px-7 py-6 flex flex-col gap-7">
                    <div className="flex flex-col gap-2.5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                            {statusSeal}
                            <span className="text-[13px] text-ink-muted">
                                {[item.ano, item.fonte, item.conceito && `Conceito ${item.conceito}`].filter(Boolean).join(' · ')}
                            </span>
                        </div>
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{item.tipo}</span>
                        <p className="text-[22px] font-bold leading-snug text-ink whitespace-pre-wrap">{item.fragilidade}</p>
                        {item.curso && <span className="text-[13px] text-ink-muted">{item.curso}</span>}
                    </div>

                    <Secao titulo="Ação planejada">
                        <p className="text-[15px] leading-relaxed text-ink whitespace-pre-wrap">{item.acao || '—'}</p>
                    </Secao>

                    <Secao titulo="Prazo">
                        <div className="grid grid-cols-2 gap-4">
                            <Campo rotulo="Início (reunião)"><span className="font-mono">{dataBR(item.dataReuniao)}</span></Campo>
                            <Campo rotulo="Data final"><span className="font-mono">{dataBR(item.prazo)}</span></Campo>
                        </div>
                        {prazoBar}
                    </Secao>

                    {responsaveis.length > 0 && (
                        <Secao titulo="Responsáveis" extra={`${feitos} de ${responsaveis.length} concluíram`}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {responsaveis.map((r, idx) => onToggleResponsavel ? (
                                    <label key={idx} className={`flex items-center gap-3 min-h-11 px-3 mb-0 rounded-md border text-sm font-normal normal-case tracking-normal transition-colors ${salvando === idx ? 'border-uems-blue/40 bg-seal-aguardando-bg cursor-wait' : r.feito ? 'border-[#CFE5D8] bg-seal-concluida-bg cursor-pointer' : 'border-rule cursor-pointer hover:border-[#B9C0CC]'}`}>
                                        <input
                                            type="checkbox"
                                            checked={r.feito}
                                            disabled={salvando !== null}
                                            onChange={e => alternar(idx, e.target.checked)}
                                            className="w-[18px] h-[18px] accent-seal-concluida shrink-0"
                                        />
                                        <span className={`flex-1 min-w-0 truncate ${r.feito ? 'text-seal-concluida font-medium' : 'text-ink'}`} title={r.nome}>{r.nome}</span>
                                        {salvando === idx && <Loader2 className="w-4 h-4 animate-spin text-uems-blue shrink-0" aria-label="Salvando" />}
                                    </label>
                                ) : (
                                    <span key={idx} className={`flex items-center gap-2 min-h-11 px-3 rounded-md border text-sm ${r.feito ? 'border-[#CFE5D8] bg-seal-concluida-bg text-seal-concluida font-medium' : 'border-rule text-ink'}`}>
                                        {r.feito && <Check className="w-4 h-4 shrink-0" />}
                                        <span className="truncate" title={r.nome}>{r.nome}</span>
                                    </span>
                                ))}
                            </div>
                        </Secao>
                    )}

                    <Secao titulo="Recursos e comprovação">
                        <div className="grid grid-cols-2 gap-4">
                            <Campo rotulo="Recursos">{item.recursos || '—'}</Campo>
                            <Campo rotulo="Reunião de aprovação">
                                {formatDateTimeBR(item.dataReuniao)}
                                {item.minutaReuniao && (
                                    <>
                                        {' · '}
                                        {minutaEhLink
                                            ? <a href={item.minutaReuniao.trim()} target="_blank" rel="noopener noreferrer" className="text-uems-blue underline underline-offset-2 break-all">Abrir ata</a>
                                            : <span>{item.minutaReuniao}</span>}
                                    </>
                                )}
                            </Campo>
                        </div>
                    </Secao>

                    <Secao titulo="Histórico de acompanhamento">
                        {historico.length === 0 ? (
                            <p className="p-5 border border-dashed border-rule rounded-md text-sm text-ink-muted text-center">Nenhum acompanhamento registrado ainda.</p>
                        ) : (
                            <ol className="flex flex-col gap-3">
                                {historico.map((ac, idx) => (
                                    <li key={idx} className="border border-rule rounded-md p-4 flex flex-col gap-2">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span className="text-sm font-semibold text-ink">{ac.status}</span>
                                            <span className="font-mono text-xs text-ink-muted">{formatDateTimeBR(ac.dataRegistro)}</span>
                                        </div>
                                        {ac.descricao && <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">{ac.descricao}</p>}
                                        <div className="flex flex-wrap gap-4 text-xs text-ink-muted">
                                            {ac.registradoPor && <span>Por {ac.registradoPor}</span>}
                                            {ac.novoPrazo && <span>Novo prazo: <span className="font-mono">{dataBR(ac.novoPrazo)}</span></span>}
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </Secao>
                </div>

                <footer className="flex gap-3 px-7 py-5 border-t border-rule shrink-0">
                    {onAcompanhar && (
                        <button onClick={onAcompanhar} className="flex-1 h-11 rounded-md bg-uems-blue hover:bg-[#002A73] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                            <ClipboardList className="w-4 h-4" /> Registrar acompanhamento
                        </button>
                    )}
                    <button onClick={onClose} className={`${onAcompanhar ? '' : 'flex-1 '}h-11 px-5 rounded-md border border-rule bg-white text-sm font-semibold text-ink hover:border-[#B9C0CC] transition-colors`}>
                        Fechar
                    </button>
                </footer>
            </motion.aside>
        </div>
    );
}
