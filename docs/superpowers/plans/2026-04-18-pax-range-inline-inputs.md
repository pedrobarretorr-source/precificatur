# Pax Range Inline Inputs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-input-plus-checkbox pax UX in Step 0 with two always-visible inline inputs (minimum required, maximum optional with ghost state), connected by "até". Remove `isExplorationMode` as React state and derive it from `maxPax > simulationPax`.

**Architecture:** Pure frontend refactor scoped to [src/pages/CalculatorPage.tsx](src/pages/CalculatorPage.tsx). No changes to the `Route` type, persistence, `SimulationResults`, or `pricing-engine`. `isExplorationMode` stays on the persisted `Route` shape (derived at save time). The `maxPax` state starts at `0` (ghost) for new routes and for edited routes whose saved `isExplorationMode === false`.

**Tech Stack:** React 18 + TypeScript, Vite, Tailwind (existing design tokens: `brand-navy`, `brand-orange`, `brand-blue`, `surface-*`, `.input`, `.input-hint`, `.card`).

**Spec:** [docs/superpowers/specs/2026-04-18-pax-range-inline-inputs-design.md](docs/superpowers/specs/2026-04-18-pax-range-inline-inputs-design.md)

**Note on tests:** The codebase has no test framework installed (no vitest/jest in `package.json`). Per YAGNI, we do **not** add one for this refactor. Verification is: TypeScript compiles, ESLint passes, dev server renders correctly, and manual browser checks cover the acceptance criteria.

---

## File Structure

**Modified (only file changed):**
- [src/pages/CalculatorPage.tsx](src/pages/CalculatorPage.tsx)
  - L103–105: `maxPax` init changes; `isExplorationMode` state removed.
  - L117–127: `simulation` memo reads derived `isExplorationMode`.
  - L135–157: `buildCurrentRoute` reads derived `isExplorationMode`.
  - L329–381: JSX block for pax fields — full rewrite.
  - L839: prop passed to `SimulationResults` reads derived value.

**Unchanged (verified, do not touch):**
- [src/types/index.ts](src/types/index.ts) — `Route.isExplorationMode: boolean` stays on persisted shape.
- [src/hooks/useRoutes.ts](src/hooks/useRoutes.ts) — reads/writes `isExplorationMode` from metadata.
- [src/components/calculator/SimulationResults.tsx](src/components/calculator/SimulationResults.tsx) — consumes `isExplorationMode` prop, behavior unchanged.
- [src/data/mock-routes.ts](src/data/mock-routes.ts) — mock fixture.

---

## Task 1 — Derive `isExplorationMode`; adjust `maxPax` initialization

