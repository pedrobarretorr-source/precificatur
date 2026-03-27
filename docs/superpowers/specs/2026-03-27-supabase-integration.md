# Supabase App Integration — Design Spec
**Date:** 2026-03-27
**Status:** Approved

## Overview

Wire `@supabase/supabase-js` into the React app, replacing stub auth with real Supabase Auth (email/password + Google + Facebook OAuth) and replacing `MOCK_ROUTES` with persistent route storage via Supabase. Uses an `AuthContext` + `useRoutes` hook architecture to keep components decoupled from Supabase internals.

---

## Section 1: Project Setup

### Dependencies
- Install: `@supabase/supabase-js`

### Environment Variables
- `.env` (gitignored): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `.env.example` (versioned): same keys with placeholder values

### Supabase Client
**File:** `src/lib/supabase.ts`

Singleton client created with `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)`. Imported by context and hooks — never by components directly.

---

## Section 2: AuthContext

**File:** `src/contexts/AuthContext.tsx`

### State
| Field | Type | Description |
|-------|------|-------------|
| `user` | `User \| null` | Supabase auth user |
| `session` | `Session \| null` | Current session |
| `loading` | `boolean` | True while Supabase verifies existing session on mount |

### Exposed Functions
| Function | Supabase call |
|----------|--------------|
| `signIn(email, password)` | `supabase.auth.signInWithPassword` |
| `signUp(email, password, fullName)` | `supabase.auth.signUp` with `data: { full_name }` |
| `signOut()` | `supabase.auth.signOut` |
| `signInWithOAuth(provider)` | `supabase.auth.signInWithOAuth` with `redirectTo: window.location.origin` |

### Behavior
- `onAuthStateChange` listener set on mount, cleaned up on unmount
- `loading: true` until first auth state event fires — prevents login flash on page refresh
- Provider wraps entire app in `App.tsx`

### Hook
```ts
export function useAuth() {
  return useContext(AuthContext);
}
```

---

## Section 3: App.tsx Changes

- Remove `const [isAuthenticated, setIsAuthenticated] = useState(false)`
- Wrap tree in `<AuthProvider>`
- Use `const { user, loading } = useAuth()`
- Show loading spinner while `loading === true`
- Show `<AuthPage />` when `user === null`
- Show main app when `user !== null`
- Remove `onLogin` prop from `AuthPage`

---

## Section 4: AuthPage — Supabase Wiring

**File:** `src/pages/AuthPage.tsx` (modify existing)

### Login
`handleLogin()` → `signIn(loginEmail, loginPassword)` → on error, map to Portuguese:

| Supabase message | Portuguese |
|------------------|-----------|
| `Invalid login credentials` | "E-mail ou senha incorretos" |
| `Email not confirmed` | "Confirme seu e-mail antes de entrar" |
| Default | "Erro ao autenticar. Tente novamente." |

### Register
`handleRegister()` → `signUp(email, password, name)` → on success (no error), show inline success message: "Verifique seu e-mail para confirmar o cadastro." — do NOT redirect yet (user must confirm email).

On error:
| Supabase message | Portuguese |
|------------------|-----------|
| `User already registered` | "Este e-mail já está cadastrado" |
| Default | "Erro ao criar conta. Tente novamente." |

### Social Login
`handleSocialLogin(provider)` → `signInWithOAuth({ provider, options: { redirectTo: window.location.origin } })` — no loading spinner needed (browser navigates away).

### Removed
- `onLogin: () => void` prop — auth state is reactive via `AuthContext`
- `setTimeout(() => onLogin())` stubs

---

## Section 5: useRoutes Hook

**File:** `src/hooks/useRoutes.ts`

### State
| Field | Type |
|-------|------|
| `routes` | `Route[]` |
| `saving` | `boolean` |
| `error` | `string \| null` |

### Functions

**`loadRoutes()`** — called on mount:
```ts
supabase.from('routes').select('*').order('updated_at', { ascending: false })
```
RLS ensures only the user's org routes are returned.

**`saveRoute(route: Route)`** — upsert:
```ts
supabase.from('routes').upsert(toDbRow(route), { onConflict: 'id' })
```
Sets `saving: true` before, `saving: false` after. Used by both explicit save and auto-save.

**`deleteRoute(id: string)`**:
```ts
supabase.from('routes').delete().eq('id', id)
```
Updates local `routes` state optimistically.

### Auto-save
`useEffect` on `activeRoute` state with 1.5s debounce — calls `saveRoute(activeRoute)` after pause. Cleanup cancels pending debounce on unmount.

### Type Mapping
`toDbRow(route: Route)` — converts `Route` to DB columns:
- `fixed_costs`, `variable_costs`, `days` → JSONB (already objects, no transformation needed)
- `isPercentage` field **not saved** — derived from `variable_cost.type === 'percentage'` on load via `fromDbRow(row)`
- `organization_id` pulled from `user.app_metadata.organization_id` or fetched from `organization_members` table on first use

### `fromDbRow(row)` — converts DB row back to `Route`:
- Parses JSONB columns
- Derives `isPercentage` from `type` field on each `VariableCost`

---

## Section 6: RoutesPage Changes

**File:** `src/pages/RoutesPage.tsx` (modify existing)

- Remove `MOCK_ROUTES` import
- Add `const { routes, deleteRoute, saving } = useRoutes()`
- Show loading skeleton while `routes` is loading
- Show "Salvando..." indicator when `saving: true`
- Wire delete buttons to `deleteRoute(id)`

---

## Section 7: CalculatorPage Changes

**File:** `src/pages/CalculatorPage.tsx` (modify existing)

- Import `useRoutes`
- Explicit "Salvar roteiro" button → calls `saveRoute(currentRoute)` immediately (bypasses debounce)
- Auto-save wired via `useEffect` on calculator state changes with 1.5s debounce

---

## Files Changed

| File | Change |
|------|--------|
| `package.json` | Add `@supabase/supabase-js` |
| `.env` | New (gitignored) |
| `.env.example` | New (versioned) |
| `src/lib/supabase.ts` | New |
| `src/contexts/AuthContext.tsx` | New |
| `src/hooks/useRoutes.ts` | New |
| `src/App.tsx` | Wrap in AuthProvider, reactive auth |
| `src/pages/AuthPage.tsx` | Wire real Supabase auth calls |
| `src/pages/RoutesPage.tsx` | Replace MOCK_ROUTES with useRoutes |
| `src/pages/CalculatorPage.tsx` | Add saveRoute + auto-save |

---

## Out of Scope

- "Esqueci minha senha" flow (button present, no action)
- Profile page / user settings
- Organization member management UI
- Offline support / optimistic updates beyond delete
- Error retry logic
