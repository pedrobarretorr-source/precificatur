# Access Code Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the no-op auth bypass with a working access-code authentication system: users enter a code to log in, admins manage codes via a dedicated panel.

**Architecture:** A Supabase migration creates the `access_codes` table and two SECURITY DEFINER Postgres functions (`validate_access_code`, `use_access_code`). The frontend adds a `hashCode` utility, updates `AuthContext` to expose `profile.is_admin`, and replaces `AuthPage` with `AccessCodePage`. An `AdminPage` backed by `useAdminCodes` hook lets admins create/revoke codes.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, Supabase JS v2, Web Crypto API (`crypto.subtle`), Lucide React icons.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/migrations/20260329000000_access_codes.sql` | Create | Table, RLS, `is_admin` column, two SECURITY DEFINER functions |
| `src/lib/hashCode.ts` | Create | Async SHA-256 via Web Crypto API |
| `src/contexts/AuthContext.tsx` | Modify | Add `profile: { is_admin: boolean } \| null` to context |
| `src/pages/AccessCodePage.tsx` | Create | 2-step auth: code entry → optional registration |
| `src/App.tsx` | Modify | Re-enable auth gate, swap `AuthPage` → `AccessCodePage`, add admin route |
| `src/components/layout/Sidebar.tsx` | Modify | Show "Admin" nav item conditionally on `profile.is_admin` |
| `src/hooks/useAdminCodes.ts` | Create | CRUD for `access_codes` table (admin only) |
| `src/pages/AdminPage.tsx` | Create | Stats + code list + create panel |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260329000000_access_codes.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260329000000_access_codes.sql

-- 1. Add is_admin column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- 2. Create access_codes table
CREATE TABLE IF NOT EXISTS access_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text UNIQUE NOT NULL,
  status      text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'used', 'expired', 'revoked')),
  expires_at  timestamptz,
  user_id     uuid REFERENCES auth.users(id),
  name        text,
  email       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE access_codes ENABLE ROW LEVEL SECURITY;

-- 4. Admin-only direct access (read + write)
CREATE POLICY "admin_access_codes" ON public.access_codes
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 5. validate_access_code: callable by anon, returns minimal data
CREATE OR REPLACE FUNCTION public.validate_access_code(p_code text)
RETURNS TABLE(valid bool, status text, email text, name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row access_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM access_codes WHERE code = p_code;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  -- Auto-expire if past expiry date and still active
  IF v_row.expires_at IS NOT NULL AND v_row.expires_at < now() AND v_row.status = 'active' THEN
    UPDATE access_codes SET status = 'expired' WHERE id = v_row.id;
    v_row.status := 'expired';
  END IF;

  RETURN QUERY SELECT true, v_row.status, v_row.email, v_row.name;
END;
$$;

-- 6. use_access_code: links code to newly registered user
CREATE OR REPLACE FUNCTION public.use_access_code(
  p_code    text,
  p_name    text,
  p_email   text,
  p_user_id uuid
)
RETURNS bool
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row access_codes%ROWTYPE;
BEGIN
  -- Guard: caller must be the user being linked
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN false;
  END IF;

  SELECT * INTO v_row FROM access_codes WHERE code = p_code;

  -- Guard: code must be active
  IF NOT FOUND OR v_row.status <> 'active' THEN
    RETURN false;
  END IF;

  UPDATE access_codes
  SET user_id = p_user_id,
      name    = p_name,
      email   = p_email,
      status  = 'used'
  WHERE id = v_row.id;

  RETURN true;
END;
$$;

-- Grant execute to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.validate_access_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.use_access_code(text, text, text, uuid) TO authenticated;
```

- [ ] **Step 2: Apply migration to Supabase**

Option A — Supabase CLI (if linked):
```bash
cd C:\Users\USUARIO\Desktop\PRECIFICATUR-MVP
npx supabase db push
```

Option B — Supabase Dashboard SQL editor:
Copy the contents of `supabase/migrations/20260329000000_access_codes.sql` and run it in the SQL editor of your Supabase project.

Expected: no errors. Verify by checking the `access_codes` table exists in the Table Editor, and the two functions appear in Database → Functions.

- [ ] **Step 3: Manually verify the migration**