**Files:**
- Modify: [src/pages/CalculatorPage.tsx](src/pages/CalculatorPage.tsx#L103-L105)

This task is a pure refactor: replace the React state `isExplorationMode` with a memoized derivation, and change how `maxPax` initializes so that rotas antigas sem exploração não aparecem com `maxPax=30` pré-preenchido. After this task, behavior on screen is still the OLD UI (checkbox + conditional input) but state shape is new. This isolates the state-model change from the JSX rewrite.

- [ ] **Step 1.1: Change `maxPax` initializer**

In [src/pages/CalculatorPage.tsx:105](src/pages/CalculatorPage.tsx#L105), replace:

```tsx
const [maxPax, setMaxPax] = useState(initialRoute?.maxPax ?? 30);
```

with:

```tsx
const [maxPax, setMaxPax] = useState(
  initialRoute?.isExplorationMode ? (initialRoute.maxPax ?? 0) : 0
);
```

- [ ] **Step 1.2: Remove `isExplorationMode` state, add derivation**

At [src/pages/CalculatorPage.tsx:104](src/pages/CalculatorPage.tsx#L104), remove:

```tsx
const [isExplorationMode, setIsExplorationMode] = useState(initialRoute?.isExplorationMode ?? false);
```

Add, just below the pax-related `useState` lines (keep it close to `maxPax`/`simulationPax` for readability):

```tsx
const isExplorationMode = maxPax > simulationPax && simulationPax >= 1;
```

(No `useMemo` needed — this derivation is two cheap comparisons and React doesn't need memoization to re-render correctly; keeps the code simpler.)

- [ ] **Step 1.3: Verify TypeScript compiles (expect errors from removed setter)**

Run:

```bash
npx tsc -b --noEmit
```

Expected: errors on remaining `setIsExplorationMode(...)` calls in the JSX (around L355 of the original file). These will be fixed when the JSX is rewritten in Task 2. No other type errors should appear — the `simulation` memo, `buildCurrentRoute`, and the `SimulationResults` prop all keep reading `isExplorationMode` as a boolean identifier.

- [ ] **Step 1.4: Do NOT commit yet**

The code doesn't build cleanly until Task 2 removes the old JSX references. Continue to Task 2; we'll commit once together.

---

## Task 2 — Rewrite the JSX: remove checkbox, add two inline inputs

**Files:**
- Modify: [src/pages/CalculatorPage.tsx](src/pages/CalculatorPage.tsx#L329-L381) (the pax block inside `step === 0`)

This task replaces the old pax section (single input + checkbox + conditional max input) with the new two-input layout described in the spec.

- [ ] **Step 2.1: Locate the block to replace**

The block starts at the `<div>` containing `<label className="input-label">Quantidade de passageiros *</label>` (around L330) and ends at the closing `</div>` just before the "Anotações" block (around L381). This corresponds to the JSX surrounding the single `simulationPax` input, the checkbox toggle, and the conditional `maxPax` input.

- [ ] **Step 2.2: Replace the entire block with the new layout**

Paste this JSX in place of the old block:

```tsx
<div>
  <label className="input-label">Quantidade de passageiros *</label>

  <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-3">
    {/* Mínimo — obrigatório */}
    <div className="flex flex-col items-center">
      <input
        className="input w-full sm:w-32 text-center text-2xl font-extrabold text-brand-navy py-3"
        type="number"
        min={1}
        max={100}
        placeholder="15"
        value={simulationPax || ''}
        onChange={e => {
          const v = Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0));
          setSimulationPax(v);
        }}
      />
      <span className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mt-1">
        passageiros
      </span>
    </div>

    {/* Conector "até" */}
    <span className="text-sm font-bold text-surface-400 self-center sm:pb-8 sm:px-1">
      até
    </span>

    {/* Máximo — opcional, ghost quando vazio */}
    <div className="flex flex-col items-center">
      <input
        className={cn(
          'w-full sm:w-32 text-center text-2xl font-extrabold text-brand-navy py-3 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue',
          simulationPax < 1 && 'opacity-50 pointer-events-none',
          maxPax > 0
            ? 'border border-surface-300 bg-white placeholder:text-surface-500 placeholder:font-normal'
            : 'border border-dashed border-surface-300 bg-surface-50 placeholder:text-surface-400 placeholder:font-normal'
        )}
        type="number"
        min={simulationPax + 1}
        max={100}
        placeholder={simulationPax < 1 ? 'preencha o mínimo' : 'comparar até…'}
        disabled={simulationPax < 1}
        value={maxPax || ''}
        onChange={e => {
          const v = Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0));
          setMaxPax(v);
        }}
      />
      <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider mt-1">
        (opcional)
      </span>
    </div>
  </div>

  {/* Hint explicativo */}
  <p className="input-hint mt-3">
    Informe até quantos passageiros para comparar cenários lado a lado e ver como o preço e o lucro mudam conforme o grupo cresce.
  </p>

  {/* Validação inline */}
  {maxPax > 0 && maxPax <= simulationPax && (
    <p className="text-xs text-red-500 mt-1">
      O máximo precisa ser maior que o mínimo.
    </p>
  )}
</div>
```

Key details to double-check after pasting:
- The outer block sits inside `step === 0` and replaces everything from the old `Quantidade de passageiros` label through the end of the `isExplorationMode` conditional.
- `cn` is already imported at [src/pages/CalculatorPage.tsx:19](src/pages/CalculatorPage.tsx#L19) — no new imports needed.
- **No auto-nudge**: the old `if (isExplorationMode && v >= maxPax) setMaxPax(...)` logic is intentionally gone. Users see the red hint and adjust manually.

- [ ] **Step 2.3: Verify TypeScript compiles cleanly**

Run:

```bash
npx tsc -b --noEmit
```

Expected: zero errors. The only remaining readers of `isExplorationMode` (the `simulation` memo, `buildCurrentRoute`, and the `SimulationResults` prop) resolve the identifier to the derived const from Task 1.

- [ ] **Step 2.4: Verify ESLint passes**

Run:

```bash
npm run lint
```

Expected: no new warnings/errors introduced by the edit. If pre-existing warnings appear in other files, ignore them.

- [ ] **Step 2.5: Verify production build succeeds**

Run:

```bash
npm run build
```

Expected: build completes successfully, no TS or Vite errors.

- [ ] **Step 2.6: Commit**

```bash
git add src/pages/CalculatorPage.tsx
git commit -m "feat(calculator): inline min/max pax inputs with ghost state

Replace Step 0 checkbox-gated exploration toggle with two always-visible
inputs (min required, max optional) connected by 'até'. isExplorationMode
is now derived from maxPax > simulationPax instead of React state.

Spec: docs/superpowers/specs/2026-04-18-pax-range-inline-inputs-design.md"
```

---

## Task 3 — Manual browser verification

**Files:**
- None (verification only)

This task is manual because there is no test harness. Start the dev server once and walk the acceptance criteria.

- [ ] **Step 3.1: Start the dev server**

Run (in the background or a second terminal):

```bash
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). Navigate to the Calculator page and stay on Step 0.

- [ ] **Step 3.2: Walk the acceptance criteria from the spec**

Test each acceptance criterion from [the spec's "Critérios de aceite" section](docs/superpowers/specs/2026-04-18-pax-range-inline-inputs-design.md#critérios-de-aceite):

1. **AC1 — Two inputs with "até"**: both inputs visible from the start, "até" centered between them. ✅ / ❌
2. **AC2 — Min required**: "Próximo" button is disabled until min ≥ 1. Clear the min → button disables. ✅ / ❌
3. **AC3 — Ghost → active transition**: max field starts with dashed border + surface-50 background; type any digit → switches to solid border + white background. Clear it → returns to ghost. ✅ / ❌
4. **AC4 — Max disabled when min empty**: with min cleared, max shows `opacity-50`, is not focusable, and placeholder reads `preencha o mínimo`. Browser devtools should show `disabled` attribute on the input. ✅ / ❌
5. **AC5 — `isExplorationMode` is not React state**: React devtools → inspect the CalculatorPage component → no `isExplorationMode` in the state list (only `simulationPax` and `maxPax`). ✅ / ❌
6. **AC6 — Validation inline**: min=15, max=15 → red hint appears; min=15, max=10 → red hint appears; min=15, max=20 → hint disappears; "Próximo" stays enabled in all these cases. ✅ / ❌
7. **AC7 — Hint fixed**: the explanatory paragraph is always visible below both inputs. ✅ / ❌
8. **AC8 — Old routes backward-compat**: open an existing saved route (Dashboard → Rotas → click one with `isExplorationMode=false`). Max field should appear empty (ghost), NOT pre-filled with 30. Open a route with `isExplorationMode=true` — max field shows the saved value. ✅ / ❌
9. **AC9 — Step 4 works both ways**: with max empty, advance to Step 4 → simulation shows single pax row. With max filled (e.g. min=5, max=20), Step 4 shows the range table. ✅ / ❌
10. **AC10 — Mobile layout**: resize browser to ≤375px width. Inputs stack vertically, "até" becomes a horizontal label between them, nothing overflows. ✅ / ❌

- [ ] **Step 3.3: Fix anything that fails**

If any AC fails, return to Task 2 and adjust the JSX or the state initializer. After the fix, re-run `npx tsc -b --noEmit` + `npm run build`, then re-verify the failing AC. Amend the previous commit ONLY if the fix is trivial (typo, class name); otherwise create a follow-up commit:

```bash
git add src/pages/CalculatorPage.tsx
git commit -m "fix(calculator): <describe the AC that failed and the fix>"
```

- [ ] **Step 3.4: Stop the dev server**

When all ACs pass, stop `npm run dev`.

---

## Task 4 — Final sanity check before handoff

**Files:**
- None

- [ ] **Step 4.1: Grep for leftovers**

Run:

```bash
npx grep -rn "setIsExplorationMode" src/
npx grep -rn "isExplorationMode" src/pages/CalculatorPage.tsx
```

Expected:
- First grep: zero matches (the setter is fully removed).
- Second grep: exactly three matches in `CalculatorPage.tsx` — the derivation line, the `simulation` memo dependency list, the `buildCurrentRoute` object literal, and the `SimulationResults` prop. (Four lines total; three-plus is fine — just confirm no `setIsExplorationMode` survives and no references to the deleted `useState` remain.)

- [ ] **Step 4.2: Confirm git state is clean**

```bash
git status
```

Expected: working tree clean (all changes committed).

- [ ] **Step 4.3: Report back**

Summarize to the user: tasks completed, any deviations from the spec, and the commit hashes created.

---

## Rollback plan

If something breaks after merge and a quick fix isn't obvious:

```bash
git revert <commit-hash>
```

The change is isolated to one file and one commit, so revert is safe and clean.
