# Supabase App Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Supabase Auth (email/password + OAuth) and route persistence into the existing React app, replacing stub handlers and MOCK_ROUTES with live Supabase calls.

**Architecture:** `AuthContext` (React Context + `onAuthStateChange`) owns auth state app-wide. `useRoutes` hook handles org-scoped route CRUD with `toDbRow`/`fromDbRow` type mappers. `CalculatorPage` auto-saves to Supabase with a 1.5s debounce.

**Tech Stack:** React 18, TypeScript, Vite, `@supabase/supabase-js`, Tailwind CSS

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `package.json` | Modify | Add `@supabase/supabase-js` |
| `.env` | Create | Supabase URL + anon key (gitignored) |
| `.env.example` | Create | Placeholder env vars (versioned) |
| `supabase/migrations/20260327000001_routes_fix.sql` | Create | Fix `route_type` CHECK + add `metadata` column |
| `src/lib/supabase.ts` | Create | Singleton Supabase client |
| `src/contexts/AuthContext.tsx` | Create | Auth state, signIn/signUp/signOut/OAuth |
| `src/hooks/useRoutes.ts` | Create | Route CRUD, toDbRow/fromDbRow, org resolution |
| `src/App.tsx` | Modify | AuthProvider wrapper + RoutesPage routing |
| `src/pages/AuthPage.tsx` | Modify | Real Supabase auth calls, remove onLogin prop |
| `src/pages/RoutesPage.tsx` | Modify | useRoutes instead of MOCK_ROUTES |
| `src/pages/CalculatorPage.tsx` | Modify | routeId state + saveRoute + auto-save |

---

## ⚠️ Pre-requisites (manual steps before running tasks)

Before starting Task 1, the developer needs:

1. **Supabase project credentials:** Go to your Supabase project → Settings → API. Copy "Project URL" and "anon public" key.

2. **OAuth providers (before testing Task 5):** In Supabase dashboard:
   - Authentication → Providers → enable Google (need Google OAuth client ID + secret)
   - Authentication → Providers → enable Facebook (need Facebook app ID + secret)
   - Authentication → URL Configuration → Redirect URLs: add `http://localhost:5173`

---

## Task 1: Project Setup — Install + Supabase Client

**Files:**
- Modify: `package.json`
- Create: `.env`
- Create: `.env.example`
- Create: `src/lib/supabase.ts`

- [ ] **Step 1: Install `@supabase/supabase-js`**

```bash
npm install @supabase/supabase-js
```

Expected: package installs, version appears in `package.json` dependencies.

- [ ] **Step 2: Create `.env`**

Create `C:\Users\USUARIO\Desktop\PRECIFICATUR-MVP\.env` with your actual Supabase credentials:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Replace with real values from Supabase Settings → API.

- [ ] **Step 3: Create `.env.example`**

Create `C:\Users\USUARIO\Desktop\PRECIFICATUR-MVP\.env.example`:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

- [ ] **Step 4: Verify `.env` is gitignored**

Check that `.gitignore` contains `.env`. If it does not exist yet, create `.gitignore` with:
```
.env
node_modules/
dist/
```

- [ ] **Step 5: Create `src/lib/supabase.ts`**

```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npm run build
```

Expected: build succeeds (or fails only on pre-existing errors unrelated to this file).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .env.example src/lib/supabase.ts .gitignore
git commit -m "feat: add @supabase/supabase-js and create singleton client"
```

---

## Task 2: Second Migration — route_type Fix + metadata Column

**Files:**
- Create: `supabase/migrations/20260327000001_routes_fix.sql`

The first migration (`20260327000000_initial_schema.sql`) defined a `route_type` CHECK constraint with values that don't match the frontend `RouteType` union. This task fixes that and adds a `metadata jsonb` column for frontend fields that have no dedicated DB column.

- [ ] **Step 1: Create the migration file**

Create `C:\Users\USUARIO\Desktop\PRECIFICATUR-MVP\supabase\migrations\20260327000001_routes_fix.sql`:

```sql
BEGIN;

