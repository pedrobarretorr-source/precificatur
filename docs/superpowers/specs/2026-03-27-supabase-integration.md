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

### OAuth Setup (required before OAuth works)
The implementor must configure the following in the Supabase dashboard:
1. **Authentication → URL Configuration → Redirect URLs:** whitelist `http://localhost:5173` (dev) and the production URL
2. **Authentication → Providers:** enable Google and Facebook, providing their respective client IDs and secrets

Without both steps, all OAuth flows fail regardless of correct code.

### Hook
```ts
export function useAuth() {
  return useContext(AuthContext);
}
```

---

## Section 3: App.tsx Changes

- Remove `const [isAuthenticated, setIsAuthenticated] = useState(false)`
- Wrap tree in `<AuthProvider>` (import from `src/contexts/AuthContext`)
- Use `const { user, loading } = useAuth()` inside `App`
- Show loading spinner while `loading === true`
- Show `<AuthPage />` when `user === null`
- Show main app layout when `user !== null`
- Remove `onLogin` prop from `AuthPage`
- Update `routes` case in `renderPage()`:
  ```tsx
  case 'routes':
    return <RoutesPage onNavigate={setActivePage} />;
  ```
  Import `RoutesPage` from `src/pages/RoutesPage`

---

## Section 4: AuthPage — Supabase Wiring

**File:** `src/pages/AuthPage.tsx` (modify existing)

### Login
`handleLogin()` → `signIn(loginEmail, loginPassword)` → on error, map to Portuguese:

| Supabase error message contains | Portuguese |
|--------------------------------|-----------|
| `Invalid login credentials` | "E-mail ou senha incorretos" |
| `Email not confirmed` | "Confirme seu e-mail antes de entrar" |
| *(default)* | "Erro ao autenticar. Tente novamente." |

### Register
`handleRegister()` → `signUp(email, password, name)` → on success (no error), show inline success message: "Verifique seu e-mail para confirmar o cadastro." — do NOT redirect (user must confirm email first).

On error:
| Supabase error message contains | Portuguese |
|--------------------------------|-----------|
| `User already registered` | "Este e-mail já está cadastrado" |
| *(default)* | "Erro ao criar conta. Tente novamente." |

### Social Login
`handleSocialLogin(provider)` → `signInWithOAuth({ provider, options: { redirectTo: window.location.origin } })` — no loading spinner (browser navigates away immediately).

### Removed
- The `AuthPageProps` interface and `onLogin: () => void` prop — remove both the interface definition and the destructured parameter from the function signature
- `setTimeout(() => onLogin())` stubs

---

## Section 5: Schema Migration — fixes and metadata

A second migration handles two things: (1) aligns the `route_type` CHECK constraint with the frontend's `RouteType` values, and (2) adds a `metadata` column for frontend fields that have no dedicated DB column.

**Migration file:** `supabase/migrations/20260327000001_routes_fix.sql`

```sql
BEGIN;

-- Fix route_type values to match frontend RouteType
ALTER TABLE public.routes
  DROP CONSTRAINT IF EXISTS routes_route_type_check;
ALTER TABLE public.routes
  ADD CONSTRAINT routes_route_type_check
  CHECK (route_type IN (
    'city_tour', 'trilha', 'expedicao', 'passeio_barco',
    'cultural', 'aventura', 'gastronomico', 'outro'
  ));

-- Add metadata column for frontend fields without dedicated DB columns
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';

COMMIT;
```

`metadata` stores:
```json
{
  "client": "...",
  "date": "...",
  "contact": "...",
  "notes": "...",
  "isMultiDay": false
}
```

`region` maps to the existing `destination` column (see mapping table in Section 6).

The implementor must run this migration in the Supabase SQL Editor before testing route save/load.

---

## Section 6: useRoutes Hook

**File:** `src/hooks/useRoutes.ts`

### State
| Field | Type | Description |
|-------|------|-------------|
| `routes` | `Route[]` | All routes for the user's org |
| `loading` | `boolean` | True while initial fetch is in progress |
| `saving` | `boolean` | True during upsert |
| `error` | `string \| null` | Last error message, null if none |

