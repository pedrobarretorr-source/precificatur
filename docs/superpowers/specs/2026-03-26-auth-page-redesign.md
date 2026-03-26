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
Three Unsplash stock photos of Brazilian tourist destinations stacked vertically, filling the full panel height. Photos serve as background; an overlay (`bg-black/40`) ensures text legibility.

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
- Auto-rotates every 5 seconds
- Transition effect: **fade** (opacity 0→1) between testimonials
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
- CTA button: orange, full-width, "ENTRAR →" with loading spinner
- Divider: "ou entre com"
- Social buttons: Google + Facebook (side by side)

### Register Tab (`tab === 'register'`)
- Title: "Criar nova conta"
- Subtitle: "Experimente gratuitamente por 30 dias."
- Fields (in order):
  1. Nome completo (User icon)
  2. Endereço de e-mail (Mail icon)
  3. Confirme o e-mail (Mail icon, match validation + green checkmark feedback)
  4. Crie uma senha (Lock icon, show/hide, password strength indicator)
  5. Confirme a senha (Lock icon, show/hide, match validation + green checkmark feedback)
- CTA button: orange, full-width, "CRIAR CONTA →" with loading spinner
- Divider: "ou cadastre com"
- Social buttons: Google + Facebook (side by side)

### Footer
Centered, small text links separated by `|`:
`TERMOS | PRIVACIDADE | COOKIES | CONTATO`

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