-- Fix route_type values to match frontend RouteType
-- (first migration had: ecologico, religioso, historico, personalizado)
-- (frontend has:        trilha, expedicao, passeio_barco, outro)
ALTER TABLE public.routes
  DROP CONSTRAINT IF EXISTS routes_route_type_check;
ALTER TABLE public.routes
  ADD CONSTRAINT routes_route_type_check
  CHECK (route_type IN (
    'city_tour', 'trilha', 'expedicao', 'passeio_barco',
    'cultural', 'aventura', 'gastronomico', 'outro'
  ));

-- Add metadata column for frontend fields without dedicated DB columns
-- Stores: client, date, contact, notes, isMultiDay
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';

COMMIT;
```

- [ ] **Step 2: Run the migration in Supabase SQL Editor**

1. Open Supabase dashboard → SQL Editor
2. Paste the entire contents of `20260327000001_routes_fix.sql`
3. Click "Run"
4. Expected result: `Success. No rows returned`

- [ ] **Step 3: Verify in Table Editor**

Open Supabase dashboard → Table Editor → routes table. Confirm:
- A `metadata` column exists with type `jsonb`
- Constraints panel shows the updated `route_type` CHECK values

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260327000001_routes_fix.sql
git commit -m "feat: migration — fix route_type constraint and add metadata column"
```

---

## Task 3: AuthContext

**Files:**
- Create: `src/contexts/AuthContext.tsx`

