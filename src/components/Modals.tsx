import React from 'react';
import { X, Check, Trash2, AlertTriangle, SearchX, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Tom = 'sucesso' | 'aviso' | 'erro' | 'perigo';

const TONS: Record<Tom, { fundo: string; cor: string }> = {
    sucesso: { fundo: 'bg-seal-concluida-bg ring-seal-concluida-bg/50', cor: 'text-seal-concluida' },
    aviso: { fundo: 'bg-seal-pendente-bg ring-seal-pendente-bg/50', cor: 'text-seal-pendente' },
    erro: { fundo: 'bg-seal-nao-executada-bg ring-seal-nao-executada-bg/50', cor: 'text-seal-nao-executada' },
    perigo: { fundo: 'bg-seal-nao-executada-bg ring-seal-nao-executada-bg/50', cor: 'text-seal-nao-executada' },
};

const BTN_PRIMARIO = 'flex-1 h-11 rounded-md bg-uems-blue hover:bg-[#002A73] text-white text-sm font-semibold transition-colors disabled:opacity-60';
const BTN_SECUNDARIO = 'flex-1 h-11 rounded-md border border-rule text-sm font-semibold text-ink hover:bg-paper transition-colors disabled:opacity-60';
const BTN_PERIGO = 'flex-1 h-11 rounded-md bg-seal-nao-executada hover:bg-[#74262F] text-white text-sm font-semibold transition-colors disabled:opacity-60';

interface DialogoProps {
    isOpen: boolean;
    onClose: () => void;
    tom: Tom;
    icone: React.ReactNode;
    title: string;
    message: React.ReactNode;
    children: React.ReactNode; // botões
    bloqueado?: boolean;       // enquanto processa: sem Esc, sem clique fora, sem X
    zIndex?: string;
}

// Base das janelas centrais (alerta, exclusão, sucesso): selo com ícone, título serif e ações.
function Dialogo({ isOpen, onClose, tom, icone, title, message, children, bloqueado = false, zIndex = 'z-[100]' }: DialogoProps) {
    React.useEffect(() => {
        if (!isOpen || bloqueado) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, bloqueado, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={bloqueado ? undefined : onClose}
                    className={`fixed inset-0 ${zIndex} bg-[rgba(0,21,41,0.6)] flex items-center justify-center p-4`}
                >
                    <motion.div
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="dialogo-titulo"
                        aria-describedby="dialogo-msg"
                        onClick={e => e.stopPropagation()}
                        initial={{ opacity: 0, scale: 0.94, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 8 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                        className="gold-rule relative bg-white rounded-lg shadow-[0_24px_64px_rgba(0,10,25,0.4)] w-full max-w-md px-8 pt-10 pb-7 flex flex-col items-center text-center"
                    >
                        <button onClick={onClose} disabled={bloqueado} aria-label="Fechar" className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center rounded-md text-ink-muted hover:bg-slate-100 hover:text-ink transition-colors disabled:opacity-40">
                            <X className="w-5 h-5" />
                        </button>

                        <motion.div
                            initial={{ scale: 0.6, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.05 }}
                            className={`w-[72px] h-[72px] rounded-full ring-8 flex items-center justify-center ${TONS[tom].fundo} ${TONS[tom].cor}`}
                        >
                            {icone}
                        </motion.div>

                        <h3 id="dialogo-titulo" className="mt-6 font-serif-boletim italic text-2xl font-semibold text-uems-dark">{title}</h3>
                        <div id="dialogo-msg" className="mt-2 text-[15px] text-ink-muted leading-relaxed max-w-xs">{message}</div>

                        <div className="mt-8 w-full flex flex-col-reverse sm:flex-row gap-3">{children}</div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export interface AlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    tom?: 'aviso' | 'erro';
}

export function AlertModal({ isOpen, onClose, title, message, tom }: AlertModalProps) {
    const t = tom ?? (/^erro/i.test(title) ? 'erro' : 'aviso');
    return (
        <Dialogo
            isOpen={isOpen}
            onClose={onClose}
            tom={t}
            icone={t === 'erro' ? <XCircle className="w-9 h-9" strokeWidth={2} /> : <AlertTriangle className="w-9 h-9" strokeWidth={2} />}
            title={title}
            message={message}
        >
            <button onClick={onClose} autoFocus className={BTN_PRIMARIO}>Entendi</button>
        </Dialogo>
    );
}

export interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText: string;
    isProcessing?: boolean;
    detalhe?: string; // ex.: texto do registro que será excluído
}

export function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText, isProcessing, detalhe }: ConfirmModalProps) {
    return (
        <Dialogo
            isOpen={isOpen}
            onClose={onClose}
            tom="perigo"
            icone={<Trash2 className="w-8 h-8" strokeWidth={2} />}
            title={title}
            message={
                <>
                    {detalhe && (
                        <span className="block mb-3 px-4 py-3 rounded-md bg-paper border border-rule text-sm font-semibold text-ink text-left leading-snug line-clamp-3">{detalhe}</span>
                    )}
                    {message}
                </>
            }
            bloqueado={isProcessing}
            zIndex="z-[60]"
        >
            {/* Foco no Cancelar: Enter por engano não exclui. */}
            <button onClick={onClose} disabled={isProcessing} autoFocus className={BTN_SECUNDARIO}>Cancelar</button>
            <button onClick={onConfirm} disabled={isProcessing} className={BTN_PERIGO}>
                {isProcessing ? 'Excluindo…' : confirmText}
            </button>
        </Dialogo>
    );
}

export interface MissingCoursesModalProps {
    isOpen: boolean;
    onClose: () => void;
    missingCourses: string[];
}

export function MissingCoursesModal({ isOpen, onClose, missingCourses }: MissingCoursesModalProps) {
    const parsed = missingCourses.map(c => {
        const parts = c.split('||');
        return parts.length > 1 ? parts[1] : c;
    }).sort((a, b) => a.localeCompare(b));

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="fixed inset-0 z-[80] bg-[rgba(15,23,42,0.5)] flex items-center justify-center p-4"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 8 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className="gold-rule bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
                    >
                        <header className="border-b border-slate-100 px-6 py-5 flex items-center justify-between bg-white z-10 sticky top-0">
                            <h3 className="font-serif-boletim italic text-base font-semibold text-slate-800 flex items-center gap-2">
                                <SearchX className="w-5 h-5 text-amber-500" />
                                Cursos Não Avaliados
                            </h3>
                            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </header>

                        <div className="p-6 overflow-y-auto space-y-2 flex-1 bg-slate-50 no-scrollbar">
                            {parsed.length > 0 ? (
                                parsed.map((c, idx) => (
                                    <div key={idx} className="p-3 border border-slate-200 bg-white rounded-md flex items-center text-sm shadow-sm">
                                        <span className="font-medium text-slate-700">{c}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                                    <Check className="w-6 h-6 text-slate-300 mb-2" />
                                    <p className="text-sm font-medium text-center">Todos os cursos registraram fragilidades<br/>para este filtro!</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

interface SuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    message: string;
    title?: string;
    actionLabel?: string;
    onAction?: () => void;
}

// Confirmação de envio: check desenhado no selo; não fecha sozinha.
export function SuccessModal({ isOpen, onClose, message, title = 'Enviado', actionLabel, onAction }: SuccessModalProps) {
    return (
        <Dialogo
            isOpen={isOpen}
            onClose={onClose}
            tom="sucesso"
            icone={
                <svg viewBox="0 0 24 24" className="w-9 h-9" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, delay: 0.25, ease: 'easeOut' }} />
                </svg>
            }
            title={title}
            message={message}
        >
            {actionLabel && onAction && (
                <button onClick={onAction} className={BTN_SECUNDARIO}>{actionLabel}</button>
            )}
            <button onClick={onClose} autoFocus className={BTN_PRIMARIO}>Continuar</button>
        </Dialogo>
    );
}
