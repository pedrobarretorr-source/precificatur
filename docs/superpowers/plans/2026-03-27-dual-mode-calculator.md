# Dual-Mode Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current range-based calculator (table + chart) with a dual-mode system: direct calculation (single pax, explanatory card) and scenario exploration (range, key scenario cards).

**Architecture:** Progressive disclosure — single input field defaults to direct mode; "Comparar cenarios" button transitions to exploration mode revealing a range field. SimulationResults is rewritten as two sub-components (DirectResult + ScenarioCards). A new `findBreakEven` helper searches up to 100 pax independently.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide icons. Removes Recharts dependency.

**Spec:** `docs/superpowers/specs/2026-03-27-dual-mode-calculator.md`

---

### Task 1: Add `findBreakEven` helper to pricing engine

**Files:**
- Modify: `src/lib/pricing-engine.ts:80-110`

- [ ] **Step 1: Add `findBreakEven` function**

Add after `runSimulation` (line ~110):

```typescript
/** Find break-even pax by searching 1..100, independent of simulation range */
export function findBreakEven(
  fixedCosts: CostItem[],
  variables: VariableCost[],
  estimatedPrice: number,
  discounts: number = 0
): number | null {
  const totalFixed = calcTotalFixedCosts(fixedCosts);
  for (let pax = 1; pax <= 100; pax++) {
    const row = calcSimulationRow(pax, totalFixed, variables, estimatedPrice, discounts);
    if (row.finalResult >= 0) return pax;
  }
  return null;
}
```

- [ ] **Step 2: Verify app still compiles**

Run: `npx vite build --mode development 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/lib/pricing-engine.ts
git commit -m "feat: add findBreakEven helper for contextual observations"
```

---

### Task 2: Rewrite SimulationResults for dual-mode display

**Files:**
- Rewrite: `src/components/calculator/SimulationResults.tsx`

The current component (380 lines) has 3 sections: indicator cards, Recharts chart, scenario table. Replace entirely with two modes: DirectResult card and ScenarioCards.

- [ ] **Step 1: Rewrite SimulationResults with new interface**

New props interface:

```typescript
interface SimulationResultsProps {
  simulation: SimulationSummary;
  estimatedPrice: number;
  isExplorationMode: boolean;
  breakEvenPax: number | null; // from findBreakEven (searches up to 100)
  onCompareScenarios: () => void;
}
```

Remove all Recharts imports. Keep Lucide icons (TrendingUp, TrendingDown, Target, Users, ArrowRight).

**Direct mode (`isExplorationMode === false`):**

Single card with:
- Header: "Resultado para X passageiros"
- 4-metric grid (2x2 on mobile): Custo por pax, Receita total, Resultado, Margem
- Green/red color based on profit/loss
- Contextual observations section with auto-generated text:
  - Profit: "Com X pax voce tem margem de Y%. Seu ponto de equilibrio e Z pax."
  - Loss: "Com X pax voce tem prejuizo de R$ N. Voce precisa de pelo menos Z pax para cobrir os custos."
  - Break-even exact: "Com X pax voce cobre exatamente seus custos."
  - Break-even not found: "Nao foi possivel encontrar o ponto de equilibrio ate 100 passageiros."
- "Comparar cenarios" button calling `onCompareScenarios`

**Exploration mode (`isExplorationMode === true`):**

Select key scenarios automatically:
```typescript
function selectKeyScenarios(rows: SimulationRow[], breakEvenPax: number | null): number[] {
  const min = rows[0].pax;
  const max = rows[rows.length - 1].pax;
  const mid = Math.round((min + max) / 2);
  const range = max - min;

  const points = new Set<number>([min, max]);
  if (mid !== min && mid !== max) points.add(mid);
  if (breakEvenPax && breakEvenPax >= min && breakEvenPax <= max) points.add(breakEvenPax);
  // Extra intermediate point for large ranges
  if (range > 20) {
    const q1 = Math.round(min + range * 0.25);
    if (!points.has(q1)) points.add(q1);
  }

  return Array.from(points).sort((a, b) => a - b);
}
```

Each scenario as a stacked card showing: Pax, Custo total, Receita, Resultado, Margem. Break-even card gets emerald border + "Equilibrio" badge.

If break-even is outside the range, show a text note below the cards:
```tsx
{breakEvenPax && (breakEvenPax < rows[0].pax || breakEvenPax > rows[rows.length - 1].pax) && (
  <p className="text-xs text-surface-500 mt-3 px-1">
    <Target size={12} className="inline text-emerald-500 mr-1" />
    O ponto de equilibrio esta em <span className="font-bold text-emerald-600">{breakEvenPax} pax</span>,
    fora da faixa selecionada.
  </p>
)}
{!breakEvenPax && (
  <p className="text-xs text-surface-500 mt-3 px-1">
    Nao foi possivel encontrar o ponto de equilibrio ate 100 passageiros.
  </p>
)}
```

