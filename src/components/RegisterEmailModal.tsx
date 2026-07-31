import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Loader2, AlertCircle } from 'lucide-react';

interface RegisterEmailModalProps {
  isOpen: boolean;
  courseName: string;
  onSave: (email: string) => Promise<void>;
  isProcessing: boolean;
}

export function RegisterEmailModal({
  isOpen,
  courseName,
  onSave,
  isProcessing
}: RegisterEmailModalProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const validateEmail = (e: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  };

  const handleSave = async () => {
    if (!email) {
      setError('Por favor, informe o e-mail institucional.');
      return;
    }
    if (!validateEmail(email)) {
      setError('Por favor, informe um e-mail válido.');
      return;
    }
    setError('');
    await onSave(email);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-base font-semibold text-slate-800">Cadastro de E-mail do Curso</h2>
        </div>

        <div className="p-6">
          <div className="mb-6 bg-blue-50/50 border border-blue-100 rounded-md p-4 text-sm text-slate-700">
            <p className="mb-2"><strong>Curso:</strong> {courseName}</p>
            <p>Para receber notificações sobre o Plano de Ação do seu curso, cadastre o e-mail institucional responsável.</p>
          </div>

          <div className="mb-6">
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              E-mail Institucional
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="email"
                className="input-uems w-full"
                style={{ paddingLeft: '2.75rem' }}
                placeholder="curso@uems.br"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                disabled={isProcessing}
              />
            </div>
            {error && (
              <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {error}
              </p>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              onClick={handleSave}
              disabled={!email || isProcessing}
              className="bg-uems-blue text-white hover:bg-uems-dark rounded-md py-2 px-6 text-sm font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
              {isProcessing ? 'Salvando...' : 'Salvar e Continuar'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
