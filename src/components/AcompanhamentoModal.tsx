import React, { useState } from 'react';
import type { Fragility, User, Acompanhamento, StatusAcompanhamento } from '../types';
import { ClipboardCheck, X } from 'lucide-react';
import { formatDateTimeBR } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface AcompanhamentoModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: Fragility | null;
    currentUser: User;
    onSave: (acompanhamento: Acompanhamento) => Promise<void>;
    isProcessing: boolean;
}

const STATUS_OPTIONS: StatusAcompanhamento[] = [
    'Em Andamento',
    'Concluída',
    'Não Concluída',
    'Suspensa'
];

export function AcompanhamentoModal({ isOpen, onClose, item, currentUser, onSave, isProcessing }: AcompanhamentoModalProps) {
    const [status, setStatus] = useState<StatusAcompanhamento>('Em Andamento');
    const [descricao, setDescricao] = useState('');
    const [registradoPor, setRegistradoPor] = useState(currentUser.role === 'reitoria' ? 'PROE' : (currentUser.courseName || ''));

    if (!isOpen || !item) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSave({
            dataRegistro: new Date().toISOString(),
            status,
            descricao,
            registradoPor
        });
        setDescricao('');
        setStatus('Em Andamento');
    };

    const getStatusColor = (s: string) => {
        switch (s) {
            case 'Em Andamento': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'Concluída': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'Não Concluída': return 'bg-red-100 text-red-700 border-red-200';
            case 'Suspensa': return 'bg-amber-100 text-amber-700 border-amber-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const acompanhamentos = [...(item.acompanhamentos || [])].reverse();

    return (
        <AnimatePresence>
            {isOpen && item && (
                <div className="fixed inset-0 z-[70] bg-slate-900/50 flex items-center justify-center p-4 sm:p-6">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.96, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 8 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 sm:p-10 no-scrollbar text-left"
                    >
                        <header className="mb-8 border-b border-slate-100 pb-6 flex items-center justify-between sticky top-0 bg-white z-10 -mt-2 pt-2">
                    <h3 className="text-xl font-semibold text-slate-900 flex items-center gap-3">
                        <span className="w-10 h-10 rounded-lg bg-blue-50 text-uems-blue flex items-center justify-center shadow-inner">
                            <ClipboardCheck className="w-5 h-5" />
                        </span>
                        Acompanhamento
                    </h3>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </header>

                <div className="space-y-8">
                    {/* Histórico */}
                    <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-4">Histórico</h4>
                        {acompanhamentos.length > 0 ? (
                            <div className="space-y-4">
                                {acompanhamentos.map((acomp, idx) => (
                                    <div key={idx} className="p-4 rounded-lg bg-slate-50 border border-slate-100 shadow-sm flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-semibold border uppercase tracking-wide ${getStatusColor(acomp.status)}`}>
                                                {acomp.status}
                                            </span>
                                            <span className="text-xs font-bold text-slate-400">
                                                {formatDateTimeBR(acomp.dataRegistro)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-700 font-medium">
                                            {acomp.descricao}
                                        </p>
                                        <span className="text-[10px] font-bold text-slate-400 mt-1">
                                            Registrado por: {acomp.registradoPor}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-6 text-center bg-slate-50 border border-slate-100 rounded-lg text-slate-400 font-medium text-sm">
                                Nenhum acompanhamento registrado ainda.
                            </div>
                        )}
                    </div>

                    {/* Formulário */}
                    <form onSubmit={handleSubmit} className="bg-slate-50 p-6 rounded-lg border border-slate-200 space-y-5">
                        <h4 className="text-sm font-semibold text-slate-800 mb-2">Novo Acompanhamento</h4>
                        
                        <div>
                            <label>Status</label>
                            <select 
                                value={status} 
                                onChange={(e) => setStatus(e.target.value as StatusAcompanhamento)} 
                                className="input-uems font-bold" 
                                required
                            >
                                {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                        
                        <div>
                            <label>Descrição / Atualização</label>
                            <textarea 
                                value={descricao} 
                                onChange={(e) => setDescricao(e.target.value)} 
                                rows={3} 
                                className="input-uems font-medium" 
                                placeholder="Descreva o andamento, o que foi feito, por que não foi possível concluir..."
                                required
                            />
                        </div>

                        <div>
                            <label>Registrado por</label>
                            <input 
                                type="text"
                                value={registradoPor} 
                                onChange={(e) => setRegistradoPor(e.target.value)} 
                                className="input-uems font-bold" 
                                required
                            />
                        </div>

                        <button 
                            type="submit" 
                            disabled={isProcessing} 
                            className="w-full py-4 bg-uems-blue hover:bg-uems-dark text-white font-semibold text-sm rounded-md transition-colors disabled:opacity-50"
                        >
                            {isProcessing ? 'Registrando...' : 'Registrar Atualização'}
                        </button>
                    </form>
                </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