- [ ] **Step 2: Verify app still compiles**

Run: `npx vite build --mode development 2>&1 | tail -5`
Expected: Build succeeds (may show warnings about unused Recharts — that's fine)

- [ ] **Step 3: Commit**

```bash
git add src/components/calculator/SimulationResults.tsx
git commit -m "feat: rewrite SimulationResults with dual-mode display"
```

---

### Task 3: Update CalculatorPage for new state and input

**Files:**
- Modify: `src/pages/CalculatorPage.tsx`

- [ ] **Step 1: Update state variables**

Replace lines 91-92:
```typescript
const [minPax, setMinPax] = useState(1);
const [maxPax, setMaxPax] = useState(50);
```

With:
```typescript
const [simulationPax, setSimulationPax] = useState(0);
const [isExplorationMode, setIsExplorationMode] = useState(false);
const [maxPax, setMaxPax] = useState(50);
```

- [ ] **Step 2: Update derived values**

Update `simulation` useMemo (line ~108-111):
```typescript
const simulation = useMemo(
  () => isExplorationMode
    ? runSimulation(fixedCosts, varCosts, effectivePrice, maxPax, 0, simulationPax)
    : runSimulation(fixedCosts, varCosts, effectivePrice, simulationPax, 0, simulationPax),
  [fixedCosts, varCosts, effectivePrice, maxPax, simulationPax, isExplorationMode],
);
```

Add `breakEvenForDisplay`:
```typescript
const breakEvenForDisplay = useMemo(
  () => findBreakEven(fixedCosts, varCosts, effectivePrice),
  [fixedCosts, varCosts, effectivePrice],
);
```

Remove `keyScenarios` useMemo (lines ~113-117) — no longer needed.

Add import for `findBreakEven` from `@/lib/pricing-engine`.

- [ ] **Step 3: Update validation**

In `canAdvance()` (line ~155-162), update step 3 check:
```typescript
if (step === 3) {
  if (mode === 'price') return price > 0 && simulationPax > 0;
  return marginPct > 0 && marginPax > 0 && simulationPax > 0;
}
```

- [ ] **Step 4: Replace Step 3 pax input section**

Remove the "Quick stats preview" cards (lines ~614-639).

Remove the "Faixa de passageiros para simular" section (lines ~641-675).

Replace with:
```tsx
<div>
  <label className="input-label">
    {isExplorationMode ? 'Faixa de passageiros' : 'Quantidade de passageiros'}
  </label>
  {isExplorationMode ? (
    <div className="grid grid-cols-2 gap-3 max-w-xs">
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
        <label className="input-label font-normal text-surface-400">Ate (max. 100)</label>
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
      className="input max-w-[160px]"
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

- [ ] **Step 5: Update Step 4 result rendering**

Replace the SimulationResults call (lines ~687-691):
```tsx
<SimulationResults
  simulation={simulation}
  estimatedPrice={effectivePrice}
  isExplorationMode={isExplorationMode}
  breakEvenPax={breakEvenForDisplay}
  onCompareScenarios={() => {
    setIsExplorationMode(true);
    // Guard edge case: if pax is near 100, adjust down so range is viable
    const safePax = Math.min(simulationPax, 99);
    setSimulationPax(safePax);
    setMaxPax(Math.min(100, safePax + 20));
    setStep(3);
  }}
/>
```

- [ ] **Step 6: Verify app compiles and renders**

Run: `npx vite build --mode development 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/pages/CalculatorPage.tsx
git commit -m "feat: update CalculatorPage for dual-mode pax input"
```

---

### Task 4: Remove Recharts dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Check no other files import recharts**

Run: `grep -r "recharts" src/ --include="*.tsx" --include="*.ts" -l`
Expected: No files (SimulationResults was already rewritten without it)

- [ ] **Step 2: Uninstall recharts**

Run: `npm uninstall recharts`

- [ ] **Step 3: Verify build**

Run: `npx vite build --mode development 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove recharts dependency (chart replaced by card UI)"
```

---

### Task 5: Manual smoke test

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Test direct mode**

1. Fill Steps 0-2 with any data
2. In Step 3, enter a single pax number (e.g. 25)
3. Advance to Step 4
4. Verify: single card with metrics + contextual observations + "Comparar cenarios" button

- [ ] **Step 3: Test exploration mode**

1. Click "Comparar cenarios"
2. Verify: goes back to Step 3 with "De/Ate" fields shown
3. Fill "Ate" (e.g. 50)
4. Advance to Step 4
5. Verify: 4-5 stacked scenario cards with break-even highlighted

- [ ] **Step 4: Test edge cases**

1. Enter pax = 1 (minimum)
2. Enter pax = 100 (maximum)
3. Test profit mode: marginPax and simulationPax should work independently
4. Test when price is too low to break even (break-even null scenario)
