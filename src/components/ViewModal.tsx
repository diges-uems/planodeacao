import React from 'react';
import { Fragility } from '../types';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { parseResponsaveis } from '../lib/utils';

interface ViewModalProps {
    item: Fragility;
    onClose: () => void;
}

export function ViewModal({ item, onClose }: ViewModalProps) {
    const isISODate = (val: string) => /^\d{4}-\d{2}-\d{2}$/.test(val);
    const prazoDisplay = isISODate(item.prazo || '') ? (item.prazo || '').split('-').reverse().join('/') : item.prazo;
    const dataReuniaoDisplay = isISODate(item.dataReuniao || '') ? (item.dataReuniao || '').split('-').reverse().join('/') : item.dataReuniao;

    return (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="gold-rule bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-[800px] max-h-[90vh] flex flex-col"
            >
                <div className="flex justify-between items-center border-b border-slate-100 px-6 py-5 shrink-0">
                    <h2 className="font-serif-boletim italic text-base font-semibold text-slate-800 flex items-center gap-2">
                        {item.id && (
                            <span className="font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded text-sm">
                                #{item.id}
                            </span>
                        )}
                        Detalhes do Registro
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    <div className="space-y-6">
                        {/* Seção Principal */}
                        <div className="section-group">
                            <h3 className="section-group-title">Identificação</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <span className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Curso</span>
                                    <span className="text-sm text-slate-900">{item.curso}</span>
                                </div>
                                <div>
                                    <span className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Ano Referência</span>
                                    <span className="text-sm font-mono text-slate-700">{item.ano}</span>
                                </div>
                                <div>
                                    <span className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Dimensão</span>
                                    <span className="text-sm text-slate-900">{item.tipo}</span>
                                </div>
                                <div>
                                    <span className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Fonte / Conceito</span>
                                    <span className="text-sm text-slate-900">{item.fonte} {item.conceito ? `- ${item.conceito}` : ''}</span>
                                </div>
                            </div>
                        </div>

                        {/* Seção Fragilidade e Ação */}
                        <div className="section-group">
                            <h3 className="section-group-title">Plano de Ação</h3>
                            <div className="space-y-4">
                                <div>
                                    <span className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Fragilidade</span>
                                    <p className="text-sm text-slate-700 bg-slate-50 p-3 border border-slate-100 rounded-md whitespace-pre-wrap">{item.fragilidade}</p>
                                </div>
                                <div>
                                    <span className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Ação Planejada</span>
                                    <p className="text-sm text-slate-700 bg-slate-50 p-3 border border-slate-100 rounded-md whitespace-pre-wrap">{item.acao}</p>
                                </div>
                            </div>
                        </div>

                        {/* Seção Execução */}
                        <div className="section-group">
                            <h3 className="section-group-title">Execução</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <span className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Prazo Inicial</span>
                                    <span className="text-sm text-slate-900">{prazoDisplay}</span>
                                </div>
                                <div>
                                    <span className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Responsável</span>
                                    <span className="text-sm text-slate-900 space-x-1">
                                        {parseResponsaveis(item.responsavel).map((r, i, arr) => (
                                            <span key={i} className={r.feito ? 'text-emerald-600 font-medium' : ''}>
                                                {r.feito ? `✓ ${r.nome}` : r.nome}{i < arr.length - 1 ? ',' : ''}
                                            </span>
                                        ))}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Recursos Necessários</span>
                                    <span className="text-sm text-slate-900">{item.recursos || '-'}</span>
                                </div>
                                <div>
                                    <span className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Status Atual</span>
                                    <span className="text-sm font-semibold text-uems-blue">{item.statusAtual || 'Pendente'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Acompanhamentos */}
                        <div className="section-group border-l-[3px] border-uems-blue">
                            <h3 className="section-group-title !text-uems-blue">Histórico de Acompanhamentos</h3>
                            
                            {(!item.acompanhamentos || item.acompanhamentos.length === 0) ? (
                                <p className="text-sm text-slate-500 italic">Nenhum acompanhamento registrado.</p>
                            ) : (
                                <div className="space-y-4">
                                    {item.acompanhamentos.map((ac, idx) => {
                                        const novoPrazoDisplay = isISODate(ac.novoPrazo || '') ? (ac.novoPrazo || '').split('-').reverse().join('/') : ac.novoPrazo;
                                        return (
                                            <div key={idx} className="bg-slate-50 border border-slate-200 rounded-md p-4">
                                                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                                    <span className="text-sm font-semibold text-slate-800">{ac.status}</span>
                                                    <span className="text-xs font-mono text-slate-500">{ac.dataRegistro}</span>
                                                </div>
                                                <div className="text-sm text-slate-700 whitespace-pre-wrap mb-3">
                                                    {ac.descricao}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-4 text-xs">
                                                    <span className="text-slate-500">
                                                        <strong className="font-medium text-slate-700">Por:</strong> {ac.registradoPor}
                                                    </span>
                                                    {ac.novoPrazo && (
                                                        <span className="text-slate-500">
                                                            <strong className="font-medium text-slate-700">Novo Prazo:</strong> {novoPrazoDisplay}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="border-t border-slate-100 px-6 py-4 flex justify-end bg-slate-50 shrink-0 rounded-b-lg">
                    <button 
                        onClick={onClose}
                        className="border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-md py-2 px-6 text-sm font-medium"
                    >
                        Fechar
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
