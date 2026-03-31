import { useState } from 'react';
import { ArrowRight, Loader2, AlertCircle, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Mode = 'login' | 'register';

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    if (mode === 'register' && !name.trim()) return;
    setError(null);
    setLoading(true);

    if (mode === 'register') {
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: { data: { full_name: name.trim() } },
      });
      if (signUpError) {
        setError(signUpError.message === 'User already registered'
          ? 'Este email já está cadastrado. Faça login.'
          : signUpError.message);
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });
      if (signInError) {
        setError('Email ou senha incorretos.');
      }
    }

    setLoading(false);
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
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl gradient-brand flex items-center justify-center mx-auto mb-3">
                <Mail size={22} className="text-white" />
              </div>
              <h1 className="text-xl font-extrabold text-brand-navy">
                {mode === 'login' ? 'Entrar' : 'Criar conta'}
              </h1>
              <p className="text-sm text-surface-500 mt-1">
                {mode === 'login'
                  ? 'Acesse sua conta para continuar'
                  : 'Preencha seus dados para começar'}
              </p>
            </div>

            {mode === 'register' && (
              <div>
                <label className="input-label">Nome completo</label>
                <input
                  className="input"
                  placeholder="Seu nome"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            )}

            <div>
              <label className="input-label">E-mail</label>
              <input
                type="email"
                className="input"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
              />
            </div>

            <div>
              <label className="input-label">Senha</label>
              <input
                type="password"
                className="input"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            {error && (
              <p className="text-xs text-red-500 flex items-center gap-1.5">
                <AlertCircle size={14} className="flex-shrink-0" /> {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim() || !password.trim() || (mode === 'register' && !name.trim())}
              className="btn-primary w-full"
            >
              {loading
                ? <Loader2 size={18} className="animate-spin" />
                : <><span>{mode === 'login' ? 'Entrar' : 'Criar conta'}</span><ArrowRight size={18} /></>
              }
            </button>

            <button
              type="button"
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
              className="w-full text-xs text-surface-400 hover:text-surface-600 transition-colors"
            >
              {mode === 'login' ? 'Não tem conta? Criar uma' : '← Já tenho conta, entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
