import React, { useState, useEffect } from 'react';
import type { Fragility, Responsavel } from '../types';
import { DIMENSIONS, SOURCES, OUTRA_FONTE_PREFIXO } from '../lib/constants';
import { formatDateTimeBR, parseResponsaveis, serializeResponsaveis } from '../lib/utils';
import { DatePickerInput } from './DatePickerInput';
import { motion, AnimatePresence } from 'motion/react';

interface EditModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: Fragility | null;
    onSave: (newData: Partial<Fragility>) => Promise<void>;
    isProcessing: boolean;
}

export function EditModal({ isOpen, onClose, item, onSave, isProcessing }: EditModalProps) {
    const [formData, setFormData] = useState<Partial<Fragility>>({});
    const [outraFonteTexto, setOutraFonteTexto] = useState('');
    const [responsaveis, setResponsaveis] = useState<Responsavel[]>([{ nome: '', feito: false }]);

    const handleResponsavelNomeChange = (index: number, nome: string) => {
        setResponsaveis(prev => prev.map((r, i) => i === index ? { ...r, nome } : r));
    };

    const handleResponsavelFeitoChange = (index: number, feito: boolean) => {
        setResponsaveis(prev => prev.map((r, i) => i === index ? { ...r, feito } : r));
    };

    const handleAddResponsavel = () => {
        setResponsaveis(prev => [...prev, { nome: '', feito: false }]);
    };

    const handleRemoveResponsavel = (index: number) => {
        setResponsaveis(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== index));
    };

    const fonteEhOutra = formData.fonte === 'Outra' || formData.fonte?.startsWith(OUTRA_FONTE_PREFIXO);
    const fonteSelectValue = fonteEhOutra ? 'Outra' : (formData.fonte || '');

    useEffect(() => {
        if (item) {
            setFormData({
                tipo: item.tipo,
                fragilidade: item.fragilidade,
                fonte: item.fonte,
                conceito: item.conceito,
                acao: item.acao,
                prazo: item.prazo,
                responsavel: item.responsavel,
                recursos: item.recursos,
                dataReuniao: item.dataReuniao ? formatDateTimeBR(item.dataReuniao) : '',
                minutaReuniao: item.minutaReuniao || ''
            });
            setOutraFonteTexto(item.fonte?.startsWith(OUTRA_FONTE_PREFIXO) ? item.fonte.slice(OUTRA_FONTE_PREFIXO.length) : '');
            const parsed = parseResponsaveis(item.responsavel);
            setResponsaveis(parsed.length > 0 ? parsed : [{ nome: '', feito: false }]);
        }
    }, [item]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleFonteSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value === 'Outra') {
            setFormData(prev => ({ ...prev, fonte: outraFonteTexto ? OUTRA_FONTE_PREFIXO + outraFonteTexto : 'Outra' }));
        } else {
            setOutraFonteTexto('');
            setFormData(prev => ({ ...prev, fonte: value }));
        }
    };

    const handleOutraFonteTextoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const texto = e.target.value;
        setOutraFonteTexto(texto);
        setFormData(prev => ({ ...prev, fonte: OUTRA_FONTE_PREFIXO + texto }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (fonteEhOutra && !outraFonteTexto.trim()) return;
        if (!responsaveis.some(r => r.nome.trim())) return;
        await onSave({ ...formData, responsavel: serializeResponsaveis(responsaveis) });
    };

    return (
        <AnimatePresence>
            {isOpen && item && (
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
                        className="gold-rule bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto text-left"
                    >
                        <header className="border-b border-slate-100 px-6 py-5 flex items-center justify-between sticky top-0 bg-white z-10">
                            <h3 className="font-serif-boletim italic text-base font-semibold text-slate-800">
                                Editar Registro
                            </h3>
                            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                                ✕
                            </button>
                        </header>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label>Dimensão</label>
                                    <select name="tipo" value={formData.tipo || ''} onChange={handleChange} className="input-uems" required>
                                        <option value="">Selecione...</option>
                                        {DIMENSIONS.map(dim => <option key={dim} value={dim}>{dim}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label>Fonte</label>
                                    <select name="fonte" value={fonteSelectValue} onChange={handleFonteSelectChange} className="input-uems" required>
                                        <option value="">Selecione...</option>
                                        {SOURCES.map(source => <option key={source} value={source}>{source}</option>)}
                                    </select>
                                    {fonteEhOutra && (
                                        <input
                                            type="text"
                                            value={outraFonteTexto}
                                            onChange={handleOutraFonteTextoChange}
                                            required
                                            className="input-uems mt-2"
                                            placeholder="Descreva a fonte identificadora"
                                        />
                                    )}
                                </div>
                            </div>
                            <div>
                                <label>Descrição</label>
                                <textarea name="fragilidade" value={formData.fragilidade || ''} onChange={handleChange} rows={2} className="input-uems" required></textarea>
                            </div>
                            <div>
                                <label>Ação Prática</label>
                                <textarea name="acao" value={formData.acao || ''} onChange={handleChange} rows={2} className="input-uems" required></textarea>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label>Conceito</label>
                                    <input type="text" name="conceito" value={formData.conceito || ''} onChange={handleChange} className="input-uems" required />
                                </div>
                                <div>
                                    <label>Data Final</label>
                                    <DatePickerInput 
                                        name="prazo"
                                        value={formData.prazo || ''}
                                        onChange={handleChange}
                                        className="input-uems"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label>Responsável(is)</label>
                                    <div className="space-y-2">
                                        {responsaveis.map((r, index) => (
                                            <div key={index} className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={r.nome}
                                                    onChange={(e) => handleResponsavelNomeChange(index, e.target.value)}
                                                    required={index === 0}
                                                    className="input-uems flex-1"
                                                />
                                                <label className="flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap">
                                                    <input
                                                        type="checkbox"
                                                        checked={r.feito}
                                                        onChange={(e) => handleResponsavelFeitoChange(index, e.target.checked)}
                                                    />
                                                    Concluiu
                                                </label>
                                                {responsaveis.length > 1 && (
                                                    <button type="button" onClick={() => handleRemoveResponsavel(index)} className="text-slate-400 hover:text-red-500 bg-transparent hover:bg-transparent px-1">
                                                        ✕
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        <button type="button" onClick={handleAddResponsavel} className="text-xs font-semibold text-uems-blue hover:text-uems-dark bg-transparent hover:bg-transparent px-0">
                                            + Adicionar responsável
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label>Recursos</label>
                                    <input type="text" name="recursos" value={formData.recursos || ''} onChange={handleChange} className="input-uems" required />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label>Data de Reunião</label>
                                    <input type="text" name="dataReuniao" value={formData.dataReuniao || ''} onChange={handleChange} className="input-uems" required />
                                </div>
                                <div>
                                    <label>Minuta</label>
                                    <input type="text" name="minutaReuniao" value={formData.minutaReuniao || ''} onChange={handleChange} className="input-uems" required />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                                <button type="button" onClick={onClose} disabled={isProcessing} className="border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-md py-2 px-4 text-sm font-medium transition-colors disabled:opacity-50">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={isProcessing} className="bg-uems-blue text-white hover:bg-uems-dark rounded-md py-2 px-4 text-sm font-semibold transition-colors disabled:opacity-50">
                                    {isProcessing ? 'Salvando...' : 'Salvar Edição'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
