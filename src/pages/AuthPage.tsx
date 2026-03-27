import { useState } from 'react';
import {
  Mail, Lock, User, Eye, EyeOff, ArrowRight, AlertCircle, Check
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function AuthPage() {
  const { signIn, signUp, signInWithOAuth } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [registerSuccess, setRegisterSuccess] = useState(false);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const validateLogin = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!loginEmail.trim()) newErrors.loginEmail = 'Informe seu e-mail';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail))
      newErrors.loginEmail = 'E-mail inválido';
    if (!loginPassword) newErrors.loginPassword = 'Informe sua senha';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateRegister = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Informe seu nome completo';
    if (!email.trim()) newErrors.email = 'Informe seu e-mail';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      newErrors.email = 'E-mail inválido';
    if (!confirmEmail.trim()) newErrors.confirmEmail = 'Confirme seu e-mail';
    else if (email !== confirmEmail)
      newErrors.confirmEmail = 'Os e-mails não coincidem';
    if (!password) newErrors.password = 'Crie uma senha';
    else if (password.length < 6)
      newErrors.password = 'Mínimo de 6 caracteres';
    if (!confirmPassword) newErrors.confirmPassword = 'Confirme sua senha';
    else if (password !== confirmPassword)
      newErrors.confirmPassword = 'As senhas não coincidem';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateLogin()) return;
    setLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setLoading(false);
    if (error) {
      const msg = error.message ?? '';
      if (msg.includes('Invalid login credentials')) {
        setErrors({ loginEmail: 'E-mail ou senha incorretos' });
      } else if (msg.includes('Email not confirmed')) {
        setErrors({ loginEmail: 'Confirme seu e-mail antes de entrar' });
      } else {
        setErrors({ loginEmail: 'Erro ao autenticar. Tente novamente.' });
      }
    }
    // On success: AuthContext updates user → App re-renders automatically
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateRegister()) return;
    setLoading(true);
    const { error } = await signUp(email, password, name);
    setLoading(false);
    if (error) {
      const msg = error.message ?? '';
      if (msg.includes('User already registered')) {
        setErrors({ email: 'Este e-mail já está cadastrado' });
      } else {
        setErrors({ email: 'Erro ao criar conta. Tente novamente.' });
      }
    } else {
      setRegisterSuccess(true);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'facebook') => {
    await signInWithOAuth(provider);
    // Browser navigates away — no state update needed
  };

  const passwordStrength = (pwd: string): { level: number; label: string; color: string } => {
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

  const strength = passwordStrength(password);

  return (
    <div className="min-h-screen bg-surface-100 flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[520px] gradient-brand flex-col justify-between p-10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-10 w-64 h-64 rounded-full border-2 border-white" />
          <div className="absolute bottom-32 right-8 w-48 h-48 rounded-full border-2 border-white" />
          <div className="absolute top-1/2 left-1/3 w-32 h-32 rounded-full border-2 border-white" />
        </div>

        <div className="relative z-10">
          <img
            src="/logo-precificatur.png"
            alt="PrecificaTur"
            className="h-14 object-contain object-left mb-10"
          />
          <h1 className="text-3xl font-extrabold text-white leading-tight mb-4">
            Precifique seus roteiros{' '}
            <span className="text-brand-orange-300">com precisão</span>
          </h1>
          <p className="text-white/70 text-sm leading-relaxed max-w-sm">
            Simule cenários, descubra o ponto de equilíbrio e maximize
            a lucratividade de cada operação turística.
          </p>
        </div>

        <div className="relative z-10 space-y-4">
          {[
            'Calculadora de precificação inteligente',
            'Simulação de cenários em tempo real',
            'Relatórios detalhados por roteiro',
          ].map((feat) => (
            <div key={feat} className="flex items-center gap-3 text-white/80 text-sm">
              <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
                <Check size={14} className="text-brand-orange-300" />
              </div>
              {feat}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-10">
            <div className="bg-brand-navy rounded-2xl px-6 py-4 shadow-lg">
              <img
                src="/logo-precificatur.png"
                alt="PrecificaTur"
                className="h-10 object-contain"
              />
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-surface-200 rounded-2xl p-1.5 mb-8">
            <button
              type="button"
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
              type="button"
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
            <form onSubmit={handleLogin} className="space-y-5 animate-fade-in" noValidate>
              <div>
                <h2 className="text-2xl font-extrabold text-surface-800 mb-1">
                  Bem-vindo de volta!
                </h2>
                <p className="text-sm text-surface-500">
                  Entre na sua conta para continuar
                </p>
              </div>

              <div>
                <label className="input-label">E-mail</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
                  <input
                    type="email"
                    autoComplete="email"
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

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-semibold text-surface-700">Senha</label>
                  <button
                    type="button"
                    className="text-xs text-brand-blue hover:text-brand-blue-600 font-semibold transition-colors"
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <div className="relative">
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    autoComplete="current-password"
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

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full text-base"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Entrar
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Register form */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4 animate-fade-in" noValidate>
              <div>
                <h2 className="text-2xl font-extrabold text-surface-800 mb-1">
                  Crie sua conta
                </h2>
                <p className="text-sm text-surface-500">
                  Comece a precificar seus roteiros agora
                </p>
              </div>

              {/* Nome */}
              <div>
                <label className="input-label">Nome completo</label>
                <div className="relative">
                  <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
                  <input
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    className={`input pl-11 ${errors.name ? 'border-red-400 focus:ring-red-200' : ''}`}
                  />
                </div>
                {errors.name && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.name}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="input-label">E-mail</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className={`input pl-11 ${errors.email ? 'border-red-400 focus:ring-red-200' : ''}`}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.email}
                  </p>
                )}
              </div>

              {/* Confirmar email */}
              <div>
                <label className="input-label">Confirme o e-mail</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
                  <input
                    type="email"
                    autoComplete="email"
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    placeholder="Repita seu e-mail"
                    className={`input pl-11 ${errors.confirmEmail ? 'border-red-400 focus:ring-red-200' : ''}`}
                  />
                </div>
                {errors.confirmEmail && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.confirmEmail}
                  </p>
                )}
                {confirmEmail && email === confirmEmail && !errors.confirmEmail && (
                  <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                    <Check size={12} /> E-mails coincidem
                  </p>
                )}
              </div>

              {/* Senha */}
              <div>
                <label className="input-label">Senha</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Crie uma senha"
                    className={`input pl-11 pr-11 ${errors.password ? 'border-red-400 focus:ring-red-200' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors"
                  >
                    {showRegisterPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.password}
                  </p>
                )}
                {/* Password strength indicator */}
                {password.length > 0 && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                            i <= strength.level ? strength.color : 'bg-surface-200'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-surface-500">
                      Força da senha: <span className="font-semibold">{strength.label}</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Confirmar senha */}
              <div>
                <label className="input-label">Confirme a senha</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita sua senha"
                    className={`input pl-11 pr-11 ${errors.confirmPassword ? 'border-red-400 focus:ring-red-200' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.confirmPassword}
                  </p>
                )}
                {confirmPassword && password === confirmPassword && !errors.confirmPassword && (
                  <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                    <Check size={12} /> Senhas coincidem
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full text-base"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Criar conta
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              {registerSuccess && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
                  <Check size={16} className="mt-0.5 flex-shrink-0 text-emerald-500" />
                  <span>Verifique seu e-mail para confirmar o cadastro.</span>
                </div>
              )}
            </form>
          )}

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-surface-300" />
            <span className="text-xs text-surface-400 font-semibold">ou entre com</span>
            <div className="flex-1 h-px bg-surface-300" />
          </div>

          {/* Social login */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleSocialLogin('google')}
              disabled={loading}
              className="flex-1 btn border border-surface-300 bg-white text-surface-700 px-4 py-3
                         hover:bg-surface-50 hover:border-surface-400 transition-all"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 mr-2 flex-shrink-0">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </button>
            <button
              type="button"
              onClick={() => handleSocialLogin('facebook')}
              disabled={loading}
              className="flex-1 btn border border-surface-300 bg-white text-surface-700 px-4 py-3
                         hover:bg-surface-50 hover:border-surface-400 transition-all"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 mr-2 flex-shrink-0" fill="#1877F2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Facebook
            </button>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-surface-400 mt-8">
            Ao criar uma conta, você concorda com nossos{' '}
            <button type="button" className="text-brand-blue hover:underline font-semibold">
              Termos de Uso
            </button>{' '}
            e{' '}
            <button type="button" className="text-brand-blue hover:underline font-semibold">
              Política de Privacidade
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
