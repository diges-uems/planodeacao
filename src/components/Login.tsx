import React, { useState, useRef } from 'react';
import { LogIn, Eye, EyeOff, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { login } from '../lib/api';
import type { User } from '../types';

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
        <div className="flex items-center justify-center w-full min-h-screen relative overflow-hidden">
            <img 
                src="https://www.uems.br/anexos/imagens/conteudo/uems_imagens_2023-09-22_13-02-19.png" 
                className="absolute inset-0 w-full h-full object-cover" 
                alt="Fundo UEMS" 
            />
            <div 
                className="absolute inset-0"
                style={{ background: 'linear-gradient(to right, rgba(0, 31, 77, 0.92) 0%, rgba(0, 51, 140, 0.80) 50%, rgba(0, 51, 140, 0.40) 100%)' }}
            ></div>
            
            <div className="absolute top-8 left-8 md:top-12 md:left-12 z-20 flex items-center gap-2">
                <span className="bg-uems-blue/80 border border-white/20 text-white px-5 py-2 rounded text-xs font-semibold tracking-wide">
                    UEMS • PROE
                </span>
            </div>

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between w-full max-w-7xl px-6 md:px-12 gap-12 text-left">
                <div className="text-white w-full max-w-2xl mb-8 md:mb-0">
                    <span className="text-blue-200 font-semibold tracking-wide uppercase text-xs md:text-sm mb-4 block">
                        Gestão Estratégica Institucional
                    </span>
                    <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
                        Plano de Ação<br/><span className="text-blue-100">dos Cursos</span>
                    </h1>
                    <p className="text-lg md:text-xl text-slate-200 font-medium opacity-95 leading-relaxed max-w-lg">
                        Matriz de mitigação de fragilidades organizada por curso, unidade acadêmica e código.
                    </p>
                </div>

                <div 
                    className="relative p-8 w-full max-w-md bg-white border border-slate-200/80 shadow-lg rounded-lg"
                >
                    <h3 className="text-slate-800 text-lg font-semibold mb-6 text-center">Acesso ao Sistema</h3>
                    
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
                            className="w-full py-3 bg-uems-blue hover:bg-uems-dark text-white font-semibold text-sm rounded-md transition-colors flex justify-center items-center gap-2 disabled:opacity-70"
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
    );
}