### Organization ID Resolution
On hook mount, after `user` is confirmed non-null, query `organization_members` once:
```ts
const { data } = await supabase
  .from('organization_members')
  .select('organization_id')
  .eq('user_id', user.id)
  .single();
const orgId = data?.organization_id ?? null;
```
Cache the result in a `useRef<string | null>` inside the hook. If `orgId` is null after the query (trigger failed), set `error: 'Organização não encontrada. Contate o suporte.'` and skip all subsequent DB operations.

### Functions

**`loadRoutes()`** — called on mount after `orgId` is resolved:
```ts
supabase
  .from('routes')
  .select('*')
  .eq('organization_id', orgId)   // defense-in-depth; RLS also enforces this
  .order('updated_at', { ascending: false })
```
Sets `loading: false` when complete.

**`saveRoute(route: Partial<Route> & { id: string })`** — upsert:
```ts
supabase.from('routes').upsert(toDbRow(route, orgId, userId), { onConflict: 'id' })
```
Sets `saving: true` before, `saving: false` after. Updates local `routes` state on success.

**`deleteRoute(id: string)`**:
```ts
supabase.from('routes').delete().eq('id', id)
```
Updates local `routes` state optimistically (remove from array before DB confirms).

### Type Mapping

**`toDbRow(route, orgId, userId)`** — complete field mapping:

| `Route` (frontend) | DB column | Value / Notes |
|--------------------|-----------|--------------|
| `id` | `id` | if empty, omit → DB generates |
| — | `organization_id` | `orgId` param |
| — | `created_by` | `userId` param |
| `name` | `name` | fallback `'Sem nome'` |
| `region` | `destination` | renamed column |
| `type` | `route_type` | fallback `'outro'` |
| `currency` | `currency` | fallback `'BRL'` |
| `1.0` | `exchange_rate` | always `1.0` — NOT NULL, future use |
| `Math.max(1, days?.length ?? 1)` | `duration_days` | NOT NULL DEFAULT 1 |
| `fixedCosts` | `fixed_costs` | JSONB, as-is |
| `variableCosts` | `variable_costs` | JSONB, as-is |
| `days` | `days` | JSONB, as-is |
| *(omit)* | `last_pax_min` | nullable, not set |
| *(omit)* | `last_pax_max` | nullable, not set |
| *(omit)* | `last_pax_step` | nullable, not set |
| *(omit)* | `last_margin` | nullable, not set |
| `new Date().toISOString()` | `updated_at` | always refresh |
| `{ client, date, contact, notes, isMultiDay }` | `metadata` | packed object |
| `estimatedPrice` | *(not saved)* | computed value, always omit |
| `createdAt` | *(omit entirely)* | Omit from upsert payload — DB default `now()` covers INSERT; omitting leaves it unchanged on UPDATE. Never send it explicitly. |

**`fromDbRow(row)`** — converts DB row back to `Route`:

| DB column | `Route` field | Fallback |
|-----------|--------------|---------|
| `id` | `id` | — |
| `name` | `name` | `''` |
| `destination` | `region` | `''` |
| `route_type` | `type` | `'outro'` |
| `currency` | `currency` | `'BRL'` |
| `fixed_costs` | `fixedCosts` | `[]` |
| `variable_costs` | `variableCosts` | `[]` |
| `days` | `days` | `[]` |
| `updated_at` | `updatedAt` | `''` |
| `created_at` | `createdAt` | `''` |
| `metadata.client` | `client` | `''` |
| `metadata.date` | `date` | `''` |
| `metadata.contact` | `contact` | `''` |
| `metadata.notes` | `notes` | `''` |
| `metadata.isMultiDay` | `isMultiDay` | `false` |
| `0` | `estimatedPrice` | recomputed by pricing engine at runtime |

Note: `isPercentage` is **not stored** — derive from `variableCost.type === 'percentage'` at usage site.

### Shared State Limitation
Each component that calls `useRoutes()` creates an independent hook instance with its own `routes` array and its own fetch. A save in `CalculatorPage` does not auto-update the list in `RoutesPage`. Reload-on-mount handles freshness for MVP — both pages call `loadRoutes()` when mounted. This is an accepted limitation.

