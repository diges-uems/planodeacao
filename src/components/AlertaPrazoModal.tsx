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

const TEXTO_PADRAO = (prazo: string) =>
    `O prazo para cadastro de fragilidades e planos de ação do seu curso no sistema está se encerrando${prazo ? ' em ' + prazo : ''}. Acesse o sistema o quanto antes para concluir o preenchimento.`;

export function AlertaPrazoModal({ isOpen, onClose, unidades, onSend, isProcessing }: AlertaPrazoModalProps) {
    const [step, setStep] = useState<'form' | 'preview'>('form');
    const [unidade, setUnidade] = useState('');
    const [prazo, setPrazo] = useState('');
    const [mensagem, setMensagem] = useState('');

    useEffect(() => {
        if (isOpen) {
            setStep('form');
            setUnidade(unidades[0] || '');
            setPrazo('');
            setMensagem('');
        }
    }, [isOpen, unidades]);

    const handleAvancarPreview = (e: React.FormEvent) => {
        e.preventDefault();
        if (!unidade) return;
        setStep('preview');
    };

    const handleConfirmarEnvio = async () => {
        await onSend(unidade, prazo.trim(), mensagem.trim());
    };

    const introducaoPreview = mensagem.trim() || TEXTO_PADRAO(prazo.trim());

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

                        {step === 'form' && (
                            <form onSubmit={handleAvancarPreview} className="p-6 space-y-5">
                                <p className="text-xs text-slate-500">
                                    Envia um e-mail para todos os cursos da unidade selecionada (com cópia para enade@uems.br), usando o e-mail cadastrado de cada curso na aba CURSOS. Cursos sem e-mail cadastrado não recebem o alerta (fica registrado no log).
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
                                        Ver Preview
                                    </button>
                                </div>
                            </form>
                        )}

                        {step === 'preview' && (
                            <div className="p-6 space-y-5">
                                <p className="text-xs text-slate-500">
                                    Pré-visualização do e-mail que será enviado (o conteúdo real usa o nome de cada curso). Cópia vai para <strong>enade@uems.br</strong>.
                                </p>

                                <div className="border border-slate-200 rounded-lg overflow-hidden">
                                    <div style={{ background: 'linear-gradient(135deg, #00338C 0%, #001f4d 100%)', padding: '24px', textAlign: 'center' }}>
                                        <div style={{ color: '#C8A84B', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 500 }}>Pró-Reitoria de Ensino</div>
                                        <div style={{ color: '#C8A84B', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 500, marginTop: '4px' }}>Plano de Ação</div>
                                    </div>
                                    <div style={{ height: '3px', background: '#C8A84B' }} />
                                    <div style={{ padding: '24px', background: '#fff' }}>
                                        <h4 style={{ fontSize: '18px', color: '#001f4d', fontWeight: 600, margin: '0 0 12px 0' }}>Prazo de Cadastro se Encerrando</h4>
                                        <p style={{ fontSize: '13px', lineHeight: 1.7, color: '#333', margin: '0 0 16px 0', fontWeight: 300 }}>{introducaoPreview}</p>
                                        <div style={{ background: '#F4F6FA', borderLeft: '4px solid #00338C', borderRadius: '8px', padding: '14px 16px' }}>
                                            <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#00338C', marginBottom: '4px' }}>Curso</div>
                                            <div style={{ fontSize: '13px', color: '#333', marginBottom: '10px' }}>{'{nome do curso}'} - {unidade}</div>
                                            {prazo.trim() && (
                                                <>
                                                    <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#00338C', marginBottom: '4px' }}>Prazo Final</div>
                                                    <div style={{ fontSize: '13px', color: '#333' }}>{prazo}</div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                    <button type="button" onClick={() => setStep('form')} disabled={isProcessing} className="border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-md py-2 px-4 text-sm font-medium transition-colors disabled:opacity-50">
                                        Voltar e Editar
                                    </button>
                                    <button type="button" onClick={handleConfirmarEnvio} disabled={isProcessing} className="bg-uems-blue text-white hover:bg-uems-dark rounded-md py-2 px-4 text-sm font-semibold transition-colors disabled:opacity-50">
                                        {isProcessing ? 'Enviando...' : 'Confirmar e Enviar'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
