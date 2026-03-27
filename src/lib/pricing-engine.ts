import type { CostItem, VariableCost, SimulationRow, SimulationSummary } from '@/types';

/**
 * PrecificaTur - Motor de cálculo de precificação
 *
 * Lógica baseada na planilha Makunaima:
 * - Custo por pax = (Total fixo ÷ Qtd pax) + Total variável
 * - Variável = soma dos percentuais × preço estimado
 * - Receita = preço × qtd pax
 * - Resultado = receita - custo total - descontos
 */

/** Sum all fixed cost items */
export function calcTotalFixedCosts(items: CostItem[]): number {
  return items.reduce((sum, item) => sum + item.value, 0);
}

/** Sum all percentage-type variable costs (e.g. 10 + 10 + 12.5 + 4 = 36.5) */
export function calcTotalVariablePercent(variables: VariableCost[]): number {
  return variables
    .filter(v => v.type === 'percentage')
    .reduce((sum, v) => sum + v.percentage, 0);
}

/**
 * Calculate per-pax variable cost amount.
 * - percentage type: price × pct/100
 * - brl + perPax true : brlValue (R$ per pax)
 * - brl + perPax false: brlValue ÷ pax (rateio)
 */
export function calcVariableCostAmount(price: number, variables: VariableCost[], pax = 1): number {
  return variables.reduce((sum, v) => {
    if (v.type === 'brl') {
      const val = v.brlValue ?? 0;
      return sum + (v.perPax ? val : val / Math.max(pax, 1));
    }
    return sum + price * (v.percentage / 100);
  }, 0);
}

/** Calculate cost per passenger for a given pax count */
export function calcCostPerPax(
  totalFixed: number,
  variableCostAmount: number,
  pax: number
): number {
  if (pax <= 0) return 0;
  return totalFixed / pax + variableCostAmount;
}

/** Generate a simulation row for a specific pax count */
export function calcSimulationRow(
  pax: number,
  totalFixed: number,
  variables: VariableCost[],
  estimatedPrice: number,
  discounts: number = 0
): SimulationRow {
  const variableCostAmount = calcVariableCostAmount(estimatedPrice, variables, pax);
  const costPerPax = calcCostPerPax(totalFixed, variableCostAmount, pax);
  const totalCost = costPerPax * pax;
  const revenue = estimatedPrice * pax;
  const partialResult = revenue - totalCost;
  const finalResult = partialResult - discounts;
  const margin = revenue > 0 ? (finalResult / revenue) * 100 : 0;

  return {
    pax,
    costPerPax,
    totalCost,
    estimatedPrice,
    revenue,
    partialResult,
    discounts,
    finalResult,
    margin,
  };
}

/** Run full simulation for a range of passenger counts */
export function runSimulation(
  fixedCosts: CostItem[],
  variables: VariableCost[],
  estimatedPrice: number,
  maxPax: number = 50,
  discounts: number = 0,
  minPax: number = 1
): SimulationSummary {
  const totalFixed = calcTotalFixedCosts(fixedCosts);
  const totalVariablePercent = calcTotalVariablePercent(variables);

  const rows: SimulationRow[] = [];
  let breakEvenPax: number | null = null;

  for (let pax = 1; pax <= maxPax; pax++) {
    const row = calcSimulationRow(pax, totalFixed, variables, estimatedPrice, discounts);
    if (pax >= minPax) rows.push(row);

    if (breakEvenPax === null && row.finalResult >= 0) {
      breakEvenPax = pax;
    }
  }

  return {
    breakEvenPax,
    rows,
    totalFixedCosts: totalFixed,
    totalVariableCostsPercent: totalVariablePercent,
  };
}

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

/** Reverse pricing: given desired profit, pax count, and costs, find the price */
export function calcReversePrice(
  desiredProfit: number,
  pax: number,
  totalFixed: number,
  variables: VariableCost[],
  discounts: number = 0
): number {
  if (pax <= 0) return 0;
  const totalVariablePercent = calcTotalVariablePercent(variables);
  // price * pax - (totalFixed/pax + price * varPercent/100) * pax - discounts = desiredProfit
  // price * pax - totalFixed - price * pax * varPercent/100 - discounts = desiredProfit
  // price * pax * (1 - varPercent/100) = desiredProfit + totalFixed + discounts
  const factor = pax * (1 - totalVariablePercent / 100);
  if (factor <= 0) return 0;
  return (desiredProfit + totalFixed + discounts) / factor;
}

/** Safety margin: adjust price upward to account for risk */
export function calcSafetyPrice(
  basePrice: number,
  safetyMarginPercent: number
): number {
  return basePrice * (1 + safetyMarginPercent / 100);
}

/** Format currency for display (BRL) */
export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
}

/** Format percentage */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
