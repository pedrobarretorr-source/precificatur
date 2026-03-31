# Pax Range Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make passenger quantity mandatory in Step 0 and add an optional range-simulation toggle (1 to N pax) for comparison in the results.

**Architecture:** Three commit groups: (1) types + persistence together so the codebase compiles after each commit; (2) wizard page changes; (3) results component update including the new prop.

**Tech Stack:** React 18, TypeScript strict, Tailwind CSS, Supabase (metadata JSONB), Vite

---

## File Map

| File | Change |
|---|---|
| `src/types/index.ts` | Add `isExplorationMode: boolean`, `maxPax: number`; make `simulationPax: number` non-optional |
| `src/hooks/useRoutes.ts` | Serialize / deserialize `isExplorationMode`, `maxPax` in metadata JSONB |
| `src/pages/CalculatorPage.tsx` | Step 0 UI; state; Step 3 cleanup; validation; runSimulation useMemo; buildCurrentRoute |
| `src/components/calculator/SimulationResults.tsx` | `simulationPax` prop; primary row derivation; all-rows in exploration; orange highlight |

---

## Task 1: Types + Persistence (one commit, always compiles together)

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/hooks/useRoutes.ts`

**Context:** `simulationPax` already exists in the `Route` interface as `simulationPax?: number` and already has a `|| 0` fallback in `fromDbRow`. We're making it non-optional and adding two new fields.

### 1a — `src/types/index.ts`

- [ ] **Step 1: Update the `Route` interface**

  Find:
  ```ts
  simulationPax?: number;
  ```
  Replace with:
  ```ts
  simulationPax: number;
  isExplorationMode: boolean;
  maxPax: number;
  ```

### 1b — `src/hooks/useRoutes.ts`

- [ ] **Step 2: Add new fields to `toDbRow` metadata**

  Inside `metadata: { ... }`, after the `simulationPax` line, add:
  ```ts
  isExplorationMode: route.isExplorationMode ?? false,
  maxPax: route.maxPax ?? 30,
  ```

- [ ] **Step 3: Add new fields to `fromDbRow`**

  After the existing `simulationPax: (meta.simulationPax as number) || 0,` line, add:
  ```ts
  isExplorationMode: (meta.isExplorationMode as boolean) ?? false,
  maxPax: (meta.maxPax as number) ?? 30,
  ```

- [ ] **Step 4: Verify TypeScript**

  > Both `src/types/index.ts` AND `src/hooks/useRoutes.ts` must be edited before running tsc — they are committed together precisely so neither produces errors alone. Do not run tsc after editing only one of them.

  Run: `npx tsc --noEmit`
  Expected: errors about missing `isExplorationMode`/`maxPax` in `CalculatorPage.tsx` only. `useRoutes.ts` and `types/index.ts` must be error-free among themselves.

  > **Note:** `fromDbRow` defaults `maxPax ?? 30` for legacy records. Since `isExplorationMode` was always `false` before this feature, no existing route has exploration mode on — so no simulation is silently truncated on reload. This is safe.

- [ ] **Step 5: Commit**

  ```bash
  git add src/types/index.ts src/hooks/useRoutes.ts
  git commit -m "feat: add isExplorationMode and maxPax to Route type and persistence"
  ```

---

## Task 2: Wizard page changes

**Files:**
- Modify: `src/pages/CalculatorPage.tsx`

**Context:**
- `simulationPax` state already exists on line 100: `const [simulationPax, setSimulationPax] = useState(initialRoute?.simulationPax ?? 0)` — do NOT add a new one, just leave it as-is.
- `setSimulationPax` is already wired to Step 0's existing pax input — Step 0 is the single source of truth for this value.
- Initial value `0` intentionally blocks the wizard from advancing at Step 0 until the user fills the required field. This is correct UX — the `*` label makes it clear.
- Step 3 has a duplicate pax block (exploration mode range + single pax input) that will be removed entirely.
- `maxPax` is only used as the upper bound for `runSimulation` when `isExplorationMode = true`. Changing its default from 50 to 30 does NOT affect the non-exploration simulation (which uses `simulationPax` as its own `maxPax` arg).
- **Normal mode `runSimulation`**: `runSimulation(…, simulationPax || 1, 0, simulationPax || 1)` — the loop runs 1..simulationPax but only pushes the row where `pax >= simulationPax`, producing exactly one row (the confirmed pax row). This is intentional: normal mode shows a single-pax result. The `scenarioPaxList` in SimulationResults still generates 5 comparison rows via `calcRowForPax` helpers.
- **Exploration mode `runSimulation`**: `runSimulation(…, maxPax, 0, 1)` — produces rows for pax 1..maxPax. The `simulationPax` row is guaranteed to exist because the maxPax input enforces `min = simulationPax + 1`, and the pax onChange auto-adjusts `maxPax` if pax exceeds it.

### 2a — State changes

- [ ] **Step 1: Restore `isExplorationMode` setter**

  Find:
  ```ts
  const [isExplorationMode] = useState(false);
  ```
  Replace with:
  ```ts
  const [isExplorationMode, setIsExplorationMode] = useState(initialRoute?.isExplorationMode ?? false);
  ```

- [ ] **Step 2: Change `maxPax` initializer**

  Find:
  ```ts
  const [maxPax, setMaxPax] = useState(50);
  ```
  Replace with:
  ```ts
  const [maxPax, setMaxPax] = useState(initialRoute?.maxPax ?? 30);
  ```

### 2b — Fix `runSimulation` useMemo

- [ ] **Step 3: Fix exploration mode `minPax` argument**

  Find:
  ```ts
  const simulation = useMemo(
    () => isExplorationMode
      ? runSimulation(fixedCosts, varCosts, effectivePrice, maxPax, 0, simulationPax || 1)
      : runSimulation(fixedCosts, varCosts, effectivePrice, simulationPax || 1, 0, simulationPax || 1),
    [fixedCosts, varCosts, effectivePrice, maxPax, simulationPax, isExplorationMode],
  );
  ```
  Replace with:
  ```ts
  const simulation = useMemo(
    () => isExplorationMode
      ? runSimulation(fixedCosts, varCosts, effectivePrice, maxPax, 0, 1)
      : runSimulation(fixedCosts, varCosts, effectivePrice, simulationPax || 1, 0, simulationPax || 1),
    [fixedCosts, varCosts, effectivePrice, maxPax, simulationPax, isExplorationMode],
  );
  ```
  (Exploration mode now shows rows from pax=1 up to maxPax.)

### 2c — Update `buildCurrentRoute`

- [ ] **Step 4: Add `isExplorationMode` and `maxPax`**

  Find:
  ```ts
      simulationPax,
      currency: 'BRL' as Currency,
  ```
  Replace with:
  ```ts
      simulationPax,
      isExplorationMode,
      maxPax,
      currency: 'BRL' as Currency,
  ```

### 2d — Validation

- [ ] **Step 5: Make pax mandatory in Step 0, remove from Step 3**

  Find:
  ```ts
  function canAdvance() {
    if (step === 0) return routeName.trim().length > 0;
    if (step === 3) {
      if (mode === 'price') return price > 0 && simulationPax > 0;
      return marginPct > 0 && marginPax > 0 && simulationPax > 0;
    }
    return true;
  }
  ```
  Replace with:
  ```ts
  function canAdvance() {
    if (step === 0) return routeName.trim().length > 0 && simulationPax >= 1;
    if (step === 3) {
      if (mode === 'price') return price > 0;
      return marginPct > 0 && marginPax > 0;
    }
    return true;
  }
  ```

### 2e — Step 0 UI

- [ ] **Step 6: Update pax field — remove "opcional", update hint, guard maxPax on change**

  The pax state initializes to `0` by default (`initialRoute?.simulationPax ?? 0`). This intentionally blocks the "Next" button until the user fills the field — the `*` label and required hint make this clear visually.

  Find in the Step 0 JSX section:
  ```tsx
              <label className="input-label">
                Quantidade de passageiros <span className="font-normal text-surface-400">(opcional)</span>
              </label>
              <input
                className="input w-full sm:max-w-[180px]"
                type="number"
                min={1}
                max={100}
                placeholder="Ex: 15"
                value={simulationPax || ''}
                onChange={e => setSimulationPax(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
              />
              <p className="input-hint">Pode ajustar depois na etapa de preço.</p>
  ```
  Replace with:
  ```tsx
              <label className="input-label">Quantidade de passageiros *</label>
              <input
                className="input w-full sm:max-w-[180px]"
                type="number"
                min={1}
                max={100}
                placeholder="Ex: 15"
                value={simulationPax || ''}
                onChange={e => {
                  const v = Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0));
                  setSimulationPax(v);
                  // Keep maxPax valid: if exploration mode is on and new pax >= maxPax, push maxPax up
                  if (isExplorationMode && v >= maxPax) setMaxPax(Math.min(100, v + 1));
                }}
              />
              <p className="input-hint">Quantos passageiros você espera neste roteiro?</p>
  ```

- [ ] **Step 7: Add toggle + maxPax input after the pax field**

  Immediately after the `</p>` from the hint added in Step 6, add (while still inside the same parent `<div>`):
  ```tsx
              {/* Range simulation toggle */}
              <div className="space-y-3 pt-1">
                <label className={cn(
                  'flex items-center gap-3 cursor-pointer select-none',
                  (simulationPax < 1 || simulationPax >= 100) && 'opacity-50 pointer-events-none'
                )}>
                  <input
                    type="checkbox"
                    checked={isExplorationMode}
                    disabled={simulationPax < 1 || simulationPax >= 100}
                    onChange={e => setIsExplorationMode(e.target.checked)}
                    className="w-4 h-4 rounded accent-brand-orange"
                  />
                  <span className="text-sm font-semibold text-surface-700">
                    Simular faixa de comparação
                  </span>
                </label>
                {isExplorationMode && (
                  <div>
                    <label className="input-label">Simular até quantos passageiros? (máx. 100)</label>
                    <input
                      className="input w-full sm:max-w-[180px]"
                      type="number"
                      min={Math.max(simulationPax + 1, 2)}
                      max={100}
                      placeholder="Ex: 30"
                      value={maxPax || ''}
                      onChange={e => {
                        const v = Math.min(100, Math.max(simulationPax + 1, parseInt(e.target.value, 10) || simulationPax + 1));
                        setMaxPax(v);
                      }}
                    />
                    <p className="input-hint">A tabela mostrará cenários de 1 até este número.</p>
                  </div>
                )}
              </div>
  ```

### 2f — Step 3 cleanup

- [ ] **Step 8: Remove the entire pax block from Step 3**

  In Step 3, find and delete this entire block:
  ```tsx
            <div>
              <label className="input-label">
                {isExplorationMode ? 'Faixa de passageiros' : 'Quantidade de passageiros'}
              </label>
              {isExplorationMode ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xs">
                  <div>
                    <label className="input-label font-normal text-surface-400">De</label>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={maxPax - 1}
                      value={simulationPax || ''}
                      onChange={e => {
                        const v = Math.max(1, parseInt(e.target.value) || 0);
                        setSimulationPax(v);
                        if (v >= maxPax) setMaxPax(v + 1);
                      }}
                    />
                  </div>
                  <div>
                    <label className="input-label font-normal text-surface-400">Até (máx. 100)</label>
                    <input
                      className="input"
                      type="number"
                      min={(simulationPax || 1) + 1}
                      max={100}
                      value={maxPax || ''}
                      onChange={e => {
                        const v = Math.min(100, parseInt(e.target.value) || 0);
                        setMaxPax(v);
                        if (v <= simulationPax) setSimulationPax(Math.max(1, v - 1));
                      }}
                    />
                  </div>
                </div>
              ) : (
                <input
                  className="input w-full sm:max-w-[160px]"
                  type="number"
                  min={1}
                  max={100}
                  placeholder="Ex: 25"
                  value={simulationPax || ''}
                  onChange={e => setSimulationPax(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                />
              )}
            </div>
  ```
  Delete this block entirely. Nothing replaces it.

- [ ] **Step 9: Verify TypeScript**

  Run: `npx tsc --noEmit`
  Expected: error about unknown prop `simulationPax` on `SimulationResults` — that's expected (Task 3 fixes it). All other errors must be zero.

- [ ] **Step 10: Commit**

  ```bash
  git add src/pages/CalculatorPage.tsx
  git commit -m "feat: pax mandatory in Step 0, exploration toggle, remove pax from Step 3"
  ```

---

## Task 3: Update `SimulationResults` — add prop + range display

**Files:**
- Modify: `src/components/calculator/SimulationResults.tsx`

- [ ] **Step 1: Add `simulationPax` to the props interface**

  Find:
  ```ts
  interface SimulationResultsProps {
    simulation: SimulationSummary;
    estimatedPrice: number;
    isExplorationMode: boolean;
    breakEvenPax: number | null;
  }
  ```
  Replace with:
  ```ts
  interface SimulationResultsProps {
    simulation: SimulationSummary;
    estimatedPrice: number;
    isExplorationMode: boolean;
    breakEvenPax: number | null;
    simulationPax: number;
  }
  ```

- [ ] **Step 2: Destructure the new prop**

  Find the component function signature:
  ```ts
  export function SimulationResults({ simulation, estimatedPrice, isExplorationMode, breakEvenPax }: SimulationResultsProps) {
  ```
  Replace with:
  ```ts
  export function SimulationResults({ simulation, estimatedPrice, isExplorationMode, breakEvenPax, simulationPax }: SimulationResultsProps) {
  ```

- [ ] **Step 3: Pass `simulationPax` prop in CalculatorPage (Step 4 JSX)**

  In `src/pages/CalculatorPage.tsx`, find:
  ```tsx
            <SimulationResults
              simulation={simulation}
              estimatedPrice={effectivePrice}
              isExplorationMode={isExplorationMode}
              breakEvenPax={breakEvenForDisplay}
            />
  ```
  Replace with:
  ```tsx
            <SimulationResults
              simulation={simulation}
              estimatedPrice={effectivePrice}
              isExplorationMode={isExplorationMode}
              breakEvenPax={breakEvenForDisplay}
              simulationPax={simulationPax}
            />
  ```

  > **Note:** `simulationPax` is guaranteed >= 1 when Step 4 renders because `canAdvance` at step 0 requires `simulationPax >= 1`. `calcRowForPax` in `scenarioPaxList` never receives pax=0. The guard `maxPax > simulationPax` is enforced by the input constraint and the onChange auto-adjust (`setMaxPax(Math.min(100, v + 1))`), so `find(r => r.pax === simulationPax)` always matches a row.

- [ ] **Step 4: Derive primary `row` using `simulationPax` in exploration mode**

  Find:
  ```ts
    /* ── Direct Mode ─────────────────────────────────────────────────────── */
    const row = rows[0];
    if (!row) return null;
  ```
  Replace with:
  ```ts
    /* ── Primary row: simulationPax in exploration mode, first row otherwise ── */
    const row = isExplorationMode
      ? (simulation.rows.find(r => r.pax === simulationPax) ?? rows[0])
      : rows[0];
    if (!row) return null;
  ```

- [ ] **Step 5: Show all simulation rows in exploration mode**

  Find:
  ```ts
    const scenarioPaxList = useMemo(
      () => breakEvenPax !== null
        ? buildScenariosForKnownBreakEven(breakEvenPax, row.pax)
        : buildScenariosForNullBreakEven(row.pax),
      [breakEvenPax, row.pax]
    );
  ```
  Replace with:
  ```ts
    const scenarioPaxList = useMemo(
      () => isExplorationMode
        ? simulation.rows.map(r => r.pax)
        : breakEvenPax !== null
          ? buildScenariosForKnownBreakEven(breakEvenPax, row.pax)
          : buildScenariosForNullBreakEven(row.pax),
      [isExplorationMode, simulation.rows, breakEvenPax, row.pax]
    );
  ```

- [ ] **Step 6: Update highlight color and badge for the simulationPax row**

  In `ScenariosTable`, find the row className:
  ```ts
                  isBreakEven ? 'bg-emerald-50' : isSimulated ? 'bg-blue-50' : 'bg-white'
  ```
  Replace with:
  ```ts
                  isBreakEven ? 'bg-emerald-50' : isSimulated ? 'bg-brand-orange-50' : 'bg-white'
  ```

  Find the badge for the simulated row:
  ```tsx
                    {isSimulated && !isBreakEven && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 whitespace-nowrap">
                        Sua simulação
                      </span>
                    )}
  ```
  Replace with:
  ```tsx
                    {isSimulated && !isBreakEven && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-orange whitespace-nowrap">
                        👤 Sua simulação
                      </span>
                    )}
  ```

- [ ] **Step 7: Verify TypeScript — zero errors**

  Run: `npx tsc --noEmit`
  Expected: 0 errors.

- [ ] **Step 8: Commit**

  ```bash
  git add src/components/calculator/SimulationResults.tsx src/pages/CalculatorPage.tsx
  git commit -m "feat: SimulationResults handles range mode, highlights simulationPax row"
  ```

---

## Done

At this point:
- Pax is required in Step 0 (blocks wizard advance if empty)
- "Simular faixa de comparação" toggle appears in Step 0, disabled when pax < 1 or ≥ 100
- When toggle is on, user sets maxPax (default 30, max 100); results show all rows 1..maxPax
- The confirmed pax row is highlighted in orange in the scenarios table
- Step 3 no longer has a duplicate pax input
- `isExplorationMode` and `maxPax` are persisted and restored when reopening saved routes