In Supabase SQL editor, run:
```sql
-- Should return (false, null, null, null)
SELECT * FROM public.validate_access_code('TEST-0000-0000');

-- access_codes table should exist with correct columns
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'access_codes';

-- profiles should have is_admin column
SELECT column_name FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'is_admin';
```

- [ ] **Step 4: Insert a test access code directly in Supabase SQL editor**

```sql
-- Insert a test code you'll use to log in during development
INSERT INTO access_codes (code) VALUES ('PREC-TEST-0001');
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260329000000_access_codes.sql
git commit -m "feat: add access_codes table, RLS, and SECURITY DEFINER functions"
```

---

## Task 2: hashCode Utility

**Files:**
- Create: `src/lib/hashCode.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/lib/hashCode.ts
export async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

- [ ] **Step 2: Verify build passes**

```bash
cd C:\Users\USUARIO\Desktop\PRECIFICATUR-MVP
npx vite build --mode development 2>&1 | tail -5
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/hashCode.ts
git commit -m "feat: add hashCode utility using Web Crypto API"
```

---

## Task 3: AuthContext — Add Profile

**Files:**
- Modify: `src/contexts/AuthContext.tsx`

Context: The current `AuthContext` has `user`, `session`, `loading`, `signIn`, `signUp`, `signOut`, `signInWithOAuth`. We need to add `profile: { is_admin: boolean } | null`. The `loading` must stay `true` until both user and profile are resolved. On sign-out, `profile` must be cleared immediately.

**Preflight check:** The new `AuthContext` removes `signIn`, `signUp`, and `signInWithOAuth` from the exported interface (they are not needed — `AccessCodePage` calls Supabase directly). Before writing this task, verify no file other than `AuthPage.tsx` uses these methods:
```bash
grep -r "signIn\|signUp\|signInWithOAuth" src/ --include="*.ts" --include="*.tsx" -l
```
Expected: only `src/pages/AuthPage.tsx`. If other files appear, update them to not rely on context auth methods before proceeding. (`useRoutes.ts` does NOT use them — confirmed.)

- [ ] **Step 1: Replace `src/contexts/AuthContext.tsx` with the updated version**

```typescript
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type Profile = { is_admin: boolean } | null;

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single();
    setProfile(data ?? null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        // Sign-out: clear profile immediately
        setProfile(null);
        setUser(null);
        setSession(null);
        setLoading(false);
        return;
      }
      setSession(session);
      setUser(session.user);
      await fetchProfile(session.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

Note: `signIn`, `signUp`, `signInWithOAuth` are removed from context — the new `AccessCodePage` calls Supabase directly. `AuthPage` will be replaced and no longer uses these context methods.

- [ ] **Step 2: Verify build**

```bash
npx vite build --mode development 2>&1 | tail -20
```

Expected: TypeScript errors for `signIn`/`signUp`/`signInWithOAuth` usage in `AuthPage.tsx` — that's OK for now, `AuthPage` will be replaced in Task 5. If there are errors elsewhere, fix them before proceeding.

- [ ] **Step 3: Commit**

```bash
git add src/contexts/AuthContext.tsx
git commit -m "feat: add profile.is_admin to AuthContext, resolve loading after profile fetch"
```

---

## Task 4: AccessCodePage

**Files:**
- Create: `src/pages/AccessCodePage.tsx`

Context: This page replaces `AuthPage`. It has two steps: (1) code entry — validate the code via RPC; (2) if first access, show registration form (name + email); if returning user, sign in directly. Uses `hashCode` utility and calls Supabase directly (not through AuthContext).

- [ ] **Step 1: Create `src/pages/AccessCodePage.tsx`**

```typescript
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

    if (result.status === 'used' && result.email) {
      // Returning user — sign in directly
      await handleSignIn(result.email);
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
```

- [ ] **Step 2: Verify build**

```bash
npx vite build --mode development 2>&1 | tail -10
```

Expected: builds successfully. `AuthPage` errors from Task 3 may still exist — that's fine.

- [ ] **Step 3: Commit**

```bash
git add src/pages/AccessCodePage.tsx
git commit -m "feat: add AccessCodePage with 2-step code auth flow"
```

---

## Task 5: App.tsx — Re-enable Auth Gate

**Files:**
- Modify: `src/App.tsx`

Context: Current `App.tsx` imports `AuthPage` and has the auth gate commented out. We need to: (1) remove `AuthPage` import, (2) import `AccessCodePage`, (3) uncomment the auth gate using `AccessCodePage`, (4) add `'admin'` case to `renderPage`, (5) add `AdminPage` import (will be created in Task 8 — use a placeholder for now).

- [ ] **Step 1: Update `src/App.tsx`**

Replace the entire file:

```typescript
import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import { DashboardPage } from '@/pages/DashboardPage';
import { CalculatorPage } from '@/pages/CalculatorPage';
import { RoutesPage } from '@/pages/RoutesPage';
import { AiAssistantPage } from '@/pages/AiAssistantPage';
import { AccessCodePage } from '@/pages/AccessCodePage';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <div className="text-5xl mb-4">🚧</div>
        <h2 className="text-xl font-bold text-surface-700 mb-2">{title}</h2>
        <p className="text-sm text-surface-400">Módulo em desenvolvimento — Fase 2</p>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-100">
        <div className="text-surface-400 text-sm">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <AccessCodePage />;
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage onNavigate={setActivePage} />;
      case 'calculator':
        return <CalculatorPage />;
      case 'routes':
        return <RoutesPage onNavigate={setActivePage} />;
      case 'reports':
        return <PlaceholderPage title="Relatórios" />;
      case 'ai-assistant':
        return <AiAssistantPage />;
      case 'admin':
        // Return DashboardPage directly for non-admins — do NOT call setActivePage here
        // (state updates during render cause React warnings)
        if (!profile?.is_admin) {
          return <DashboardPage onNavigate={setActivePage} />;
        }
        return <PlaceholderPage title="Admin — em breve" />;
      default:
        return <DashboardPage onNavigate={setActivePage} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-surface-100">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Mobile header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 gradient-brand flex items-center justify-between px-4">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 -ml-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Menu size={24} />
        </button>
        <img src="/logo-precificatur.png" alt="PrecificaTur" className="h-7 object-contain" />
        <div className="w-8" />
      </header>

      <main className="flex-1 pt-[72px] md:pt-0 px-3 py-4 sm:px-6 sm:py-6 lg:p-8 max-w-6xl">
        {renderPage()}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
```

Note: `AdminPage` is a placeholder here; it will be replaced in Task 8. `AuthPage` import is removed.

- [ ] **Step 2: Verify build**

```bash
npx vite build --mode development 2>&1 | tail -10
```

Expected: clean build. `AuthPage` is no longer imported (its TypeScript errors from Task 3 are gone).

- [ ] **Step 3: Smoke test in browser**

Run `npm run dev`, open the app. You should see the `AccessCodePage` (code entry screen) instead of the old login form. Enter the test code `PREC-TEST-0001` (inserted in Task 1). It should advance to the registration step.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: re-enable auth gate, swap to AccessCodePage, add admin route stub"
```

---

## Task 6: Sidebar — Admin Nav Item

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

Context: `Sidebar` currently takes `activePage`, `onNavigate`, `mobileOpen`, `onCloseMobile`. The `NAV_ITEMS` array is static. We need to show an "Admin" item only when `profile.is_admin` is true. The sidebar needs to receive `isAdmin?: boolean` prop, or read from context directly. Simplest: read from `useAuth()` context inside `Sidebar` — no prop change needed.

- [ ] **Step 1: Update `src/components/layout/Sidebar.tsx`**

Add the import and admin item. Only 3 things change:
1. Import `Shield` from lucide-react and `useAuth` from context
2. Inside `Sidebar`, call `const { profile } = useAuth()`
3. In `NavItems` (or at the nav render site), append the Admin item if `isAdmin` is true

Full updated file:

```typescript
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Calculator, LayoutDashboard, Map, FileText,
  ChevronLeft, ChevronRight, Bot, X, Shield
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const NAV_ITEMS = [
  { id: 'dashboard',    label: 'Dashboard',       icon: LayoutDashboard },
  { id: 'calculator',   label: 'Calculadora',      icon: Calculator },
  { id: 'routes',       label: 'Meus roteiros',    icon: Map },
  { id: 'reports',      label: 'Relatórios',       icon: FileText },
  { id: 'ai-assistant', label: 'Assistente de IA', icon: Bot },
];

const ADMIN_ITEM = { id: 'admin', label: 'Admin', icon: Shield };

function NavItems({
  activePage,
  onNavigate,
  showLabels,
  isAdmin,
}: {
  activePage: string;
  onNavigate: (page: string) => void;
  showLabels: boolean;
  isAdmin: boolean;
}) {
  const items = isAdmin ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS;

  return (
    <>
      {items.map(item => {
        const Icon = item.icon;
        const isActive = activePage === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold',
              'transition-all duration-200',
              isActive
                ? 'bg-white/15 text-white shadow-lg shadow-black/10'
                : 'text-white/70 hover:bg-white/8 hover:text-white'
            )}
          >
            <Icon size={20} className="flex-shrink-0" />
            {showLabels && <span className="animate-fade-in">{item.label}</span>}
          </button>
        );
      })}
    </>
  );
}

