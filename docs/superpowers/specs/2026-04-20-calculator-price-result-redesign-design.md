# Calculator — Price Step & Result Step Redesign

**Date:** 2026-04-20
**Status:** Approved
**Scope:** `src/pages/CalculatorPage.tsx`, `src/components/calculator/SimulationResults.tsx`, `src/lib/pricing-engine.ts`, two new components

## Problem

1. The Step 3 (Preço) ships a mode toggle (`price | profit`) where the user picks between entering a selling price or a desired margin. The margin path uses a formula that overstates the price.
2. Margin belongs in the Result step as an interactive lever ("what if I wanted 30%?"), not as an upfront mode choice.
3. Step 3 and Step 4 are visually flat — mostly text and plain cards. The user wants a richer, more "dashboard-like" feel without introducing new dependencies.

## Calculation fix

Given:
- `F` = total fixed costs
- `v` = sum of percentage-type variable costs (as decimal, 0..1)
- `m` = desired margin (as decimal, 0..1)
- `n` = pax count
- `P` = price per pax

Current (incorrect) formula in `CalculatorPage.tsx:92`:
```
P = F / ( n × (1 − v) × (1 − m) )
```
This treats margin as a share of revenue *after* variable costs. It overstates the real margin-on-gross-revenue.

New formula (pure — margin on gross revenue):
```
P = F / ( n × (1 − v − m) )
```
Derivation: `margin = (revenue − totalCost) / revenue = 1 − v − F/(P·n)`. Setting this equal to `m` and solving for `P` yields the formula above.

**Guard:** when `1 − v − m ≤ 0`, the margin is unreachable given the current variable costs; return `null`.

**Actions:**
- Add `calcPriceFromMargin(totalFixed, totalVarPct, marginPct, pax)` to `src/lib/pricing-engine.ts` (returns `number | null`).
- Delete the old `calcPriceFromMargin` from `CalculatorPage.tsx`.
- The existing `row.margin = finalResult / revenue * 100` in `SimulationResults` is already a gross-revenue margin, so it matches the new formula — no change needed there.

## Step 3 — Preço (new layout)

**Removed:** mode toggle, `PricingMode` type, `mode` state, margin input, "Preço calculado por passageiro" card.

**Layout top-to-bottom:**

1. Title "Defina seu preço de venda" + short subtitle.
2. Large numeric input — price per pax (extra-bold, centered, as today).
3. **Quick-price chips** (new) — clickable, fill the input:
   - `Break-even` — minimum price for zero loss at current pax.
   - `Margem 20%` / `Margem 30%` / `Margem 40%`.
   - Each chip shows the computed price in small text below its label: `R$ 127 · break-even`.
   - When `1 − v − m ≤ 0` for a given chip, it renders disabled with a title/tooltip: "inatingível com as taxas atuais".
4. **Live mini-breakdown** (new) — appears when `price > 0`:
   - Horizontal stacked bar (h-6): navy (fixed) | orange (variable) | emerald (profit) or red (loss).
   - Three compact labels below: `Custos fixos R$ X/pax · Variáveis R$ Y/pax · Lucro R$ Z/pax (W%)`.
   - One line of total revenue: `Receita total: R$ N × pax = R$ X`.
5. **Variable-cost chips** — kept as today (applied costs shown).

Intent: typing a price or clicking a chip immediately shows where the money goes — a miniature preview of the Result step.

## Step 4 — Resultado (new top: Pricing Lab)

New card **above** the hero (separate container, same column).

**Layout:**
```
┌─ Laboratório de precificação ─────────────┐
│ PREÇO POR PAX          MARGEM DESEJADA    │
│ [R$ 180.00]   ↔   [───●──── 22%]          │
│   editable         slider 0–60%           │
└────────────────────────────────────────────┘
```

**Behavior:**
- **Two synced controls:** dragging the margin slider updates the price live using the pure formula; editing the price updates the margin and slider position.
- **Debounce ~80ms** on the slider to keep low-end devices smooth.
- **Invalid state:** when `v + m ≥ 1`, the slider clamps to the maximum feasible margin and displays `⚠ Máximo viável: X%` in subtle red. The price input remains freely editable.
- **Persistence:** the price shown in the lab is `effectivePrice`, used by all downstream calculations and saved to `Route.estimatedPrice` when the user hits "Salvar roteiro". Margin is never persisted — always derived.

