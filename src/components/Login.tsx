import React, { useState, useRef } from 'react';
import { LogIn, Eye, EyeOff, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { login } from '../lib/api';
import type { User } from '../types';
import uemsProeLogo from '../assets/uems-proe-logo.png';

interface LoginProps {
    onLogin: (user: User) => void;
}

export function Login({ onLogin }: LoginProps) {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('Senha incorreta.');
    const [isCapsOn, setIsCapsOn] = useState(false);
    const passwordRef = useRef<HTMLInputElement>(null);

    const handleLogin = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        
        const pwd = password.trim();
        if (!pwd) {
            setError(true);
            setErrorMessage('Digite uma senha.');
            return;
        }

        setIsLoading(true);
        setError(false);

        const result = await login(pwd);

        setIsLoading(false);

        if (result.success) {
            onLogin({ 
                role: result.role, 
                courseId: result.courseId, 
                courseName: result.courseName,
                courses: result.courses,
                emailRegistrado: result.emailRegistrado,
                podeEditar: result.podeEditar
            });
        } else {
            setError(true);
            setErrorMessage(result.message || 'Senha incorreta.');
        }
    };

    return (
        <div className="flex items-center justify-center w-full min-h-screen relative overflow-hidden p-4 md:p-8">
            <img
                src="https://www.uems.br/anexos/imagens/conteudo/uems_imagens_2023-09-22_13-02-19.png"
                className="absolute inset-0 w-full h-full object-cover"
                alt="Fundo UEMS"
            />
            <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(to right, rgba(0, 21, 41, 0.94) 0%, rgba(0, 31, 77, 0.86) 45%, rgba(0, 51, 140, 0.45) 100%)' }}
            ></div>

            {/* Moldura tipo certificado, cantos de brasão */}
            <div className="pointer-events-none absolute inset-3 md:inset-6 border border-uems-gold/30 z-10" aria-hidden="true">
                <span className="absolute -top-px -left-px w-6 h-6 border-t-2 border-l-2 border-uems-gold"></span>
                <span className="absolute -top-px -right-px w-6 h-6 border-t-2 border-r-2 border-uems-gold"></span>
                <span className="absolute -bottom-px -left-px w-6 h-6 border-b-2 border-l-2 border-uems-gold"></span>
                <span className="absolute -bottom-px -right-px w-6 h-6 border-b-2 border-r-2 border-uems-gold"></span>
            </div>

            <div className="absolute top-12 left-12 md:top-16 md:left-16 z-20">
                <img src={uemsProeLogo} alt="UEMS PROE" className="h-16 md:h-20 w-auto" />
            </div>

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between w-full max-w-7xl px-6 md:px-12 gap-12 text-left">
                <div className="text-white w-full max-w-2xl mb-8 md:mb-0">
                    <span className="text-uems-gold font-serif-boletim italic tracking-wide text-sm md:text-base mb-4 block">
                        Gestão Estratégica Institucional
                    </span>
                    <h1 className="font-serif-boletim text-4xl md:text-6xl font-semibold tracking-tight mb-6 leading-[1.08]">
                        Plano de Ação<br/><span className="text-blue-100/90">dos Cursos</span>
                    </h1>
                    <div className="h-px w-24 bg-uems-gold mb-6"></div>
                    <p className="text-base md:text-lg text-slate-200 font-normal opacity-95 leading-relaxed max-w-lg">
                        Matriz de mitigação de fragilidades organizada por curso, unidade acadêmica e código.
                    </p>
                </div>

                <div className="relative w-full max-w-md">
                    <div className="gold-rule bg-white border border-slate-200/80 shadow-2xl rounded-sm pt-7 px-8 pb-8">
                        <h3 className="font-serif-boletim italic text-uems-dark text-xl font-semibold mb-6 text-center">Acesso ao Sistema</h3>

                        <form onSubmit={handleLogin} className="space-y-5">
                            <div className="relative group">
                                <input
                                    ref={passwordRef}
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        setError(false);
                                    }}
                                    onKeyUp={(e) => {
                                        if (e.getModifierState('CapsLock')) {
                                            setIsCapsOn(true);
                                        } else {
                                            setIsCapsOn(false);
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.getModifierState('CapsLock')) {
                                            setIsCapsOn(true);
                                        } else {
                                            setIsCapsOn(false);
                                        }
                                    }}
                                    disabled={isLoading}
                                    className="input-uems pr-12 text-left text-sm font-normal focus:border-uems-blue focus:ring-2 focus:ring-uems-blue/10"
                                    placeholder="Senha..."
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    disabled={isLoading}
                                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-uems-blue transition-colors focus:outline-none disabled:opacity-50"
                                    title="Mostrar Senha"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>

                            {isCapsOn && (
                                <p className="text-amber-600 text-xs font-medium text-center flex items-center justify-center gap-1 -mt-3 mb-1">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    Caps Lock ativado
                                </p>
                            )}

                            {error && (
                                <div className="animate-shake">
                                    <p className="text-red-600 text-xs font-medium text-center py-2 px-3 rounded-md flex items-center justify-center gap-2 bg-red-50 border border-red-200">
                                        <XCircle className="w-4 h-4 shrink-0" />
                                        <span>{errorMessage}</span>
                                    </p>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-3 bg-uems-blue hover:bg-uems-dark text-white font-semibold text-sm rounded-sm transition-colors flex justify-center items-center gap-2 disabled:opacity-70"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>Autenticando...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Entrar no Portal</span>
                                        <LogIn className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