---

## Section 7: RoutesPage Changes

**File:** `src/pages/RoutesPage.tsx` (modify existing)

- Remove `MOCK_ROUTES` import
- Add `const { routes, loading, deleteRoute, saving, error } = useRoutes()`
- Show loading skeleton while `loading === true`
- Show `"Salvando..."` indicator when `saving === true`
- Wire delete buttons to `deleteRoute(id)`
- Show `error` as inline `<p className="text-red-500 text-sm">{error}</p>` below the route list when non-null

---

## Section 8: CalculatorPage Changes

**File:** `src/pages/CalculatorPage.tsx` (modify existing)

### Route Object Assembly
`CalculatorPage` manages state as discrete pieces. Before calling `saveRoute`, assemble a partial Route object from the existing state variables:

```ts
const currentRoute = {
  id: routeId,              // new state: string, initialized with generateId() on mount
  name: routeName || 'Sem nome',
  client,
  date,
  contact: '',              // not in calculator — empty string
  notes: '',                // not in calculator — empty string
  region: '',               // not in calculator — empty string
  type: 'outro' as RouteType, // not in calculator — default
  fixedCosts,
  variableCosts: varCosts,
  estimatedPrice: effectivePrice,
  currency: 'BRL' as Currency,
  days: [],                 // not in calculator — empty array
  isMultiDay: false,
  createdAt: createdAt,     // new state: string, set on mount with new Date().toISOString()
  updatedAt: new Date().toISOString(),
};
```

Two new state variables needed in `CalculatorPage`:
- `routeId: string` — initialized with `crypto.randomUUID()` on mount (built-in browser API, no import required). Do NOT use `generateId()` from `src/lib/utils` — that returns a base-36 string, which will be rejected by the `uuid` column type.
- `createdAt: string` — initialized with `new Date().toISOString()` on mount

### Save Logic
- Import `useRoutes` and `useAuth`
- Add `const { saveRoute, saving } = useRoutes()`
- Explicit "Salvar roteiro" button → calls `saveRoute(currentRoute)` immediately
- **Auto-save:** `useEffect` watching `[fixedCosts, varCosts, effectivePrice, routeName, client, date]` with 1.5s debounce — calls `saveRoute(currentRoute)` after pause. Cleanup cancels pending debounce on unmount.
- Saving indicator: the existing `<Save>` / `<Check>` button (step 4 only) should reflect `saving` state. Additionally, add a small `"Salvando..."` text indicator in the wizard header or step navigation bar (always visible on all steps) so auto-saves on steps 0–3 are not invisible to the user. A simple `saving && <span className="text-xs text-surface-400">Salvando...</span>` in the step header is sufficient.

---

## Files Changed

| File | Change |
|------|--------|
| `package.json` | Add `@supabase/supabase-js` |
| `.env` | New (gitignored) |
| `.env.example` | New (versioned) |
| `supabase/migrations/20260327000001_routes_fix.sql` | New — fix route_type constraint + add metadata column |
| `src/lib/supabase.ts` | New |
| `src/contexts/AuthContext.tsx` | New |
| `src/hooks/useRoutes.ts` | New |
| `src/App.tsx` | AuthProvider + render RoutesPage for 'routes' case |
| `src/pages/AuthPage.tsx` | Wire real Supabase auth calls, remove onLogin prop |
| `src/pages/RoutesPage.tsx` | Replace MOCK_ROUTES with useRoutes |
| `src/pages/CalculatorPage.tsx` | Add routeId/createdAt state + saveRoute + auto-save |

---

## Out of Scope

- "Esqueci minha senha" flow (button present, no action)
- Profile page / user settings
- Organization member management UI
- Offline support
- `exchange_rate`, `last_pax_*`, `last_margin` persistence (columns exist but not wired in this iteration)
- Optimistic updates beyond delete
- Error retry logic
- Route type, region, contact, notes, currency fields in CalculatorPage (those fields are placeholders in the saved Route; future calculator steps will populate them)
