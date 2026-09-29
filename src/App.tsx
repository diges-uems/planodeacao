import React, { useState, useEffect, useRef } from 'react';
import { Login } from './components/Login';
import { ActionForm } from './components/ActionForm';
import { Dashboard } from './components/Dashboard';
import { CartModal, SuccessModal, AlertModal } from './components/Modals';
import { EditModal } from './components/EditModal';
import { RegisterEmailModal } from './components/RegisterEmailModal';
import type { Fragility, User, ViewState } from './types';
import { submitCart, registerCourseEmail } from './lib/api';
import { LogOut, ArrowLeft } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

// Sessão sobrevive a recarregar a página, mas não a fechar a aba (sessionStorage) nem a
// mais de INATIVIDADE_MAX_MS sem interação — aí é preciso logar de novo.
const SESSAO_KEY = 'sessao';
const INATIVIDADE_MAX_MS = 30 * 60 * 1000;

interface SessaoSalva { user: User; view: ViewState; ultimaAtividade: number }

function lerSessao(): SessaoSalva | null {
    try {
        const s: SessaoSalva | null = JSON.parse(sessionStorage.getItem(SESSAO_KEY) || 'null');
        if (s && Date.now() - s.ultimaAtividade <= INATIVIDADE_MAX_MS) return s;
        sessionStorage.removeItem(SESSAO_KEY);
    } catch { /* storage indisponível: segue sem sessão */ }
    return null;
}

function salvarSessao(s: SessaoSalva | null) {
    try {
        if (s) sessionStorage.setItem(SESSAO_KEY, JSON.stringify(s));
        else sessionStorage.removeItem(SESSAO_KEY);
    } catch { /* storage indisponível */ }
}