export function Sidebar({ activePage, onNavigate, mobileOpen = false, onCloseMobile }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { profile } = useAuth();
  const isAdmin = profile?.is_admin === true;

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  function handleNavigate(page: string) {
    onNavigate(page);
    onCloseMobile?.();
  }

  return (
    <>
      {/* ── Mobile drawer overlay ── */}
      <div
        className={cn(
          'fixed inset-0 z-50 md:hidden transition-opacity duration-300',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40"
          onClick={onCloseMobile}
        />

        {/* Drawer */}
        <aside
          className={cn(
            'absolute top-0 left-0 h-full w-[280px] flex flex-col gradient-brand text-white',
            'transition-transform duration-300 ease-out shadow-2xl',
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {/* Header with close button */}
          <div className="flex items-center justify-between px-4 h-14 border-b border-white/10">
            <img
              src="/logo-precificatur.png"
              alt="PrecificaTur"
              className="h-7 object-contain"
            />
            <button
              onClick={onCloseMobile}
              className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
            <NavItems activePage={activePage} onNavigate={handleNavigate} showLabels isAdmin={isAdmin} />
          </nav>
        </aside>
      </div>

      {/* ── Desktop sidebar ── */}
      <aside
        className={cn(
          'hidden md:flex h-screen sticky top-0 flex-col gradient-brand text-white transition-all duration-300',
          collapsed ? 'w-[72px]' : 'w-[260px]'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-center px-4 h-16 border-b border-white/10">
          {collapsed ? (
            <img
              src="/LOGO-MOB2.png"
              alt="PrecificaTur"
              className="h-9 w-9 object-contain"
            />
          ) : (
            <img
              src="/logo-precificatur.png"
              alt="PrecificaTur"
              className="h-9 object-contain animate-fade-in"
            />
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          <NavItems activePage={activePage} onNavigate={onNavigate} showLabels={!collapsed} isAdmin={isAdmin} />
        </nav>

        {/* Collapse toggle */}
        <div className="px-3 pb-4">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl
                       text-white/50 hover:text-white hover:bg-white/8 transition-all text-xs"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            {!collapsed && <span>Recolher</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npx vite build --mode development 2>&1 | tail -5
```

Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: show Admin nav item in sidebar for is_admin users"
```

---

## Task 7: useAdminCodes Hook

**Files:**
- Create: `src/hooks/useAdminCodes.ts`

Context: This hook is only used in `AdminPage` (admin-only). It reads and writes the `access_codes` table directly (allowed by the admin RLS policy). Code format: `PREC-XXXX-XXXX` where X is `[A-Z2-9]` (no 0, O, 1, I for clarity).

- [ ] **Step 1: Create `src/hooks/useAdminCodes.ts`**

```typescript
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface AccessCode {
  id: string;
  code: string;
  status: 'active' | 'used' | 'expired' | 'revoked';
  expires_at: string | null;
  user_id: string | null;
  name: string | null;
  email: string | null;
  created_at: string;
}

// Characters that are visually unambiguous
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  const rand = (n: number) =>
    Array.from({ length: n }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
  return `PREC-${rand(4)}-${rand(4)}`;
}

export function useAdminCodes() {
  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCodes = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('access_codes')
      .select('*')
      .order('created_at', { ascending: false });
    setCodes((data as AccessCode[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCodes();
  }, [loadCodes]);

  async function createCode(expiresAt?: Date): Promise<string> {
    let code = generateCode();

    const { error } = await supabase
      .from('access_codes')
      .insert({ code, expires_at: expiresAt?.toISOString() ?? null });

    if (error?.code === '23505') {
      // UNIQUE conflict — try once more
      code = generateCode();
      const { error: error2 } = await supabase
        .from('access_codes')
        .insert({ code, expires_at: expiresAt?.toISOString() ?? null });
      if (error2) throw new Error('Falha ao gerar código único. Tente novamente.');
    } else if (error) {
      throw new Error('Erro ao criar código.');
    }

    await loadCodes();
    return code;
  }

  async function revokeCode(id: string): Promise<void> {
    await supabase
      .from('access_codes')
      .update({ status: 'revoked' })
      .eq('id', id);
    await loadCodes();
  }

  return { codes, loading, createCode, revokeCode };
}
```

- [ ] **Step 2: Verify build**

```bash
npx vite build --mode development 2>&1 | tail -5
```

Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAdminCodes.ts
git commit -m "feat: add useAdminCodes hook for admin code management"
```

---

## Task 8: AdminPage

**Files:**
- Create: `src/pages/AdminPage.tsx`
- Modify: `src/App.tsx` (replace admin placeholder with real `AdminPage`)

Context: Shows 4 stat cards (Total, Ativos, Usados, Expirados), a list of codes with status badges and actions, and an inline "Novo código" create panel.

- [ ] **Step 1: Create `src/pages/AdminPage.tsx`**

```typescript
import { useState } from 'react';
import { Shield, Copy, Check, Ban, Plus, Loader2, Calendar } from 'lucide-react';
import { useAdminCodes, type AccessCode } from '@/hooks/useAdminCodes';
import { cn } from '@/lib/utils';

const STATUS_BADGE: Record<AccessCode['status'], string> = {
  active:  'bg-emerald-100 text-emerald-700 border-emerald-200',
  used:    'bg-brand-blue/10 text-brand-blue border-brand-blue/20',
  expired: 'bg-red-100 text-red-600 border-red-200',
  revoked: 'bg-surface-200 text-surface-500 border-surface-300',
};

const STATUS_LABEL: Record<AccessCode['status'], string> = {
  active:  'Ativo',
  used:    'Usado',
  expired: 'Expirado',
  revoked: 'Revogado',
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-lg text-surface-400 hover:text-brand-navy hover:bg-surface-100 transition-all"
      title="Copiar"
    >
      {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
    </button>
  );
}

export function AdminPage() {
  const { codes, loading, createCode, revokeCode } = useAdminCodes();
  const [showCreate, setShowCreate] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [creating, setCreating] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const total   = codes.length;
  const active  = codes.filter(c => c.status === 'active').length;
  const used    = codes.filter(c => c.status === 'used').length;
  const expired = codes.filter(c => c.status === 'expired').length;

  async function handleCreate() {
    setCreating(true);
    setCreateError(null);
    setNewCode(null);
    try {
      const code = await createCode(expiresAt ? new Date(expiresAt) : undefined);
      setNewCode(code);
      setExpiresAt('');
    } catch (e) {
      setCreateError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center">
          <Shield size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-brand-navy">Admin</h1>
          <p className="text-sm text-surface-500">Gerencie os códigos de acesso beta</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',    value: total,   color: 'text-brand-navy' },
          { label: 'Ativos',   value: active,  color: 'text-emerald-600' },
          { label: 'Usados',   value: used,    color: 'text-brand-blue' },
          { label: 'Expirados',value: expired, color: 'text-red-500' },
        ].map(stat => (
          <div key={stat.label} className="card text-center py-4">
            <p className={cn('text-3xl font-extrabold', stat.color)}>{stat.value}</p>
            <p className="text-xs text-surface-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Create code */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-brand-navy">Códigos de acesso</h3>
          <button
            onClick={() => { setShowCreate(!showCreate); setNewCode(null); setCreateError(null); }}
            className="btn-primary btn-sm flex items-center gap-1.5"
          >
            <Plus size={16} /> Novo código
          </button>
        </div>

        {/* Create panel */}
        {showCreate && (
          <div className="mb-4 p-4 rounded-xl bg-surface-50 border border-surface-200 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="input-label flex items-center gap-1.5">
                  <Calendar size={12} /> Expiração (opcional)
                </label>
                <input
                  type="date"
                  className="input text-sm"
                  value={expiresAt}
                  onChange={e => setExpiresAt(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="btn-primary btn-sm"
              >
                {creating ? <Loader2 size={16} className="animate-spin" /> : 'Gerar código'}
              </button>
            </div>

            {createError && (
              <p className="text-xs text-red-500">{createError}</p>
            )}

            {newCode && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="font-mono font-bold text-emerald-700 tracking-widest flex-1">{newCode}</span>
                <CopyButton text={newCode} />
              </div>
            )}
          </div>
        )}

        {/* Code list */}
        {loading ? (
          <div className="flex items-center justify-center py-8 text-surface-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Carregando...
          </div>
        ) : codes.length === 0 ? (
          <p className="text-center text-sm text-surface-400 py-8">
            Nenhum código criado ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {codes.map(c => (
              <div
                key={c.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 border border-surface-100 flex-wrap"
              >
                {/* Code */}
                <div className="flex items-center gap-1 min-w-[140px]">
                  <span className="font-mono font-bold text-sm text-brand-navy tracking-wider">{c.code}</span>
                  <CopyButton text={c.code} />
                </div>

                {/* Status badge */}
                <span className={cn(
                  'text-[11px] font-bold px-2 py-0.5 rounded-full border',
                  STATUS_BADGE[c.status]
                )}>
                  {STATUS_LABEL[c.status]}
                </span>

                {/* Expiry */}
                <span className="text-xs text-surface-500 flex-1">
                  {c.expires_at
                    ? new Date(c.expires_at).toLocaleDateString('pt-BR')
                    : 'Sem expiração'}
                </span>

                {/* User */}
                <span className="text-xs text-surface-600 max-w-[200px] truncate">
                  {c.name ? `${c.name} · ${c.email}` : '—'}
                </span>

                {/* Revoke */}
                {(c.status === 'active' || c.status === 'used') && (
                  <button
                    onClick={() => revokeCode(c.id)}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700
                               px-2 py-1 rounded-lg hover:bg-red-50 transition-all border border-red-200 flex-shrink-0"
                  >
                    <Ban size={12} /> Revogar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `src/App.tsx` — replace admin placeholder with real `AdminPage`**

Add the import at the top:
```typescript
import { AdminPage } from '@/pages/AdminPage';
```

Replace the admin case in `renderPage`:
```typescript
case 'admin':
  // Return DashboardPage directly for non-admins — do NOT call setActivePage here
  if (!profile?.is_admin) {
    return <DashboardPage onNavigate={setActivePage} />;
  }
  return <AdminPage />;
```

- [ ] **Step 3: Verify build**

```bash
npx vite build --mode development 2>&1 | tail -5
```

Expected: clean build with no TypeScript errors.

- [ ] **Step 4: End-to-end smoke test**

Run `npm run dev` and verify:
1. App opens at `AccessCodePage` (code input screen)
2. Enter `PREC-TEST-0001` → advances to registration form
3. Fill name + email → creates account, enters the app
4. Sidebar shows no "Admin" item for regular users
5. In Supabase SQL editor, set `is_admin = true` for your test user:
   ```sql
   UPDATE profiles SET is_admin = true WHERE email = 'your@email.com';
   ```
6. Refresh app — "Admin" item appears in sidebar
7. Click Admin → see stats (Total: 1, Ativos: 0, Usados: 1) and the test code in the list
8. Click "Novo código" → generate a code → it appears in the list
9. Click "Revogar" on an active code → status changes to Revogado
10. Sign out via browser console: `supabase.auth.signOut()` or add a sign-out button temporarily
11. Enter the same code → should sign in directly (returning user flow)

- [ ] **Step 5: Commit**

```bash
git add src/pages/AdminPage.tsx src/App.tsx
git commit -m "feat: add AdminPage with code stats, list, create, and revoke"
```

---

## Verification Checklist

After all tasks are complete:

- [ ] `PREC-TEST-0001` — first access creates account and enters app
- [ ] Same code on second visit → direct login (no registration form)
- [ ] Invalid code → "Código inválido." error
- [ ] Non-admin user → no Admin sidebar item
- [ ] Admin user → Admin sidebar item visible
- [ ] Admin can create, copy, and revoke codes
- [ ] Stats cards reflect correct counts
- [ ] Build passes: `npx vite build --mode development`
