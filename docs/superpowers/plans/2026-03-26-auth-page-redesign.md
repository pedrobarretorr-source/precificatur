# Auth Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `src/pages/AuthPage.tsx` to match the Stitch mockup — split-screen layout with photo panel + testimonial carousel on the left, tabbed login/register forms on the right.

**Architecture:** Single file rewrite (`src/pages/AuthPage.tsx`). No new files, no routing changes. All existing validation logic is preserved; new state added for testimonial carousel and isolated password visibility per tab.

**Tech Stack:** React 18, TypeScript, Tailwind CSS (project tokens in `tailwind.config.js`), Lucide React icons, Nunito font (already loaded).

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/pages/AuthPage.tsx` | Full rewrite | Entire auth page — layout, forms, carousel, validation |

No other files change. `App.tsx` already wires `<AuthPage onLogin={...} />` correctly.

---

## Reference: Design Tokens

From `tailwind.config.js` and `src/styles/globals.css`:

```
Colors:
  brand-navy         #203478  (dark blue)
  brand-orange       #EC6907  (CTA buttons)
  brand-blue         #557ABC  (focus rings, links)
  surface-200        #F0F2F7  (tab pill bg)
  surface-300        #E4E7EF  (borders, dividers)
  surface-500        #9BA3B5  (muted text)

Component classes (from globals.css):
  .btn-primary       orange CTA button
  .input             styled text input
  .input-label       field label
```

---

## Task 1: Left Panel — Photo Stack + Overlay + Branding Content

**Files:**
- Modify: `src/pages/AuthPage.tsx` (write left panel JSX only)

- [ ] **Step 1: Write the left panel skeleton**

Replace the current `<div className="hidden lg:flex ... gradient-brand ...">` block with:

```tsx
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

    {/* Testimonials carousel — placeholder for Task 2 */}
  </div>
</div>
```

- [ ] **Step 2: Verify photo URLs load**

Run `npm run dev` and open the auth page. Confirm all 3 photos render in the left panel, each occupying ~1/3 of the panel height. The overlay should make text legible.

---

## Task 2: Testimonials Carousel

**Files:**
- Modify: `src/pages/AuthPage.tsx` (add carousel state + JSX)

- [ ] **Step 1: Add testimonial data and state**

At the top of the `AuthPage` function, add:

```tsx
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

const [testimonialIndex, setTestimonialIndex] = useState(0);
```

- [ ] **Step 2: Add useEffect for auto-rotation**

```tsx
useEffect(() => {
  const interval = setInterval(() => {
    setTestimonialIndex((prev) => (prev + 1) % TESTIMONIALS.length);
  }, 5000);
  return () => clearInterval(interval);
}, []);
```

- [ ] **Step 3: Add a helper to navigate dots and reset the timer**

Since resetting the interval from a dot click requires clearing and restarting, use a `useRef` to hold the interval:

```tsx
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
}, []);

