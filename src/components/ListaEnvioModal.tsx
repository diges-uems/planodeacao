import { useEffect } from 'react';
import type { Fragility } from '../types';
import { ArrowLeft, Check, Loader2, Pencil, Send, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { parseResponsaveis } from '../lib/utils';
import { EditForm } from './EditModal';

const dataBR = (val?: string) => (val && /^\d{4}-\d{2}-\d{2}$/.test(val) ? val.split('-').reverse().join('/') : val) || '—';

interface ListaEnvioModalProps {
    isOpen: boolean;
    cart: Fragility[];
    editIdx: number | null;
    onEdit: (idx: number) => void;
    onBack: () => void;
    onClose: () => void;
    onRemove: (idx: number) => void;
    onSaveEdit: (newData: Partial<Fragility>) => void;
    onSubmit: () => void;
    isSubmitting: boolean;
}

// Revisão da lista para envio: sai da lateral do formulário (layoutId compartilhado com o
// <aside> do ActionForm) e ocupa a tela. Editar troca de aba dentro da mesma janela.
export function ListaEnvioModal({ isOpen, cart, editIdx, onEdit, onBack, onClose, onRemove, onSaveEdit, onSubmit, isSubmitting }: ListaEnvioModalProps) {
    const editando = editIdx !== null && cart[editIdx] ? cart[editIdx] : null;

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape' || isSubmitting) return;
            if (editando) onBack(); else onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, editando, isSubmitting, onBack, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div key="lista-envio-modal" className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-8">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={isSubmitting ? undefined : onClose}
                        className="absolute inset-0 bg-[rgba(15,23,42,0.55)]"
                    />
                    <motion.section
                        layoutId="lista-envio"
                        role="dialog"
                        aria-modal="true"
                        aria-label={editando ? `Editar item ${editIdx! + 1}` : 'Lista para envio'}
                        transition={{ type: 'spring', stiffness: 260, damping: 32 }}
                        style={{ borderRadius: 8 }}
                        className="relative w-full max-w-5xl h-full max-h-[880px] bg-white border border-rule shadow-[0_24px_64px_rgba(0,10,25,0.35)] flex flex-col overflow-hidden text-left"
                    >
                        <motion.header layout="position" className="flex items-center gap-3 px-5 sm:px-8 py-4 border-b-2 border-uems-gold shrink-0">
                            {editando && (
                                <button type="button" onClick={onBack} className="h-9 -ml-2 px-2.5 rounded-md text-[13px] font-semibold flex items-center gap-1.5 text-uems-blue hover:bg-seal-aguardando-bg transition-colors">
                                    <ArrowLeft className="w-4 h-4" /> Lista
                                </button>
                            )}
                            <h2 className="flex-1 min-w-0 font-serif-boletim italic text-lg sm:text-xl font-semibold text-uems-dark truncate">
                                {editando ? `Editando item ${editIdx! + 1}` : 'Lista para envio'}
                            </h2>
                            {!editando && (
                                <span className="font-mono text-xs font-medium text-uems-blue bg-seal-aguardando-bg px-2 py-0.5 rounded-full">{cart.length}</span>
                            )}
                            <button type="button" onClick={onClose} disabled={isSubmitting} aria-label="Fechar" className="w-10 h-10 -mr-2 flex items-center justify-center rounded-md text-ink-muted hover:bg-slate-100 hover:text-ink transition-colors disabled:opacity-50">
                                <X className="w-5 h-5" />
                            </button>
                        </motion.header>

                        <AnimatePresence mode="wait" initial={false}>
                            {editando ? (
                                <motion.div
                                    key={`editar-${editIdx}`}
                                    initial={{ opacity: 0, x: 40 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 40 }}
                                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                    className="flex-1 min-h-0 overflow-y-auto"
                                >
                                    <EditForm item={editando} onSave={onSaveEdit} onCancel={onBack} cancelText="Voltar à lista" saveText="Salvar alterações" mostrarConcluiu={false} />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="lista"
                                    initial={{ opacity: 0, x: -40 }}
                                    animate={{ opacity: 1, x: 0, transition: { duration: 0.2, delay: 0.08, ease: [0.16, 1, 0.3, 1] } }}
                                    exit={{ opacity: 0, x: -40, transition: { duration: 0.15 } }}
                                    className="flex-1 min-h-0 flex flex-col"
                                >
                                    <ul className="flex-1 min-h-0 overflow-y-auto bg-paper px-3 sm:px-6 py-4 flex flex-col gap-3">
                                        {cart.map((item, idx) => {
                                            const nResp = parseResponsaveis(item.responsavel).filter(r => r.nome.trim()).length;
                                            return (
                                                <li key={idx} className="bg-white border border-rule rounded-md flex items-start gap-1 pl-5 pr-2 py-4">
                                                    <span className="font-mono text-xs text-ink-muted pt-0.5 w-6 shrink-0">{String(idx + 1).padStart(2, '0')}</span>
                                                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                                                        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{item.tipo} · {item.ano}</span>
                                                        <span className="text-[15px] font-semibold leading-snug text-ink">{item.fragilidade}</span>
                                                        <span className="text-sm text-ink-muted leading-relaxed line-clamp-2">{item.acao}</span>
                                                        <span className="text-xs text-ink-muted">Prazo {dataBR(item.prazo)} · {nResp} {nResp === 1 ? 'responsável' : 'responsáveis'}</span>
                                                    </div>
                                                    <button type="button" onClick={() => onEdit(idx)} disabled={isSubmitting} aria-label={`Editar item ${idx + 1}`} className="w-11 h-11 shrink-0 flex items-center justify-center rounded-md text-ink-muted hover:bg-slate-100 hover:text-ink transition-colors disabled:opacity-50">
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button type="button" onClick={() => onRemove(idx)} disabled={isSubmitting} aria-label={`Remover item ${idx + 1}`} className="w-11 h-11 shrink-0 flex items-center justify-center rounded-md text-ink-muted hover:bg-seal-nao-executada-bg hover:text-seal-nao-executada transition-colors disabled:opacity-50">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </li>
                                            );
                                        })}
                                        {cart.length === 0 && (
                                            <li className="flex flex-col items-center justify-center py-10 text-ink-muted">
                                                <Send className="w-6 h-6 mb-2 opacity-40" />
                                                <p className="text-sm font-medium">Sua lista está vazia.</p>
                                            </li>
                                        )}
                                    </ul>
                                    <footer className="shrink-0 border-t border-rule px-5 sm:px-8 py-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                                        <p className="text-xs text-ink-muted leading-relaxed">Nada é enviado à PROE até você confirmar.</p>
                                        <button
                                            type="button"
                                            onClick={onSubmit}
                                            disabled={cart.length === 0 || isSubmitting}
                                            className="h-11 px-6 rounded-md bg-uems-blue hover:bg-[#002A73] disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                                        >
                                            {isSubmitting
                                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</>
                                                : <><Check className="w-4 h-4" /> Confirmar envio de {cart.length} {cart.length === 1 ? 'item' : 'itens'}</>}
                                        </button>
                                    </footer>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.section>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
