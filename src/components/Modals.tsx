import React from 'react';
import type { Fragility } from '../types';
import { X, Check, Trash2, Send, AlertTriangle, SearchX, CheckCircle2, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface AlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
}

export function AlertModal({ isOpen, onClose, title, message }: AlertModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="fixed inset-0 z-[100] bg-[rgba(15,23,42,0.5)] flex items-center justify-center p-4"
                >
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.96, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 8 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-sm max-h-[90vh] overflow-y-auto"
                    >
                        <header className="border-b border-slate-100 px-6 py-5 flex items-center justify-between">
                            <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-amber-500" />
                                {title}
                            </h3>
                            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </header>
                        <div className="p-6">
                            <p className="text-sm text-slate-600 mb-6">{message}</p>
                            <button onClick={onClose} className="w-full bg-uems-blue text-white hover:bg-uems-dark rounded-md py-2 px-4 text-sm font-semibold transition-colors">
                                Entendi
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
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
}

export function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText, isProcessing }: ConfirmModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="fixed inset-0 z-[60] bg-[rgba(15,23,42,0.5)] flex items-center justify-center p-4"
                >
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.96, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 8 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-sm max-h-[90vh] overflow-y-auto"
                    >
                        <header className="border-b border-slate-100 px-6 py-5 flex items-center justify-between">
                            <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                                <Trash2 className="w-5 h-5 text-red-500" />
                                {title}
                            </h3>
                            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </header>
                        <div className="p-6">
                            <p className="text-sm text-slate-600 mb-6">{message}</p>
                            <div className="flex gap-3 justify-end">
                                <button onClick={onClose} disabled={isProcessing} className="border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-md py-2 px-4 text-sm font-medium transition-colors disabled:opacity-50">
                                    Cancelar
                                </button>
                                <button onClick={onConfirm} disabled={isProcessing} className="bg-red-600 text-white hover:bg-red-700 rounded-md py-2 px-4 text-sm font-semibold transition-colors disabled:opacity-50">
                                    {isProcessing ? "Processando..." : confirmText}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

interface CartModalProps {
    isOpen: boolean;
    onClose: () => void;
    cart: Fragility[];
    onRemove: (idx: number) => void;
    onEdit: (idx: number, item: Fragility) => void;
    onSubmit: () => void;
    isSubmitting: boolean;
}

export function CartModal({ isOpen, onClose, cart, onRemove, onEdit, onSubmit, isSubmitting }: CartModalProps) {
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
                        className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
                    >
                        <header className="border-b border-slate-100 px-6 py-5 flex items-center justify-between bg-white z-10 sticky top-0">
                            <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                                <Send className="w-5 h-5 text-uems-blue" />
                                Itens para Enviar
                            </h3>
                            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </header>
                        
                        <div className="p-6 overflow-y-auto space-y-3 flex-1 bg-slate-50 no-scrollbar">
                            {cart.map((item, idx) => (
                                <div key={idx} className="p-4 border border-slate-200 bg-white rounded-md flex justify-between items-center text-sm shadow-sm group">
                                    <div className="flex-1 truncate pr-4">
                                        <span className="font-semibold text-slate-400 mr-2">[{item.ano}]</span>
                                        <span className="font-medium text-slate-900 mr-2">{item.curso}</span>
                                        <span className="text-slate-600 font-normal">— {item.fragilidade.length > 50 ? item.fragilidade.substring(0, 50) + '...' : item.fragilidade}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => onEdit(idx, item)} className="text-slate-400 hover:text-slate-700 bg-transparent p-2 rounded-md transition-colors" title="Editar">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => onRemove(idx)} className="text-slate-400 hover:text-red-600 bg-transparent p-2 rounded-md transition-colors" title="Excluir">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {cart.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                                    <Send className="w-6 h-6 text-slate-300 mb-2" />
                                    <p className="text-sm font-medium">Sua lista de revisão está vazia.</p>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-white z-10 sticky bottom-0">
                            <button 
                                onClick={onSubmit} 
                                disabled={cart.length === 0 || isSubmitting}
                                className="w-full bg-uems-blue text-white hover:bg-uems-dark rounded-md py-3 px-4 text-sm font-semibold transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                            >
                                {isSubmitting ? (
                                    <span>Sincronizando com a Nuvem...</span>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" /> 
                                        Confirmar envio
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
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
                        className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
                    >
                        <header className="border-b border-slate-100 px-6 py-5 flex items-center justify-between bg-white z-10 sticky top-0">
                            <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
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
}

export function SuccessModal({ isOpen, onClose, message }: SuccessModalProps) {
    React.useEffect(() => {
        if (!isOpen) return;
        const t = setTimeout(onClose, 2500);
        return () => clearTimeout(t);
    }, [isOpen, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="fixed inset-0 z-[100] bg-[rgba(15,23,42,0.5)] flex items-center justify-center p-4"
                >
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.96, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 8 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-sm max-h-[90vh] overflow-y-auto"
                    >
                        <header className="border-b border-slate-100 px-6 py-5 flex items-center justify-between">
                            <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                Sucesso
                            </h3>
                            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </header>
                        <div className="p-6">
                            <p className="text-sm text-slate-600 mb-6">{message}</p>
                            <button onClick={onClose} className="w-full bg-uems-blue text-white hover:bg-uems-dark rounded-md py-2 px-4 text-sm font-semibold transition-colors">
                                Fechar
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
