import React, { useState, useEffect } from 'react';
import { X, BellRing } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AlertaPrazoModalProps {
    isOpen: boolean;
    onClose: () => void;
    unidades: string[];
    onSend: (unidade: string, prazo: string, mensagem: string) => Promise<void>;
    isProcessing: boolean;
}

export function AlertaPrazoModal({ isOpen, onClose, unidades, onSend, isProcessing }: AlertaPrazoModalProps) {
    const [unidade, setUnidade] = useState('');
    const [prazo, setPrazo] = useState('');
    const [mensagem, setMensagem] = useState('');

    useEffect(() => {
        if (isOpen) {
            setUnidade(unidades[0] || '');
            setPrazo('');
            setMensagem('');
        }
    }, [isOpen, unidades]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!unidade) return;
        await onSend(unidade, prazo.trim(), mensagem.trim());
    };

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
                        className="gold-rule bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto text-left"
                    >
                        <header className="border-b border-slate-100 px-6 py-5 flex items-center justify-between">
                            <h3 className="font-serif-boletim italic text-base font-semibold text-slate-800 flex items-center gap-2">
                                <BellRing className="w-5 h-5 text-uems-blue" />
                                Alertar Prazo de Cadastro
                            </h3>
                            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </header>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <p className="text-xs text-slate-500">
                                Envia um e-mail para todos os cursos da unidade selecionada, usando o e-mail cadastrado de cada curso na aba CURSOS. Cursos sem e-mail cadastrado não recebem o alerta (fica registrado no log).
                            </p>

                            <div>
                                <label>Unidade</label>
                                <select value={unidade} onChange={(e) => setUnidade(e.target.value)} className="input-uems" required>
                                    <option value="">Selecione...</option>
                                    {unidades.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>

                            <div>
                                <label>Prazo Final (opcional, texto livre)</label>
                                <input
                                    type="text"
                                    value={prazo}
                                    onChange={(e) => setPrazo(e.target.value)}
                                    className="input-uems"
                                    placeholder="Ex: 11/09/2026"
                                />
                            </div>

                            <div>
                                <label>Mensagem (opcional)</label>
                                <textarea
                                    value={mensagem}
                                    onChange={(e) => setMensagem(e.target.value)}
                                    rows={4}
                                    className="input-uems"
                                    placeholder="Deixe em branco para usar o texto padrão do sistema."
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <button type="button" onClick={onClose} disabled={isProcessing} className="border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-md py-2 px-4 text-sm font-medium transition-colors disabled:opacity-50">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={isProcessing || !unidade} className="bg-uems-blue text-white hover:bg-uems-dark rounded-md py-2 px-4 text-sm font-semibold transition-colors disabled:opacity-50">
                                    {isProcessing ? 'Enviando...' : 'Enviar Alerta'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
