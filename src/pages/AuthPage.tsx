import { useState, useEffect, useRef } from 'react';
import {
  Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, Check
} from 'lucide-react';

interface AuthPageProps {
  onLogin: () => void;
}

const TESTIMONIALS = [
  {
    name: 'Mariana Silva',
    role: 'Agente de viagens',
    initials: 'MS',
    text: 'O PrecificaTur mudou a forma como encaramos nossa rentabilidade. Agora temos clareza total sobre cada centavo investido nos roteiros.',
  },
  {
    name: 'Carlos Rocha',
    role: 'Operador turístico',
    initials: 'CR',
    text: 'Antes levávamos horas para precificar um roteiro. Agora fazemos em minutos com muito mais confiança.',
  },
  {
    name: 'Ana Ferreira',
    role: 'Guia de turismo',
    initials: 'AF',
    text: 'A simulação de cenários me ajuda a mostrar para os clientes por que o preço é justo. Ferramenta indispensável.',
  },
  {
    name: 'Pedro Costa',
    role: 'Dono de agência',
    initials: 'PC',
    text: 'Finalmente consigo ver o ponto de equilíbrio de cada passeio. Minha margem aumentou 18% no primeiro mês.',
  },
  {
    name: 'Lucia Mendes',
    role: 'Consultora de turismo',
    initials: 'LM',
    text: 'Os relatórios detalhados por roteiro me dão argumentos sólidos nas negociações com fornecedores.',
  },
];

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

