import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, XCircle, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { login, aquecerBackend } from '../lib/api';
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

    useEffect(() => { aquecerBackend(); }, []);

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
                podeEditar: result.podeEditar,
                token: result.token
            });
        } else {
            setError(true);
            setErrorMessage(result.message || 'Senha incorreta.');
        }
    };

    const atualizarCaps = (e: React.KeyboardEvent) => setIsCapsOn(e.getModifierState('CapsLock'));

    const titulo = (
        <>
            <span className="font-serif-boletim italic text-sm md:text-base tracking-wide text-uems-gold">Gestão Estratégica Institucional</span>
            <h1 className="font-serif-boletim text-[34px] md:text-6xl font-semibold tracking-tight leading-[1.08] text-white">
                Plano de Ação<br /><span className="text-[#D4E0F2]">dos Cursos</span>
            </h1>
        </>
    );

    return (
        <div className="relative w-full min-h-screen flex flex-col md:flex-row md:items-center overflow-hidden bg-white md:bg-uems-dark">
            {/* Foto: faixa no topo no celular, fundo inteiro no computador */}
            <div className="relative h-[300px] md:h-auto md:absolute md:inset-0 shrink-0 overflow-hidden bg-uems-dark">
                <img src="campus-uems.jpg" alt="" className="absolute inset-0 w-full h-full object-cover object-[50%_45%] md:object-[60%_40%]" />
                <div className="absolute inset-0 md:hidden" style={{ background: 'linear-gradient(180deg, rgba(0,21,41,0.35) 0%, rgba(0,21,41,0.92) 100%)' }} />
                <div className="absolute inset-0 hidden md:block" style={{ background: 'linear-gradient(90deg, rgba(0,21,41,0.95) 0%, rgba(0,31,77,0.86) 46%, rgba(0,31,77,0.35) 78%, rgba(0,21,41,0.2) 100%)' }} />
                <div className="absolute inset-x-0 bottom-0 px-6 pb-7 flex flex-col gap-3 md:hidden">{titulo}</div>
            </div>

            {/* Moldura tipo certificado, cantos de brasão */}
            <div className="pointer-events-none absolute inset-6 border border-uems-gold/35 z-10 hidden md:block" aria-hidden="true">
                <span className="absolute -top-px -left-px w-6 h-6 border-t-2 border-l-2 border-uems-gold"></span>
                <span className="absolute -top-px -right-px w-6 h-6 border-t-2 border-r-2 border-uems-gold"></span>
                <span className="absolute -bottom-px -left-px w-6 h-6 border-b-2 border-l-2 border-uems-gold"></span>
                <span className="absolute -bottom-px -right-px w-6 h-6 border-b-2 border-r-2 border-uems-gold"></span>
            </div>

            <div className="relative z-10 w-full max-w-7xl mx-auto md:px-12 lg:px-32 flex-1 md:flex-none flex flex-col md:flex-row md:items-center md:justify-between gap-16 text-left">
                <div className="hidden md:flex flex-col gap-6 max-w-2xl">
                    {titulo}
                    <div className="h-px w-24 bg-uems-gold"></div>
                    <p className="text-lg text-[#D5DCE6] leading-relaxed max-w-lg">
                        Matriz de mitigação de fragilidades organizada por curso, unidade acadêmica e código.
                    </p>
                </div>

                <form onSubmit={handleLogin} noValidate className="gold-rule w-full md:w-[420px] shrink-0 bg-white md:rounded md:shadow-[0_24px_64px_rgba(0,10,25,0.45)] flex-1 md:flex-none px-6 py-7 md:px-9 md:pt-9 md:pb-8 flex flex-col gap-5">
                    <h2 className="font-serif-boletim italic text-xl md:text-[22px] font-semibold text-uems-dark">Acesso ao sistema</h2>

                    <div className="flex flex-col gap-2">
                        <label htmlFor="senha" className="mb-0 text-[13px] font-semibold text-ink normal-case tracking-normal">Senha</label>
                        <div className="relative flex items-center">
                            <input
                                id="senha"
                                ref={passwordRef}
                                type={showPassword ? 'text' : 'password'}
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(false); }}
                                onKeyUp={atualizarCaps}
                                onKeyDown={atualizarCaps}
                                disabled={isLoading}
                                aria-invalid={error}
                                aria-describedby={[isCapsOn ? 'senha-caps' : '', error ? 'senha-erro' : ''].filter(Boolean).join(' ') || undefined}
                                className={`input-uems h-12 py-0 pr-14 text-[15px]${error ? ' !border-seal-nao-executada' : ''}`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(v => !v)}
                                disabled={isLoading}
                                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                aria-pressed={showPassword}
                                className="absolute right-0.5 w-11 h-11 flex items-center justify-center rounded-md text-ink-muted hover:text-uems-blue transition-colors disabled:opacity-50"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        {isCapsOn && (
                            <span id="senha-caps" className="flex items-center gap-1.5 text-xs font-semibold text-seal-pendente">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Caps Lock está ativado
                            </span>
                        )}
                    </div>

                    {error && (
                        <div className="animate-shake">
                            <p id="senha-erro" role="alert" className="flex items-center gap-2 px-3 py-2.5 rounded-md border border-[#E9C9CD] bg-seal-nao-executada-bg text-[13px] font-semibold text-seal-nao-executada">
                                <XCircle className="w-4 h-4 shrink-0" /> {errorMessage}
                            </p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="h-12 rounded-md bg-uems-blue hover:bg-[#002A73] text-white text-[15px] font-semibold flex items-center justify-center gap-2.5 transition-colors disabled:opacity-70"
                    >
                        {isLoading ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Entrando…</>
                        ) : (
                            <>Entrar <ArrowRight className="w-[18px] h-[18px]" /></>
                        )}
                    </button>

                    <p className="pt-4 border-t border-rule text-[13px] leading-relaxed text-ink-muted">
                        Problemas para entrar? Escreva para <a href="mailto:enade@uems.br" className="text-uems-blue underline underline-offset-2 hover:text-uems-dark">enade@uems.br</a>.
                    </p>
                </form>
            </div>

            <div className="hidden md:block absolute left-12 lg:left-32 bottom-14 z-10 text-xs tracking-wide text-[#B7C4D6]">
                Universidade Estadual de Mato Grosso do Sul · PROE
            </div>
        </div>
    );
}