- [ ] **Step 1: Create the directory (if it doesn't exist)**

Verify `src/contexts/` exists. Create it if not.

- [ ] **Step 2: Create `src/contexts/AuthContext.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  signInWithOAuth: (provider: 'google' | 'facebook') => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Hydrate from existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Keep state in sync with Supabase auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  }

  async function signUp(email: string, password: string, fullName: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return { error: error as Error | null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function signInWithOAuth(provider: 'google' | 'facebook') {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, signInWithOAuth }}>
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

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: no TypeScript errors from this file.

- [ ] **Step 4: Commit**

```bash
git add src/contexts/AuthContext.tsx src/lib/supabase.ts
git commit -m "feat: add AuthContext with Supabase auth integration"
```

---

## Task 4: Wire App.tsx

**Files:**
- Modify: `src/App.tsx`

Current `App.tsx` (53 lines) uses a boolean `isAuthenticated` state and a `setTimeout` stub. Replace with `AuthProvider` + reactive auth state.

- [ ] **Step 1: Replace `src/App.tsx` entirely**

```tsx
import { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { DashboardPage } from '@/pages/DashboardPage';
import { CalculatorPage } from '@/pages/CalculatorPage';
import { RoutesPage } from '@/pages/RoutesPage';
import { AiAssistantPage } from '@/pages/AiAssistantPage';
import { AuthPage } from '@/pages/AuthPage';
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
  const { user, loading } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-100">
        <div className="text-surface-400 text-sm">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
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
      default:
        return <DashboardPage onNavigate={setActivePage} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-surface-100">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <main className="flex-1 p-6 lg:p-8 max-w-6xl">
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

Note: `AuthPage` no longer receives `onLogin` prop — it will be updated in Task 5.

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: TypeScript error about `AuthPage` missing `onLogin` prop — this is expected and will be resolved in Task 5. If there are other errors, fix them first.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire AuthProvider and reactive auth into App.tsx"
```

---

## Task 5: Wire AuthPage to Supabase

**Files:**
- Modify: `src/pages/AuthPage.tsx`

Current file (lines 6–87) has: `AuthPageProps` interface, `onLogin` prop, three `setTimeout` stubs. Remove all of those and replace with real Supabase calls.

- [ ] **Step 1: Add imports and remove prop**

Replace the top of the file (lines 1–10):

**Before:**
```tsx
import { useState } from 'react';
import {
  Mail, Lock, User, Eye, EyeOff, ArrowRight, AlertCircle, Check
} from 'lucide-react';

interface AuthPageProps {
  onLogin: () => void;
}

export function AuthPage({ onLogin }: AuthPageProps) {
```

**After:**
```tsx
import { useState } from 'react';
import {
  Mail, Lock, User, Eye, EyeOff, ArrowRight, AlertCircle, Check
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function AuthPage() {
  const { signIn, signUp, signInWithOAuth } = useAuth();
```

- [ ] **Step 2: Add `registerSuccess` state**

After the existing state declarations (after line `const [errors, setErrors] = useState<Record<string, string>>({});`), add:

```tsx
const [registerSuccess, setRegisterSuccess] = useState(false);
```

- [ ] **Step 3: Replace `handleLogin`**

**Before (lines 58–67):**
```tsx
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
```

**After:**
```tsx
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
  // On success: AuthContext updates user → App.tsx re-renders automatically
};
```

- [ ] **Step 4: Replace `handleRegister`**

**Before (lines 69–78):**
```tsx
const handleRegister = (e: React.FormEvent) => {
  e.preventDefault();
  if (!validateRegister()) return;
  setLoading(true);
  // TODO: Integrar com backend (Supabase)
  setTimeout(() => {
    setLoading(false);
    onLogin();
  }, 800);
};
```

**After:**
```tsx
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
```

- [ ] **Step 5: Replace `handleSocialLogin`**

**Before (lines 80–87):**
```tsx
const handleSocialLogin = (_provider: 'google' | 'facebook') => {
  setLoading(true);
  // TODO: Integrar OAuth com Google/Facebook via Supabase
  setTimeout(() => {
    setLoading(false);
    onLogin();
  }, 800);
};
```

**After:**
```tsx
const handleSocialLogin = async (provider: 'google' | 'facebook') => {
  await signInWithOAuth(provider);
  // Browser navigates away — no state update needed
};
```

- [ ] **Step 6: Add register success message to the register form**

Find the register form's submit button area. Just before `</form>` in the register tab, add this block after the CTA button:

```tsx
{registerSuccess && (
  <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
    <Check size={16} className="mt-0.5 flex-shrink-0 text-emerald-500" />
    <span>Verifique seu e-mail para confirmar o cadastro.</span>
  </div>
)}
```

- [ ] **Step 7: Verify build**

```bash
npm run build
```

Expected: no TypeScript errors. The `onLogin` prop removal in Task 4 and its removal here should now be consistent.

- [ ] **Step 8: Manual smoke test**

```bash
npm run dev
```

1. Open `http://localhost:5173`
2. The auth page should appear
3. Try to log in with wrong credentials — should show "E-mail ou senha incorretos"
4. Try to register with a new email — should show "Verifique seu e-mail para confirmar o cadastro."
5. After email confirmation, log in — should enter the app

- [ ] **Step 9: Commit**

```bash
git add src/pages/AuthPage.tsx
git commit -m "feat: wire AuthPage to Supabase auth (email/password + OAuth)"
```

---

## Task 6: useRoutes Hook

**Files:**
- Create: `src/hooks/useRoutes.ts`

- [ ] **Step 1: Create `src/hooks/` directory** (if it doesn't exist)

- [ ] **Step 2: Create `src/hooks/useRoutes.ts`**

```ts
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Route, RouteType, Currency } from '@/types';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbRow = Record<string, any>;

function toDbRow(
  route: Partial<Route> & { id: string },
  orgId: string,
  userId: string,
): DbRow {
  return {
    id: route.id,
    organization_id: orgId,
    created_by: userId,
    name: route.name || 'Sem nome',
    destination: route.region ?? '',
    route_type: route.type ?? 'outro',
    currency: route.currency ?? 'BRL',
    exchange_rate: 1.0,
    duration_days: Math.max(1, route.days?.length ?? 1),
    fixed_costs: route.fixedCosts ?? [],
    variable_costs: route.variableCosts ?? [],
    days: route.days ?? [],
    updated_at: new Date().toISOString(),
    metadata: {
      client: route.client ?? '',
      date: route.date ?? '',
      contact: route.contact ?? '',
      notes: route.notes ?? '',
      isMultiDay: route.isMultiDay ?? false,
    },
  };
}

function fromDbRow(row: DbRow): Route {
  const meta: DbRow = row.metadata ?? {};
  return {
    id: row.id as string,
    name: (row.name as string) || '',
    region: (row.destination as string) || '',
    type: (row.route_type as RouteType) || 'outro',
    currency: (row.currency as Currency) || 'BRL',
    fixedCosts: (row.fixed_costs as Route['fixedCosts']) || [],
    variableCosts: (row.variable_costs as Route['variableCosts']) || [],
    days: (row.days as Route['days']) || [],
    updatedAt: (row.updated_at as string) || '',
    createdAt: (row.created_at as string) || '',
    client: (meta.client as string) || '',
    date: (meta.date as string) || '',
    contact: (meta.contact as string) || '',
    notes: (meta.notes as string) || '',
    isMultiDay: (meta.isMultiDay as boolean) || false,
    estimatedPrice: 0, // always recomputed by pricing engine; never persisted
  };
}

export function useRoutes() {
  const { user } = useAuth();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const orgIdRef = useRef<string | null>(null);

  const loadRoutes = useCallback(async (orgId: string) => {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('routes')
      .select('*')
      .eq('organization_id', orgId)
      .order('updated_at', { ascending: false });

    if (fetchError) {
      setError('Erro ao carregar roteiros.');
    } else {
      setRoutes((data ?? []).map((row) => fromDbRow(row as DbRow)));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;

    async function init() {
      const { data: memberData, error: memberError } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user!.id)
        .single();

      if (memberError || !memberData?.organization_id) {
        setError('Organização não encontrada. Contate o suporte.');
        setLoading(false);
        return;
      }

      orgIdRef.current = memberData.organization_id as string;
      await loadRoutes(memberData.organization_id as string);
    }

    init();
  }, [user, loadRoutes]);

  const saveRoute = useCallback(
    async (route: Partial<Route> & { id: string }) => {
      const orgId = orgIdRef.current;
      if (!orgId || !user) return;

      setSaving(true);
      const { data, error: upsertError } = await supabase
        .from('routes')
        .upsert(toDbRow(route, orgId, user.id), { onConflict: 'id' })
        .select()
        .single();

      if (upsertError) {
        setError('Erro ao salvar roteiro.');
      } else if (data) {
        const saved = fromDbRow(data as DbRow);
        setRoutes((prev) => {
          const idx = prev.findIndex((r) => r.id === saved.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = saved;
            return next;
          }
          return [saved, ...prev];
        });
      }
      setSaving(false);
    },
    [user],
  );

  const deleteRoute = useCallback(
    async (id: string) => {
      // Optimistic: remove immediately from local state
      setRoutes((prev) => prev.filter((r) => r.id !== id));

      const { error: deleteError } = await supabase
        .from('routes')
        .delete()
        .eq('id', id);

      if (deleteError) {
        setError('Erro ao excluir roteiro.');
        // Re-fetch to restore consistent state
        if (orgIdRef.current) await loadRoutes(orgIdRef.current);
      }
    },
    [loadRoutes],
  );

  return { routes, loading, saving, error, saveRoute, deleteRoute };
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: no TypeScript errors from this file.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useRoutes.ts
git commit -m "feat: add useRoutes hook with Supabase CRUD and type mappers"
```

---

## Task 7: Wire RoutesPage

**Files:**
- Modify: `src/pages/RoutesPage.tsx`

Current file uses `MOCK_ROUTES` from `@/data/mock-routes`. Replace with `useRoutes`.

- [ ] **Step 1: Replace the import and add hook**

**Before (lines 1–2):**
```tsx
import { Map, Calendar, User, Copy, Calculator, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { MOCK_ROUTES } from '@/data/mock-routes';
```

**After:**
```tsx
import { Map, Calendar, User, Copy, Calculator, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { useRoutes } from '@/hooks/useRoutes';
```

Note: Remove the `Target` import (unused); add `Loader2` for the loading spinner.

- [ ] **Step 2: Add hook and state inside the component**

**Before:**
```tsx
export function RoutesPage({ onNavigate }: RoutesPageProps) {
  return (
```

**After:**
```tsx
export function RoutesPage({ onNavigate }: RoutesPageProps) {
  const { routes, loading, saving, error, deleteRoute } = useRoutes();

  return (
```

- [ ] **Step 3: Add loading and error states above the route cards**

Replace the `{/* Route cards */}` section:

**Before:**
```tsx
{/* Route cards */}
<div className="space-y-5">
  {MOCK_ROUTES.map(route => (
    <RouteCard key={route.id} route={route} onNavigate={onNavigate} />
  ))}
</div>
```

**After:**
```tsx
{/* Saving indicator */}
{saving && (
  <p className="text-xs text-surface-400 flex items-center gap-1">
    <Loader2 size={12} className="animate-spin" /> Salvando...
  </p>
)}

{/* Error */}
{error && (
  <p className="text-red-500 text-sm">{error}</p>
)}

{/* Route cards */}
<div className="space-y-5">
  {loading ? (
    <div className="flex items-center justify-center py-12 text-surface-400">
      <Loader2 size={24} className="animate-spin mr-2" /> Carregando roteiros...
    </div>
  ) : routes.length === 0 ? (
    <div className="text-center py-12 text-surface-400 text-sm">
      Nenhum roteiro salvo ainda. Use a calculadora para criar e salvar um roteiro.
    </div>
  ) : (
    routes.map(route => (
      <RouteCard key={route.id} route={route} onNavigate={onNavigate} onDelete={deleteRoute} />
    ))
  )}
</div>
```

- [ ] **Step 4: Update `RouteCard` to accept and wire `onDelete`**

**Before:**
```tsx
function RouteCard({ route, onNavigate }: { route: Route; onNavigate: (page: string) => void }) {
```

**After:**
```tsx
function RouteCard({ route, onNavigate, onDelete }: {
  route: Route;
  onNavigate: (page: string) => void;
  onDelete: (id: string) => void;
}) {
```

Find the "Duplicar" button inside `RouteCard` and add a delete button next to it:

```tsx
<button
  onClick={() => onDelete(route.id)}
  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-red-200 text-red-500 text-xs font-bold hover:border-red-300 transition-all"
>
  Excluir
</button>
```

Also remove the `alert('Duplicar roteiro — integração pendente')` — keep the "Duplicar" button but it can remain a stub for now (or remove it, YAGNI).

- [ ] **Step 5: Remove the "em desenvolvimento" note**

In the "Como reaproveitar um roteiro" card at the bottom, remove:
```tsx
<p className="text-[10px] text-brand-navy-400 mt-3">
  Integração com banco de dados via Supabase — em desenvolvimento.
</p>
```

- [ ] **Step 6: Verify build**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/RoutesPage.tsx
git commit -m "feat: wire RoutesPage to useRoutes (replaces MOCK_ROUTES)"
```

---

## Task 8: CalculatorPage Auto-Save

**Files:**
- Modify: `src/pages/CalculatorPage.tsx`

- [ ] **Step 1: Update imports**

**Before (line 1):**
```tsx
import { useState, useMemo } from 'react';
```

**After:**
```tsx
import { useState, useMemo, useEffect, useRef } from 'react';
```

Add below the existing imports (after the last import line):

```tsx
import { useRoutes } from '@/hooks/useRoutes';
import type { RouteType, Currency } from '@/types';
```

- [ ] **Step 2: Add `routeId` and `createdAt` state + hook**

After the existing state declarations (after `const [maxPax, setMaxPax] = useState(50);`), add:

```tsx
// Persistent route identity for this calculator session
const [routeId] = useState<string>(() => crypto.randomUUID());
const [routeCreatedAt] = useState<string>(() => new Date().toISOString());

const { saveRoute, saving } = useRoutes();
```

Note: `useState(() => ...)` with an initializer function ensures these values are set once on mount and never change.

- [ ] **Step 3: Add `buildCurrentRoute` helper**

After the `keyScenarios` useMemo (around line 110), add:

```tsx
// Assembles the Route object from current calculator state for persistence
function buildCurrentRoute() {
  return {
    id: routeId,
    name: routeName || 'Sem nome',
    client,
    date,
    contact: '' as string,
    notes: '' as string,
    region: '' as string,
    type: 'outro' as RouteType,
    fixedCosts,
    variableCosts: varCosts,
    estimatedPrice: effectivePrice,
    currency: 'BRL' as Currency,
    days: [],
    isMultiDay: false,
    createdAt: routeCreatedAt,
    updatedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Add auto-save `useEffect` with debounce**

After `buildCurrentRoute`, add:

```tsx
// Auto-save: fires 1.5s after any change to key calculator state
const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  if (debounceRef.current) clearTimeout(debounceRef.current);
  debounceRef.current = setTimeout(() => {
    saveRoute(buildCurrentRoute());
  }, 1500);
  return () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [fixedCosts, varCosts, effectivePrice, routeName, client, date]);
```

Note: `buildCurrentRoute` is not in the dependency array to avoid infinite loops — it always reads the latest state at call time via closure.

- [ ] **Step 5: Add saving indicator to the wizard progress bar**

Find the progress bar section (around line 167) where the step labels are rendered. After the closing `</div>` of the steps row and before the step card `<div className="card mb-5 ...">`, add:

```tsx
{/* Auto-save indicator */}
{saving && (
  <p className="text-center text-xs text-surface-400 mb-3 -mt-4">
    Salvando...
  </p>
)}
```

- [ ] **Step 6: Wire the explicit save button**

Find the save button (around line 675):

**Before:**
```tsx
<button
  onClick={() => alert('Roteiro salvo! (integração Supabase pendente)')}
  className="btn btn-secondary flex items-center gap-2 text-sm"
>
  <Save size={16} /> Salvar roteiro
</button>
```

**After:**
```tsx
<button
  onClick={() => saveRoute(buildCurrentRoute())}
  disabled={saving}
  className="btn btn-secondary flex items-center gap-2 text-sm disabled:opacity-60"
>
  {saving ? (
    <>Salvando...</>
  ) : (
    <><Save size={16} /> Salvar roteiro</>
  )}
</button>
```

- [ ] **Step 7: Verify build**

```bash
npm run build
```

Expected: clean build with no TypeScript errors.

- [ ] **Step 8: Manual smoke test**

```bash
npm run dev
```

1. Log in to the app
2. Navigate to Calculator
3. Enter a route name and add a fixed cost
4. Wait 1.5 seconds — "Salvando..." should briefly appear above the progress bar
5. Navigate to "Meus roteiros" — the route should appear in the list
6. Return to Calculator, click "Salvar roteiro" button — "Salvando..." should appear on the button
7. Back to "Meus roteiros" — confirm route is there, click "Excluir" — route disappears

- [ ] **Step 9: Commit**

```bash
git add src/pages/CalculatorPage.tsx
git commit -m "feat: add auto-save and explicit save to CalculatorPage via useRoutes"
```

---

## Post-Implementation Checklist

- [ ] All 8 tasks committed
- [ ] `npm run build` passes clean
- [ ] Login with email/password works end-to-end
- [ ] Registration triggers email confirmation
- [ ] Routes persist across sessions (reload and verify routes still appear)
- [ ] Delete route works
- [ ] Auto-save fires after 1.5s of inactivity
- [ ] `.env` is not tracked in git (`git status` should not show `.env`)