**Visual:**
- White card with `ring-1 ring-surface-200` (matches hero).
- Slider track gradient navy → emerald with zone hints: red below break-even implied margin, amber 0–15%, green 15%+.
- Micro-legend above slider: `mínimo break-even · 15% saudável · 30%+ excelente`.

**Removed:** the info-banner "Preço definido: R$ X por passageiro" (redundant with the lab).

## Step 4 — Hero card polish

- Same structure: big profit number, margin below, status badge, 3 metric cards.
- **Count-up animation (~200ms)** on numbers when slider moves (`tabular-nums` already present).
- Subtle gradient backgrounds: `from-white to-emerald-50/30` when profitable, red variant when loss.
- Border color reinforced by status (emerald / amber / red) instead of neutral surface.

## Step 4 — Detailed analysis polish

1. **"Quantas pessoas você precisa?"** — unchanged.

2. **"Para onde vai cada real?"** — the price distribution bar:
   - Height h-10 → h-12 with gradients inside each slice.
   - Value labels rendered **inside** a slice when that slice is ≥15% of the bar.
   - Circular colored backgrounds on the three legend icons.

3. **NEW — `ProfitCurveChart` (SVG line chart, ~200px tall):**
   - X axis: 1 → maxPax (or 1 → 2× break-even when not in exploration mode).
   - Y axis: profit, with zero marked by a dashed horizontal line.
   - Navy line with gradient-fill area: red below zero, emerald above.
   - Interactive markers: break-even (pulsing emerald), current simulation (large orange).
   - Hover/tap tooltip: `N pax · R$ X lucro · Y%`.
   - Placed **above** the scenarios table; table remains as complementary view.

4. **Scenarios table:**
   - Mini-sparkline bar inside the profit column cell (relative scale).
   - Sticky header with a subtle shadow when scrolled.
   - Softer zebra striping.

5. **`MarginGoalCard` redesigned (combined B+C):**
   - Drops the "raise price" and "more people" levers (now redundant with slider + chart).
   - Becomes a compact fixed (non-expandable) card:
     ```
     MARGEM ATUAL  →  MARGEM SAUDÁVEL
        22%                30%
     ───────────────────────────────
     💡 Para atingir 30% sem mexer em preço/pax,
        corte R$ 428 dos custos fixos.
     ```
   - When `currentMargin ≥ 30%`: render the existing "🏆 {margem}% — excelente!" state.
   - When reducing fixed costs is not enough (`costCutNeeded ≥ totalFixed`): render a muted "30% não alcançável reduzindo apenas custos fixos com os parâmetros atuais."

## Files touched

- `src/lib/pricing-engine.ts` — add `calcPriceFromMargin` with pure formula + guard.
- `src/pages/CalculatorPage.tsx` — remove `PricingMode` state and UI; rewrite Step 3 (chips + mini-breakdown); remove Step 4 info-banner; `marginPct` state is removed from here. Step 4 now reads `effectivePrice` via `SimulationResults`'s pricing-lab callback.
- `src/components/calculator/SimulationResults.tsx` — wire up pricing-lab callbacks; apply polish (count-up, gradients, bar polish, table polish); embed chart; replace `MarginGoalCard` internals.
- **New:** `src/components/calculator/PricingLab.tsx` — price input + margin slider, live sync.
- **New:** `src/components/calculator/ProfitCurveChart.tsx` — SVG chart.

## Data contract

- `Route.estimatedPrice` remains the persisted per-pax price (no schema change).
- Margin is derived on render; never stored.

## Testing (manual)

1. Step 3: type a price; click each chip; verify breakdown updates live. With variable taxes making some chips infeasible, those chips render disabled with tooltip.
2. Step 4: move the margin slider — price updates, hero animates, curve chart redraws, scenarios table recalculates.
3. Edit the price in the lab — the margin slider repositions.
4. Drag slider into infeasible range (margin + variable > 100%) — slider clamps, warning shows.
5. Save the route with a price modified in the lab — persisted `estimatedPrice` matches the lab value.
6. Break-even unreachable (e.g. price < any feasible) — lab still functional, chart shows all-red line, MarginGoalCard shows the "unreachable" state.

## Out of scope

- No new dependencies (charts use raw SVG).
- No schema changes (no new columns, no migrations).
- No change to the AI Assistant page or Settings page.
- No change to the simulation engine's core `runSimulation` / `findBreakEven` — only the new helper.
