import { useState } from 'react';
import { ArrowRight, Loader2, AlertCircle, KeyRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { hashCode } from '@/lib/hashCode';

type Step = 'code' | 'register';

export function AccessCodePage() {
  const [step, setStep] = useState<Step>('code');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: validate the code
  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setError(null);
    setLoading(true);

    const { data, error: rpcError } = await supabase.rpc('validate_access_code', {
      p_code: code.trim().toUpperCase(),
    });

    setLoading(false);

    if (rpcError || !data || data.length === 0) {
      setError('Erro ao verificar o código. Tente novamente.');
      return;
    }

    const result = data[0];

    if (!result.valid) {
      setError('Código inválido.');
      return;
    }

    if (result.status === 'expired') {
      setError('Este código expirou. Entre em contato com o administrador.');
      return;
    }

    if (result.status === 'revoked') {
      setError('Código inválido.');
      return;
    }

    if (result.status === 'used') {
      if (result.email) {
        // Returning user — sign in directly
        await handleSignIn(result.email);
      } else {
        setError('Código já utilizado. Entre em contato com o administrador.');
      }
      return;
    }

    // First access — show registration form
    setStep('register');
  }

  // Sign in a returning user
  async function handleSignIn(userEmail: string) {
    setLoading(true);
    setError(null);

    const password = await hashCode(code.trim().toUpperCase());
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError('Erro ao entrar. Tente novamente.');
    }
    // On success: AuthContext detects the new session and re-renders App
  }

  // Step 2: register new user
  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setError(null);
    setLoading(true);

    const normalizedCode = code.trim().toUpperCase();
    const password = await hashCode(normalizedCode);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim() } },
    });

    if (signUpError) {
      setLoading(false);
      setError('Erro ao criar conta. Tente novamente.');
      return;
    }

    if (!signUpData.session || !signUpData.user) {
      setLoading(false);
      setError('Erro ao criar conta. Verifique se a confirmação de email está desabilitada no Supabase.');
      return;
    }

    const { data: linked } = await supabase.rpc('use_access_code', {
      p_code:    normalizedCode,
      p_name:    name.trim(),
      p_email:   email.trim(),
      p_user_id: signUpData.user.id,
    });

    setLoading(false);

    if (!linked) {
      setError('Erro ao ativar o código. Entre em contato com o administrador.');
      return;
    }

    // Session is active — AuthContext will detect it and redirect
  }

  return (
    <div className="min-h-screen bg-surface-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="bg-brand-navy rounded-2xl px-6 py-4 shadow-lg">
            <img
              src="/logo-precificatur.png"
              alt="PrecificaTur"
              className="h-10 object-contain"
            />
          </div>
        </div>

        {/* Card */}
        <div className="card">
          {step === 'code' ? (
            <form onSubmit={handleCodeSubmit} className="space-y-5">
              <div className="text-center">
                <div className="w-12 h-12 rounded-2xl gradient-brand flex items-center justify-center mx-auto mb-3">
                  <KeyRound size={22} className="text-white" />
                </div>
                <h1 className="text-xl font-extrabold text-brand-navy">Acesso Beta</h1>
                <p className="text-sm text-surface-500 mt-1">
                  Insira seu código de acesso para continuar
                </p>
              </div>

              <div>
                <label className="input-label">Código de acesso</label>
                <input
                  className="input text-center font-mono text-lg tracking-widest uppercase"
                  placeholder="PREC-XXXX-XXXX"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  autoComplete="off"
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-xs text-red-500 flex items-center gap-1.5">
                  <AlertCircle size={14} className="flex-shrink-0" /> {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="btn-primary w-full"
              >
                {loading
                  ? <Loader2 size={18} className="animate-spin" />
                  : <><span>Entrar</span><ArrowRight size={18} /></>
                }
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-5">
              <div className="text-center">
                <h1 className="text-xl font-extrabold text-brand-navy">Bem-vindo!</h1>
                <p className="text-sm text-surface-500 mt-1">
                  Complete seu cadastro para continuar.
                </p>
              </div>

              <div>
                <label className="input-label">Nome completo</label>
                <input
                  className="input"
                  placeholder="Seu nome"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoComplete="name"
                  autoFocus
                />
              </div>

              <div>
                <label className="input-label">E-mail</label>
                <input
                  type="email"
                  className="input"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              {error && (
                <p className="text-xs text-red-500 flex items-center gap-1.5">
                  <AlertCircle size={14} className="flex-shrink-0" /> {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !name.trim() || !email.trim()}
                className="btn-primary w-full"
              >
                {loading
                  ? <Loader2 size={18} className="animate-spin" />
                  : <><span>Confirmar e entrar</span><ArrowRight size={18} /></>
                }
              </button>

              <button
                type="button"
                onClick={() => { setStep('code'); setError(null); }}
                className="w-full text-xs text-surface-400 hover:text-surface-600 transition-colors"
              >
                ← Voltar
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