const goToTestimonial = (index: number) => {
  setTestimonialIndex(index);
  startInterval();
};
```

Remove the simple `useEffect` from Step 2 and use `startInterval` + `intervalRef` instead.

- [ ] **Step 4: Add carousel JSX inside the left panel content**

Replace the `{/* Testimonials carousel — placeholder for Task 2 */}` comment with:

```tsx
{/* Testimonials */}
<div className="mt-8">
  {TESTIMONIALS.map((t, i) => (
    <div
      key={i}
      className="transition-opacity duration-500"
      style={{
        opacity: i === testimonialIndex ? 1 : 0,
        position: i === testimonialIndex ? 'relative' : 'absolute',
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
```

- [ ] **Step 5: Verify carousel**

Open the app. Left panel should show the first testimonial. Wait 5 seconds — it should fade to the second. Click a dot — it should jump and reset the timer.

- [ ] **Step 6: Commit**

```bash
git add src/pages/AuthPage.tsx
git commit -m "feat: auth page - left panel with photos and testimonial carousel"
```

---

## Task 3: Right Panel — Tab Switcher + Login Form

**Files:**
- Modify: `src/pages/AuthPage.tsx`

- [ ] **Step 1: Update state declarations**

Replace the existing `showPassword` / `showConfirmPassword` with three isolated states:

```tsx
const [showLoginPassword, setShowLoginPassword] = useState(false);
const [showRegisterPassword, setShowRegisterPassword] = useState(false);
const [showConfirmPassword, setShowConfirmPassword] = useState(false);
```

Keep all other existing state (`tab`, `loading`, `errors`, field values).

- [ ] **Step 2: Write the right panel wrapper**

Replace the existing right panel `<div>` with:

```tsx
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

    {/* Forms go here — Tasks 3 and 4 */}

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
```

- [ ] **Step 3: Write the login form (inside right panel, replacing tab === 'login' block)**

```tsx
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
```

- [ ] **Step 4: Extract social icons as local components**

Add these before the `AuthPage` function (they are simple SVG wrappers):

```tsx
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
```

- [ ] **Step 5: Verify login tab**

Open app, confirm login form renders correctly. Try submitting empty — should show validation errors. Fill valid data and submit — should trigger `onLogin()` (enters app).

---

## Task 4: Right Panel — Register Form

**Files:**
- Modify: `src/pages/AuthPage.tsx`

- [ ] **Step 1: Write the register form (replacing tab === 'register' block)**

```tsx
{tab === 'register' && (
  <form onSubmit={handleRegister} className="space-y-4 animate-fade-in">
    <div>
      <h2 className="text-2xl font-extrabold text-surface-800 mb-1">
        Criar nova conta
      </h2>
      <p className="text-sm text-surface-500">Experimente gratuitamente por 30 dias.</p>
    </div>

    {/* Nome */}
    <div>
      <label className="input-label">Nome completo</label>
      <div className="relative">
        <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Maria Oliveira"
          className={`input pl-11 ${errors.name ? 'border-red-400 focus:ring-red-200' : ''}`}
        />
      </div>
      {errors.name && (
        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
          <AlertCircle size={12} /> {errors.name}
        </p>
      )}
    </div>

    {/* E-mail */}
    <div>
      <label className="input-label">Endereço de e-mail</label>
      <div className="relative">
        <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nome@suaagencia.com"
          className={`input pl-11 ${errors.email ? 'border-red-400 focus:ring-red-200' : ''}`}
        />
      </div>
      {errors.email && (
        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
          <AlertCircle size={12} /> {errors.email}
        </p>
      )}
    </div>

    {/* Confirmar e-mail */}
    <div>
      <label className="input-label">Confirme o e-mail</label>
      <div className="relative">
        <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
        <input
          type="email"
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
      <label className="input-label">Crie uma senha</label>
      <div className="relative">
        <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
        <input
          type={showRegisterPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 6 caracteres"
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

    {/* CTA */}
    <button type="submit" disabled={loading} className="btn-primary w-full text-base">
      {loading
        ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        : <><span>Criar conta</span><ArrowRight size={18} /></>
      }
    </button>

    {/* Divider */}
    <div className="flex items-center gap-4">
      <div className="flex-1 h-px bg-surface-300" />
      <span className="text-xs text-surface-400 font-semibold">ou cadastre com</span>
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
```

- [ ] **Step 2: Verify full imports at top of file**

Confirm `AuthPage.tsx` imports include: `useState`, `useEffect`, `useRef` from React; `Mail`, `Lock`, `User`, `Eye`, `EyeOff`, `ArrowRight`, `AlertCircle`, `Check` from `lucide-react`.

- [ ] **Step 3: Check TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Verify register tab**

Open app, switch to "Criar Conta". Confirm:
- Title shows "Criar nova conta" and subtitle "Experimente gratuitamente por 30 dias."
- All 5 fields present
- Password strength indicator appears when typing
- Green "E-mails coincidem" / "Senhas coincidem" feedback works
- Show/hide toggles work independently (toggling one doesn't affect the other)
- Submit with valid data triggers `onLogin()`

- [ ] **Step 5: Final commit**

```bash
git add src/pages/AuthPage.tsx
git commit -m "feat: auth page redesign - right panel login and register forms"
```

---

## Quick Smoke Test Checklist

After all tasks, verify manually:

- [ ] Desktop: left panel shows 3 photos + overlay + logo + headline + features + carousel
- [ ] Carousel auto-advances every 5s, dots work, clicking dot resets timer
- [ ] Mobile (< lg): left panel hidden, mobile logo shown above tabs
- [ ] Login tab: validation errors, show/hide password, social buttons, submit enters app
- [ ] Register tab: all 5 fields, password strength, match feedback, social buttons, submit enters app
- [ ] Switching tabs clears errors
- [ ] Footer links visible on both tabs
- [ ] `npx tsc --noEmit` passes with no errors