export default function App() {
    const [sessaoInicial] = useState(lerSessao);
    const [view, setView] = useState<ViewState>(sessaoInicial?.view ?? 'login');
    const [user, setUser] = useState<User | null>(sessaoInicial?.user ?? null);
    const ultimaAtividade = useRef(Date.now());
    const [cart, setCart] = useState<Fragility[]>([]);
    
    // Modal states
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [alertState, setAlertState] = useState<{title: string, message: string} | null>(null);
    const [toastMsg, setToastMsg] = useState<string | null>(null);
    const [cartItemToEdit, setCartItemToEdit] = useState<{ index: number, item: Fragility } | null>(null);
    
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [isRegisteringEmail, setIsRegisteringEmail] = useState(false);

    useEffect(() => {
        if (toastMsg) {
            const t = setTimeout(() => setToastMsg(null), 2000);
            return () => clearTimeout(t);
        }
    }, [toastMsg]);

    const handleLogin = (u: User) => {
        setUser(u);
        if (u.role === 'coordenador' && u.emailRegistrado === false) {
            setShowEmailModal(true);
        }
        
        if (u.role === 'reitoria') {
            setView('dashboard');
        } else {
            setView('formulario');
        }
    };

    const handleLogout = () => {
        setUser(null);
        setView('login');
        setCart([]);
    };

    useEffect(() => {
        salvarSessao(user && view !== 'login' ? { user, view, ultimaAtividade: ultimaAtividade.current } : null);
    }, [user, view]);

    // Atividade renova a sessão; voltar depois de muito tempo parado exige novo login.
    useEffect(() => {
        if (!user) return;
        const onAtividade = () => {
            const agora = Date.now();
            if (agora - ultimaAtividade.current > INATIVIDADE_MAX_MS) {
                handleLogout();
                setAlertState({ title: 'Sessão expirada', message: 'Sua sessão expirou por inatividade. Faça login novamente.' });
                return;
            }
            if (agora - ultimaAtividade.current < 60_000) return; // grava no máximo 1x/min
            ultimaAtividade.current = agora;
            salvarSessao({ user, view, ultimaAtividade: agora });
        };
        const eventos = ['pointerdown', 'keydown', 'visibilitychange'] as const;
        eventos.forEach(ev => document.addEventListener(ev, onAtividade));
        return () => eventos.forEach(ev => document.removeEventListener(ev, onAtividade));
    }, [user, view]);

    const handleSaveToCart = (item: Fragility) => {
        setCart(prev => [...prev, item]);
        setToastMsg('Fragilidade salva na lista.');
    };

    const handleRemoveFromCart = (idx: number) => {
        setCart(prev => prev.filter((_, i) => i !== idx));
        if (cart.length <= 1) {
            setIsCartOpen(false);
        }
    };

    const handleEditCartItem = (idx: number, item: Fragility) => {
        setCartItemToEdit({ index: idx, item });
    };

    const handleSaveCartEdit = async (newData: Partial<Fragility>) => {
        if (cartItemToEdit !== null) {
            setCart(prev => {
                const newCart = [...prev];
                newCart[cartItemToEdit.index] = { ...newCart[cartItemToEdit.index], ...newData } as Fragility;
                return newCart;
            });
            setCartItemToEdit(null);
            setToastMsg('Item atualizado na lista.');
        }
    };

    const handleSubmitCart = async () => {
        setIsSubmitting(true);
        const success = await submitCart(cart, user!.token);
        setIsSubmitting(false);
        
        if (success) {
            setCart([]);
            setIsCartOpen(false);
            setSuccessMessage('Itens enviados com sucesso!');
        } else {
            setAlertState({ title: 'Erro', message: 'Falha ao sincronizar dados. Verifique a conexão e tente novamente.' });
        }
    };

    const handleSaveEmail = async (email: string) => {
        if (!user || !user.courseId) return;
        setIsRegisteringEmail(true);
        const success = await registerCourseEmail(user.courseId, email, user.token);
        setIsRegisteringEmail(false);
        
        if (success) {
            setShowEmailModal(false);
            setUser(prev => prev ? { ...prev, emailRegistrado: true } : prev);
            setToastMsg('E-mail cadastrado com sucesso!');
        } else {
            setAlertState({ title: 'Erro', message: 'Falha ao cadastrar e-mail. Tente novamente.' });
        }
    };

    const handleConsumirLiberacao = () => {
        if (user) {
            setUser({ ...user, podeEditar: false });
        }
    };

    const handlePodeEditarAtualizado = (podeEditar: boolean) => {
        setUser(prev => (prev && prev.podeEditar !== podeEditar) ? { ...prev, podeEditar } : prev);
    };

    return (
        <>
            {view === 'login' && (
                <div className="min-h-screen w-full">
                    <Login onLogin={handleLogin} />
                </div>
            )}

            {view !== 'login' && user && (
                <div className="bg-slate-50 text-slate-900 min-h-screen flex flex-col relative overflow-x-hidden pt-6">
                    <main className="w-full max-w-[98%] 2xl:max-w-[1800px] mx-auto p-4 sm:p-6 sm:pt-2 flex-grow flex-col relative z-10">
                        {view === 'formulario' && user.role === 'coordenador' && (
                            <div className="w-full text-left pb-10">
                                <header className="bg-uems-dark border-b-[3px] border-uems-gold px-6 py-3 sticky top-0 z-30 flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 -mx-4 sm:-mx-6 -mt-6 sm:-mt-2 gap-4">
                                    <div>
                                        <h1 className="font-serif-boletim italic text-xl font-semibold text-white">{user.courseName}</h1>
                                        <span className="text-[11px] font-semibold text-[#A9BCDD] uppercase tracking-wide">Gestão do Curso</span>
                                    </div>
                                    <nav aria-label="Navegação" className="flex flex-wrap gap-2">
                                        <button onClick={() => setView('dashboard')} className="h-9 px-3.5 rounded-md text-[13px] font-semibold flex items-center gap-2 border border-white/25 text-[#E6ECF5] hover:bg-white/10 transition-colors">
                                            <ArrowLeft className="w-4 h-4" /> Voltar aos registros
                                        </button>
                                        <button onClick={handleLogout} className="h-9 px-3.5 rounded-md text-[13px] font-semibold flex items-center gap-2 border border-white/25 text-[#E6ECF5] hover:bg-white/10 transition-colors">
                                            <LogOut className="w-4 h-4" /> Sair
                                        </button>
                                    </nav>
                                </header>

                                <ActionForm
                                    user={user}
                                    cart={cart}
                                    onSaveToCart={handleSaveToCart}
                                    onEditCartItem={handleEditCartItem}
                                    onRemoveCartItem={handleRemoveFromCart}
                                    onReview={() => setIsCartOpen(true)}
                                    showAlert={(title, message) => setAlertState({ title, message })}
                                />
                            </div>
                        )}

                        {view === 'dashboard' && (
                            <Dashboard 
                                user={user} 
                                onLogout={handleLogout} 
                                onNewRecord={user.role === 'coordenador' ? () => setView('formulario') : undefined} 
                                onShowAlert={(title, message) => setAlertState({ title, message })}
                                onConsumirLiberacao={handleConsumirLiberacao}
                                onPodeEditarAtualizado={handlePodeEditarAtualizado}
                            />
                        )}
                    </main>

                    <CartModal 
                        isOpen={isCartOpen}
                        onClose={() => setIsCartOpen(false)}
                        cart={cart}
                        onRemove={handleRemoveFromCart}
                        onEdit={handleEditCartItem}
                        onSubmit={handleSubmitCart}
                        isSubmitting={isSubmitting}
                    />

                    <EditModal
                        isOpen={!!cartItemToEdit}
                        onClose={() => setCartItemToEdit(null)}
                        item={cartItemToEdit?.item || null}
                        onSave={handleSaveCartEdit}
                        isProcessing={false}
                    />

                    <SuccessModal 
                        isOpen={!!successMessage}
                        onClose={() => setSuccessMessage('')}
                        message={successMessage}
                    />

                    <AlertModal
                        isOpen={!!alertState}
                        onClose={() => setAlertState(null)}
                        title={alertState?.title || ''}
                        message={alertState?.message || ''}
                    />

                    <RegisterEmailModal 
                        isOpen={showEmailModal} 
                        courseName={user?.courseName || ''} 
                        onSave={handleSaveEmail} 
                        isProcessing={isRegisteringEmail} 
                    />
                </div>
            )}

            <AnimatePresence>
                {toastMsg && (
                    <motion.div 
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.15 }}
                        className="fixed bottom-6 right-6 z-50 bg-white border border-slate-200 shadow-lg text-slate-800 rounded-lg px-6 py-4 text-sm font-medium flex items-center justify-between min-w-[280px]"
                    >
                        <span>{toastMsg}</span>
                        <button onClick={() => setToastMsg(null)} className="ml-4 text-slate-400 hover:text-slate-600 transition-colors">✕</button>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
