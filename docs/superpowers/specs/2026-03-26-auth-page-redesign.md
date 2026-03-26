# Auth Page Redesign — Design Spec
**Date:** 2026-03-26
**Status:** Approved

## Overview

Redesign `src/pages/AuthPage.tsx` to match the Stitch mockup (project `11818676183390930383`, screen `PrecificaTur - Registro com Logo Oficial`). The page is the main entry point for login and registration. The implementation replaces the current file completely (Approach A).

---

## Layout

Split-screen, two columns:

| Column | Width | Visibility |
|--------|-------|------------|
| Left (branding) | ~480px fixed | `hidden lg:flex` |
| Right (form) | flex-1 | always visible |

---

## Left Panel — Branding

### Photos
Three Unsplash stock photos of Brazilian tourist destinations stacked vertically as `<img>` tags inside a flex column. Each image uses `flex-1 w-full object-cover min-h-0` so they share the panel height equally. The entire left panel is `relative`, and a full-panel overlay `div` with `absolute inset-0 bg-black/40` sits above the photos and below the content.

Photo source: hardcoded Unsplash URLs (stable `?auto=format&fit=crop` links). The `gradient-brand` class and decorative SVG circles from the previous implementation are fully removed.

### Content (over the overlay, full height flex column)
1. **Top:** PrecificaTur logo (`/logo-precificatur.png`), white, ~h-12
2. **Middle:**
   - Headline: `"Precifique seus roteiros com precisão."` — white, bold, ~2xl
   - Features list (3 items with orange check icons):
     - "Calculadora de precificação inteligente"
     - "Simulação de cenários em tempo real"
     - "Relatórios detalhados por roteiro"
3. **Bottom:** Testimonials carousel

### Testimonials Carousel
- 5 testimonial cards (placeholders — content to be replaced by the team)
- Each card: avatar (initials or photo), name, role/company, quote text
- Auto-rotates every 5 seconds via `setInterval` inside a `useEffect`
- The `useEffect` must return a `clearInterval` cleanup to prevent memory leaks on unmount
- Clicking a dot navigates to that testimonial AND resets the 5-second timer (clear + restart interval)
- Transition effect: **fade** (opacity 0→1, CSS transition ~500ms) between testimonials
- Manual dots navigation below the card
- Placeholder structure:
  ```
  { name: "Mariana Silva", role: "Agente de viagens", text: "..." }
  { name: "Carlos Rocha", role: "Operador turístico", text: "..." }
  { name: "Ana Ferreira", role: "Guia de turismo", text: "..." }
  { name: "Pedro Costa", role: "Dono de agência", text: "..." }
  { name: "Lucia Mendes", role: "Consultora de turismo", text: "..." }
  ```

---

## Right Panel — Forms

### Tab Switcher
- Two tabs: **Entrar** | **Criar Conta**
- Pill/toggle style: active tab has white background + shadow on gray pill container
- Switching clears all field errors

### Login Tab (`tab === 'login'`)
- Title: "Bem-vindo de volta!"
- Subtitle: "Entre na sua conta para continuar"
- Fields:
  - E-mail (with Mail icon, validation)
  - Senha (with Lock icon, show/hide toggle, validation)
  - Link "Esqueci minha senha" (inline, right-aligned above field)
- CTA button: orange, full-width, text `"ENTRAR"` + `<ArrowRight>` Lucide icon, with loading spinner
- Divider: "ou entre com" — rendered **inside** the login tab block
- Social buttons: Google + Facebook (side by side)

### Register Tab (`tab === 'register'`)
- Title: **"Criar nova conta"** _(replaces old "Crie sua conta")_
- Subtitle: **"Experimente gratuitamente por 30 dias."** _(replaces old "Comece a precificar seus roteiros agora")_
- Fields (in order):
  1. Nome completo (User icon)
  2. Endereço de e-mail (Mail icon)
  3. Confirme o e-mail (Mail icon, match validation + green checkmark feedback)
  4. Crie uma senha (Lock icon, show/hide, password strength indicator)
  5. Confirme a senha (Lock icon, show/hide, match validation + green checkmark feedback)
- CTA button: orange, full-width, text `"CRIAR CONTA"` + `<ArrowRight>` Lucide icon, with loading spinner
- Divider: "ou cadastre com" — rendered **inside** the register tab block
- Social buttons: Google + Facebook (side by side)

### Footer
Centered, small text links separated by `|`:
`TERMOS | PRIVACIDADE | COOKIES | CONTATO`

The existing "Ao criar uma conta, você concorda com nossos Termos de Uso e Política de Privacidade" consent text is **removed** and replaced entirely by this four-link footer row, always visible regardless of active tab.

---

## Mobile Behavior
- Left panel hidden on `< lg`
- Logo shown centered above the tabs (white on navy rounded card)
- Form fills full screen width with padding

---

## State & Logic

All existing validation logic is preserved:
- `validateLogin()` — email format + non-empty password
- `validateRegister()` — name, email format, email match, password min 6 chars, password match
- `passwordStrength()` — 4-level indicator (Fraca / Razoável / Boa / Forte)
- `handleSocialLogin()` — stub with `setTimeout` → `onLogin()` (TODO: Supabase OAuth)
- `handleLogin()` / `handleRegister()` — stub with `setTimeout` → `onLogin()` (TODO: Supabase)

New state:
- `testimonialIndex: number` — current testimonial (0–4), auto-advances via `setInterval`
- `showLoginPassword: boolean` — show/hide toggle for the login password field (isolated from register)
- `showRegisterPassword: boolean` — show/hide toggle for "Crie uma senha" in register
- `showConfirmPassword: boolean` — show/hide toggle for "Confirme a senha" in register

Note: the existing shared `showPassword` state is split into three isolated states to prevent cross-tab interference.

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/AuthPage.tsx` | Full rewrite |

No new files. No routing changes needed (`App.tsx` already wires `AuthPage` correctly).

---

## Out of Scope
- Supabase integration (marked as TODO)
- Real testimonial content (placeholders only)
- "Esqueci minha senha" functionality (button present, no action)
- TERMOS / PRIVACIDADE / COOKIES / CONTATO page content
- Carousel accessibility (aria-labels for dots, keyboard navigation — future iteration)