export function AuthPage({ onLogin }: AuthPageProps) {

  const [testimonialIndex, setTestimonialIndex] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startInterval = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setTestimonialIndex((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 5000);
  };

  useEffect(() => {
    startInterval();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const goToTestimonial = (index: number) => {
    setTestimonialIndex(index);
    startInterval();
  };

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [_showRegisterPassword, _setShowRegisterPassword] = useState(false);
  const [_showConfirmPassword, _setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register fields (used in Task 4)
  const [_name, _setName] = useState('');
  const [_email, _setEmail] = useState('');
  const [_confirmEmail, _setConfirmEmail] = useState('');
  const [_password, _setPassword] = useState('');
  const [_confirmPassword, _setConfirmPassword] = useState('');

  const validateLogin = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!loginEmail.trim()) newErrors.loginEmail = 'Informe seu e-mail';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail))
      newErrors.loginEmail = 'E-mail inválido';
    if (!loginPassword) newErrors.loginPassword = 'Informe sua senha';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const _validateRegister = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!_name.trim()) newErrors.name = 'Informe seu nome completo';
    if (!_email.trim()) newErrors.email = 'Informe seu e-mail';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(_email))
      newErrors.email = 'E-mail inválido';
    if (!_confirmEmail.trim()) newErrors.confirmEmail = 'Confirme seu e-mail';
    else if (_email !== _confirmEmail)
      newErrors.confirmEmail = 'Os e-mails não coincidem';
    if (!_password) newErrors.password = 'Crie uma senha';
    else if (_password.length < 6)
      newErrors.password = 'Mínimo de 6 caracteres';
    if (!_confirmPassword) newErrors.confirmPassword = 'Confirme sua senha';
    else if (_password !== _confirmPassword)
      newErrors.confirmPassword = 'As senhas não coincidem';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateLogin()) return;
    setLoading(true);
    // TODO: Integrar com backend (Supabase)
    setTimeout(() => {
      setLoading(false);
      onLogin();
    }, 800);
  };

  const _handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!_validateRegister()) return;
    setLoading(true);
    // TODO: Integrar com backend (Supabase)
    setTimeout(() => {
      setLoading(false);
      onLogin();
    }, 800);
  };

  const handleSocialLogin = (_provider: 'google' | 'facebook') => {
    setLoading(true);
    // TODO: Integrar OAuth com Google/Facebook via Supabase
    setTimeout(() => {
      setLoading(false);
      onLogin();
    }, 800);
  };

  const _passwordStrength = (pwd: string): { level: number; label: string; color: string } => {
    if (pwd.length === 0) return { level: 0, label: '', color: '' };
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { level: 1, label: 'Fraca', color: 'bg-red-500' };
    if (score <= 2) return { level: 2, label: 'Razoável', color: 'bg-yellow-500' };
    if (score <= 3) return { level: 3, label: 'Boa', color: 'bg-blue-500' };
    return { level: 4, label: 'Forte', color: 'bg-emerald-500' };
  };

  // Pre-compute for Task 4 register form
  const _strength = _passwordStrength(_password);
  void _handleRegister; void _strength;

  return (
    <div className="min-h-screen bg-surface-100 flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[520px] flex-col relative overflow-hidden">
        {/* Photo stack */}
        <div className="absolute inset-0 flex flex-col">
          <img
            src="https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=520&auto=format&fit=crop"
            alt=""
            className="flex-1 w-full object-cover min-h-0"
          />
          <img
            src="https://images.unsplash.com/photo-1518182170546-07661fd94144?w=520&auto=format&fit=crop"
            alt=""
            className="flex-1 w-full object-cover min-h-0"
          />
          <img
            src="https://images.unsplash.com/photo-1592394533824-9440e5d68530?w=520&auto=format&fit=crop"
            alt=""
            className="flex-1 w-full object-cover min-h-0"
          />
        </div>

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/40" />

        {/* Content over overlay */}
        <div className="relative z-10 flex flex-col h-full p-10">
          {/* Logo */}
          <img
            src="/logo-precificatur.png"
            alt="PrecificaTur"
            className="h-12 object-contain object-left mb-10"
          />

          {/* Headline + features */}
          <div className="flex-1">
            <h1 className="text-3xl font-extrabold text-white leading-tight mb-4">
              Precifique seus roteiros com precisão.
            </h1>
            <div className="space-y-3 mt-6">
              {[
                'Calculadora de precificação inteligente',
                'Simulação de cenários em tempo real',
                'Relatórios detalhados por roteiro',
              ].map((feat) => (
                <div key={feat} className="flex items-center gap-3 text-white/85 text-sm">
                  <div className="w-6 h-6 rounded-full bg-brand-orange/80 flex items-center justify-center flex-shrink-0">
                    <Check size={13} className="text-white" />
                  </div>
                  {feat}
                </div>
              ))}
            </div>
          </div>

          {/* Testimonials */}
          <div className="mt-8 relative min-h-[120px]">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={i}
                className="transition-opacity duration-500"
                style={{
                  opacity: i === testimonialIndex ? 1 : 0,
                  position: i === testimonialIndex ? 'relative' : 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  pointerEvents: i === testimonialIndex ? 'auto' : 'none',
                }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-brand-orange flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">{t.initials}</span>
                  </div>
                  <div>
                    <p className="text-white text-sm font-bold leading-tight">{t.name}</p>
                    <p className="text-white/60 text-xs">{t.role}</p>
                  </div>
                </div>
                <p className="text-white/80 text-sm leading-relaxed italic">"{t.text}"</p>
              </div>
            ))}

            {/* Dots */}
            <div className="flex gap-2 mt-4">
              {TESTIMONIALS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goToTestimonial(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === testimonialIndex
                      ? 'w-6 bg-brand-orange'
                      : 'w-1.5 bg-white/40 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-10">
            <div className="bg-brand-navy rounded-2xl px-6 py-4 shadow-lg">
              <img src="/logo-precificatur.png" alt="PrecificaTur" className="h-10 object-contain" />
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-surface-200 rounded-2xl p-1.5 mb-8">
            <button
              onClick={() => { setTab('login'); setErrors({}); }}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
                tab === 'login'
                  ? 'bg-white text-brand-navy shadow-sm'
                  : 'text-surface-500 hover:text-surface-700'
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => { setTab('register'); setErrors({}); }}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
                tab === 'register'
                  ? 'bg-white text-brand-navy shadow-sm'
                  : 'text-surface-500 hover:text-surface-700'
              }`}
            >
              Criar Conta
            </button>
          </div>

          {/* Login form */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5 animate-fade-in">
              <div>
                <h2 className="text-2xl font-extrabold text-surface-800 mb-1">
                  Bem-vindo de volta!
                </h2>
                <p className="text-sm text-surface-500">Entre na sua conta para continuar</p>
              </div>

              {/* E-mail */}
              <div>
                <label className="input-label">E-mail</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className={`input pl-11 ${errors.loginEmail ? 'border-red-400 focus:ring-red-200' : ''}`}
                  />
                </div>
                {errors.loginEmail && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.loginEmail}
                  </p>
                )}
              </div>

              {/* Senha */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-semibold text-surface-700">Senha</label>
                  <button type="button" className="text-xs text-brand-blue hover:text-brand-blue-600 font-semibold transition-colors">
                    Esqueci minha senha
                  </button>
                </div>
                <div className="relative">
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Sua senha"
                    className={`input pl-11 pr-11 ${errors.loginPassword ? 'border-red-400 focus:ring-red-200' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors"
                  >
                    {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.loginPassword && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.loginPassword}
                  </p>
                )}
              </div>

              {/* CTA */}
              <button type="submit" disabled={loading} className="btn-primary w-full text-base">
                {loading
                  ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><span>Entrar</span><ArrowRight size={18} /></>
                }
              </button>

              {/* Divider */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-surface-300" />
                <span className="text-xs text-surface-400 font-semibold">ou entre com</span>
                <div className="flex-1 h-px bg-surface-300" />
              </div>

              {/* Social */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleSocialLogin('google')}
                  disabled={loading}
                  className="flex-1 btn border border-surface-300 bg-white text-surface-700 px-4 py-3 hover:bg-surface-50 hover:border-surface-400 transition-all"
                >
                  <GoogleIcon />
                  Google
                </button>
                <button
                  type="button"
                  onClick={() => handleSocialLogin('facebook')}
                  disabled={loading}
                  className="flex-1 btn border border-surface-300 bg-white text-surface-700 px-4 py-3 hover:bg-surface-50 hover:border-surface-400 transition-all"
                >
                  <FacebookIcon />
                  Facebook
                </button>
              </div>
            </form>
          )}

          {/* Register form — placeholder for Task 4 */}
          {tab === 'register' && (
            <div className="animate-fade-in">
              <h2 className="text-2xl font-extrabold text-surface-800 mb-1">Criar nova conta</h2>
              <p className="text-sm text-surface-500">Experimente gratuitamente por 30 dias.</p>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-center gap-3 mt-8 flex-wrap">
            {['TERMOS', 'PRIVACIDADE', 'COOKIES', 'CONTATO'].map((link, i, arr) => (
              <span key={link} className="flex items-center gap-3">
                <button className="text-[11px] text-surface-400 hover:text-surface-600 font-semibold transition-colors">
                  {link}
                </button>
                {i < arr.length - 1 && <span className="text-surface-300 text-xs">|</span>}
              </span>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
