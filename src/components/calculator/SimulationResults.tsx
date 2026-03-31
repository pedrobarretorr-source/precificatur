import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Target, TrendingUp, TrendingDown, Users, DollarSign } from 'lucide-react';
import type { SimulationSummary, SimulationRow } from '@/types';
import { formatBRL, formatPercent } from '@/lib/pricing-engine';
import { cn } from '@/lib/utils';

/* ── Props ───────────────────────────────────────────────────────────────── */

interface SimulationResultsProps {
  simulation: SimulationSummary;
  estimatedPrice: number;
  isExplorationMode: boolean;
  breakEvenPax: number | null;
  simulationPax: number;
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function calcRowForPax(
  pax: number,
  totalFixed: number,
  simulation: SimulationSummary,
  estimatedPrice: number
): SimulationRow {
  // Try to find in existing rows first
  const existing = simulation.rows.find(r => r.pax === pax);
  if (existing) return existing;
  // Otherwise compute via engine (we don't have variables here, use totalFixed approach)
  // Derive from existing row ratio: costPerPax = totalFixed/pax + varCostPerPax
  // varCostPerPax is constant across pax for % type; for simplicity use first row as reference
  const refRow = simulation.rows[0];
  if (!refRow) return { pax, costPerPax: 0, totalCost: 0, estimatedPrice, revenue: estimatedPrice * pax, partialResult: 0, discounts: 0, finalResult: 0, margin: 0 };
  const varCostPerPax = refRow.costPerPax - totalFixed / refRow.pax;
  const costPerPax = totalFixed / pax + varCostPerPax;
  const totalCost = costPerPax * pax;
  const revenue = estimatedPrice * pax;
  const finalResult = revenue - totalCost;
  const margin = revenue > 0 ? (finalResult / revenue) * 100 : 0;
  return { pax, costPerPax, totalCost, estimatedPrice, revenue, partialResult: finalResult, discounts: 0, finalResult, margin };
}

function buildScenariosForKnownBreakEven(breakEven: number, simulatedPax: number): number[] {
  const candidates = [
    Math.max(1, breakEven - 5),
    breakEven,
    simulatedPax,
    breakEven + 5,
    breakEven + 15,
  ];
  return [...new Set(candidates)].sort((a, b) => a - b).slice(0, 5);
}

function buildScenariosForNullBreakEven(simulatedPax: number): number[] {
  const candidates = [
    Math.max(1, simulatedPax - 10),
    Math.max(1, simulatedPax - 5),
    simulatedPax,
    simulatedPax + 5,
    simulatedPax + 15,
  ];
  return [...new Set(candidates)].sort((a, b) => a - b).slice(0, 5);
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function MetricCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 bg-surface-50 rounded-xl px-4 py-3 border border-surface-200">
      <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">{label}</span>
      <span className={cn('text-base font-extrabold tabular-nums',
        positive === undefined ? 'text-brand-navy' : positive ? 'text-emerald-600' : 'text-red-500'
      )}>
        {value}
      </span>
      {sub && <span className="text-[10px] text-surface-400">{sub}</span>}
    </div>
  );
}

/* ── Section 1: Quantas pessoas você precisa? ────────────────────────────── */

function PaxBreakEvenCard({ breakEvenPax, simulatedPax }: { breakEvenPax: number | null; simulatedPax: number }) {
  if (breakEvenPax === null) {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-4 space-y-1">
        <p className="text-sm font-bold text-amber-800">Ponto de equilíbrio não encontrado</p>
        <p className="text-xs text-amber-700 leading-relaxed">
          Com os custos e preço atuais, não há quantidade de pessoas que cubra os custos. Tente aumentar o preço ou reduzir os custos fixos.
        </p>
      </div>
    );
  }

  const gap = simulatedPax - breakEvenPax;
  const isOk = gap >= 0;
  const isExact = gap === 0;

  const statusMsg = isExact
    ? { icon: '⚠️', text: 'Você está exatamente no limite. Qualquer desistência gera prejuízo.', color: 'bg-amber-50 border-amber-200 text-amber-800' }
    : isOk
      ? { icon: '✅', text: `Você tem ${gap} pessoa${gap !== 1 ? 's' : ''} acima do mínimo — boa margem de segurança.`, color: 'bg-emerald-50 border-emerald-200 text-emerald-800' }
      : { icon: '⚠️', text: `Faltam ${Math.abs(gap)} pessoa${Math.abs(gap) !== 1 ? 's' : ''} para cobrir os custos. Abaixo do ponto de equilíbrio.`, color: 'bg-red-50 border-red-200 text-red-800' };

  return (
    <div className="space-y-4">
      {/* Two stat cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Break-even card */}
        <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-4 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Ponto de equilíbrio</span>
          </div>
          <p className="text-3xl font-extrabold text-emerald-700 tabular-nums leading-none">{breakEvenPax}</p>
          <p className="text-xs text-emerald-600 leading-snug mt-0.5">
            pessoas mínimas para não ter prejuízo
          </p>
        </div>

        {/* Simulation card */}
        <div className={cn(
          'rounded-xl border-2 px-4 py-4 flex flex-col gap-1',
          isOk ? 'border-brand-navy-100 bg-brand-navy-50' : 'border-red-200 bg-red-50'
        )}>
          <span className="text-[10px] font-bold uppercase tracking-wide mb-1"
            style={{ color: isOk ? 'var(--color-brand-navy, #1e3a5f)' : '#dc2626' }}>
            Sua simulação
          </span>
          <p className={cn('text-3xl font-extrabold tabular-nums leading-none',
            isOk ? 'text-brand-navy' : 'text-red-600'
          )}>{simulatedPax}</p>
          <p className={cn('text-xs leading-snug mt-0.5', isOk ? 'text-brand-navy-700' : 'text-red-600')}>
            passageiros esperados no roteiro
          </p>
        </div>
      </div>

      {/* Gap pill */}
      {!isExact && (
        <div className="flex justify-center">
          <span className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold border',
            isOk
              ? 'bg-emerald-100 border-emerald-200 text-emerald-700'
              : 'bg-red-100 border-red-200 text-red-700'
          )}>
            {isOk ? `+${gap}` : gap} {Math.abs(gap) === 1 ? 'pessoa' : 'pessoas'} {isOk ? 'acima do mínimo' : 'abaixo do mínimo'}
          </span>
        </div>
      )}

      {/* Status banner */}
      <div className={cn('rounded-xl border px-4 py-3 flex items-start gap-2.5', statusMsg.color)}>
        <span className="text-base flex-shrink-0">{statusMsg.icon}</span>
        <p className="text-sm leading-relaxed font-medium">{statusMsg.text}</p>
      </div>
    </div>
  );
}

/* ── Section 2: Para onde vai cada real do seu preço? ────────────────────── */

function PriceDistBar({ row, totalFixed, estimatedPrice }: { row: SimulationRow; totalFixed: number; estimatedPrice: number }) {
  const fixedSliceR = totalFixed / row.pax;
  const varSliceR = row.costPerPax - fixedSliceR;
  const lucroSliceR = estimatedPrice - fixedSliceR - varSliceR;
  const isProfit = lucroSliceR >= 0;

  const fixedPct = Math.max(0, (fixedSliceR / estimatedPrice) * 100);
  const varPct = Math.max(0, (varSliceR / estimatedPrice) * 100);
  const lucroPct = Math.max(0, (Math.abs(lucroSliceR) / estimatedPrice) * 100);

  // Cap total at 100% visually
  const total = fixedPct + varPct + (isProfit ? lucroPct : 0);
  const scale = total > 100 ? 100 / total : 1;

  return (
    <div className="space-y-3">
      <div className="flex h-8 rounded-xl overflow-hidden w-full">
        <div
          className="bg-brand-navy flex items-center justify-center transition-all duration-500"
          style={{ width: `${fixedPct * scale}%` }}
          title={`Custos fixos: ${formatBRL(fixedSliceR)}`}
        />
        <div
          className="bg-brand-orange flex items-center justify-center transition-all duration-500"
          style={{ width: `${varPct * scale}%` }}
          title={`Custos variáveis: ${formatBRL(varSliceR)}`}
        />
        {isProfit && (
          <div
            className="bg-emerald-500 flex items-center justify-center transition-all duration-500"
            style={{ width: `${lucroPct * scale}%` }}
            title={`Seu lucro: ${formatBRL(lucroSliceR)}`}
          />
        )}
        {!isProfit && (
          <div
            className="bg-red-400 flex items-center justify-center transition-all duration-500"
            style={{ width: `${Math.min(lucroPct * scale, 100 - (fixedPct + varPct) * scale)}%` }}
            title={`Prejuízo: ${formatBRL(Math.abs(lucroSliceR))}`}
          />
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex items-start gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-brand-navy flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-surface-700">Custos fixos</p>
            <p className="text-surface-500">{formatBRL(fixedSliceR)} / pessoa</p>
          </div>
        </div>
        <div className="flex items-start gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-brand-orange flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-surface-700">Taxas e custos variáveis</p>
            <p className="text-surface-500">{formatBRL(varSliceR)} / pessoa</p>
          </div>
        </div>
        <div className="flex items-start gap-1.5">
          <span className={cn('w-3 h-3 rounded-sm flex-shrink-0 mt-0.5', isProfit ? 'bg-emerald-500' : 'bg-red-400')} />
          <div>
            <p className={cn('font-semibold', isProfit ? 'text-emerald-700' : 'text-red-600')}>
              {isProfit ? 'Seu lucro' : 'Prejuízo'}
            </p>
            <p className={cn('', isProfit ? 'text-emerald-600' : 'text-red-500')}>
              {formatBRL(Math.abs(lucroSliceR))} / pessoa
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Section 3: O que muda com mais ou menos pessoas? ────────────────────── */

function ScenariosTable({
  paxList,
  simulatedPax,
  breakEvenPax,
  totalFixed,
  simulation,
  estimatedPrice,
}: {
  paxList: number[];
  simulatedPax: number;
  breakEvenPax: number | null;
  totalFixed: number;
  simulation: SimulationSummary;
  estimatedPrice: number;
}) {
  return (
    <div className="rounded-xl border border-surface-200 overflow-hidden">
      {/* Scrollable body — max ~8 rows visible */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-surface-50 border-b border-surface-200">
              <th className="text-left px-3 py-2.5 text-[11px] font-bold text-surface-500 uppercase tracking-wide">Pessoas</th>
              <th className="text-right px-3 py-2.5 text-[11px] font-bold text-surface-500 uppercase tracking-wide">Total arrecadado</th>
              <th className="text-right px-3 py-2.5 text-[11px] font-bold text-surface-500 uppercase tracking-wide">Lucro / Prejuízo</th>
              <th className="text-right px-3 py-2.5 text-[11px] font-bold text-surface-500 uppercase tracking-wide">% de lucro</th>
            </tr>
          </thead>
        </table>
      </div>
      <div className="overflow-y-auto overflow-x-auto max-h-[320px]">
        <table className="w-full text-sm">
          <tbody>
            {paxList.map(pax => {
              const row = calcRowForPax(pax, totalFixed, simulation, estimatedPrice);
              const isBreakEven = pax === breakEvenPax;
              const isSimulated = pax === simulatedPax;
              const isProfit = row.finalResult >= 0;

              return (
                <tr
                  key={pax}
                  className={cn(
                    'border-b border-surface-100 last:border-0',
                    isBreakEven ? 'bg-emerald-50' : isSimulated ? 'bg-brand-orange-50' : 'bg-white'
                  )}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {/* Pulsing dot for break-even */}
                      {isBreakEven ? (
                        <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                        </span>
                      ) : (
                        <span className="w-2.5 flex-shrink-0" />
                      )}
                      <span className={cn('font-bold', isBreakEven ? 'text-emerald-700' : 'text-surface-800')}>{pax}</span>
                      {isBreakEven && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 whitespace-nowrap">
                          <Target size={9} /> Mín. p/ lucrar
                        </span>
                      )}
                      {isSimulated && !isBreakEven && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-orange whitespace-nowrap">
                          👤 Sua simulação
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-surface-700 tabular-nums">
                    {formatBRL(row.revenue)}
                  </td>
                  <td className={cn('px-3 py-2.5 text-right font-bold tabular-nums', isProfit ? 'text-emerald-600' : 'text-red-500')}>
                    {row.finalResult >= 0 ? '+' : ''}{formatBRL(row.finalResult)}
                  </td>
                  <td className={cn('px-3 py-2.5 text-right font-bold tabular-nums', isProfit ? 'text-emerald-600' : 'text-red-500')}>
                    {formatPercent(row.margin)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Section 4: Insights ─────────────────────────────────────────────────── */

function InsightsList({
  row,
  totalFixed,
  estimatedPrice,
  breakEvenPax,
}: {
  row: SimulationRow;
  totalFixed: number;
  estimatedPrice: number;
  breakEvenPax: number | null;
}) {
  const lucroMarginal = estimatedPrice - row.costPerPax;
  const fixedSliceR = totalFixed / row.pax;
  const varSliceR = row.costPerPax - fixedSliceR;
  const varPctOfPrice = estimatedPrice > 0 ? (varSliceR / estimatedPrice) * 100 : 0;
  const isProfit = row.finalResult > 0;
  const diff = breakEvenPax !== null ? Math.abs(row.pax - breakEvenPax) : null;

  const insights: { icon: string; text: string }[] = [];

  // Insight 1 — marginal profit (always)
  if (lucroMarginal > 0) {
    insights.push({ icon: '💰', text: `Cada pessoa a mais te rende ${formatBRL(lucroMarginal)} de lucro.` });
  } else {
    insights.push({ icon: '💰', text: `Cada pessoa a mais ainda gera ${formatBRL(Math.abs(lucroMarginal))} de prejuízo. Revise o preço ou os custos.` });
  }

  // Insight 2 — variable costs > 15%
  if (varPctOfPrice > 15) {
    insights.push({ icon: '📊', text: `Suas taxas e custos variáveis consomem ${formatPercent(varPctOfPrice)} do que você cobra. Considere renegociar comissões.` });
  }

  // Insight 3 — profitable with known break-even
  if (isProfit && breakEvenPax !== null && diff !== null && diff > 0) {
    insights.push({ icon: '🚀', text: `Com ${diff} pessoa${diff !== 1 ? 's' : ''} a mais que o mínimo, seu lucro chegou a ${formatPercent(row.margin)}.` });
  }

  // Insight 4 — losing money with known break-even
  if (!isProfit && breakEvenPax !== null && diff !== null) {
    insights.push({ icon: '⚠️', text: `Você precisa de ${diff} pessoa${diff !== 1 ? 's' : ''} a mais para começar a lucrar.` });
  }

  // Insight 5 — exact break-even
  if (row.pax === breakEvenPax) {
    insights.push({ icon: '🎯', text: `Você simulou exatamente o mínimo de pessoas. Qualquer desistência gera prejuízo.` });
  }

  // Insight 6 — break-even null
  if (breakEvenPax === null) {
    insights.push({ icon: '❓', text: `Com os custos e preço atuais, não foi possível calcular o mínimo de pessoas. Tente aumentar o preço ou reduzir os custos.` });
  }

  // ── 30% margin goal ──
  const TARGET = 30;
  const alreadyAt30 = row.margin >= TARGET;

  // varFrac: variable cost as fraction of price (from current row data)
  const varFrac = estimatedPrice > 0 ? varSliceR / estimatedPrice : 0;
  const factor = 1 - varFrac - TARGET / 100; // headroom after variable costs and 30% margin

  // Price needed for 30% with current pax
  const priceFor30 = factor > 0 && totalFixed > 0
    ? totalFixed / (row.pax * factor)
    : null;

  // Pax needed for 30% with current price
  const paxFor30 = factor > 0 && totalFixed > 0
    ? Math.ceil(totalFixed / (estimatedPrice * factor))
    : null;

  // Fixed cost reduction needed for 30% with current price and pax
  // margin = (price*pax - totalFixed - varSliceR*pax) / (price*pax) = 0.30
  // totalFixed = price*pax*(1 - varFrac - 0.30)
  const maxFixedFor30 = estimatedPrice * row.pax * factor;
  const costCutNeeded = totalFixed > 0 ? totalFixed - maxFixedFor30 : null;

  return (
    <div className="space-y-2.5">
      {insights.map((ins, i) => (
        <div key={i} className="flex items-start gap-3 bg-surface-50 rounded-xl px-4 py-3 border border-surface-100">
          <span className="text-base flex-shrink-0">{ins.icon}</span>
          <p className="text-sm text-surface-700 leading-relaxed">{ins.text}</p>
        </div>
      ))}

      {/* 30% goal card — collapsible */}
      <MarginGoalCard
        currentMargin={row.margin}
        alreadyAt30={alreadyAt30}
        priceFor30={priceFor30}
        paxFor30={paxFor30}
        costCutNeeded={costCutNeeded}
        currentPax={row.pax}
        currentPrice={estimatedPrice}
      />
    </div>
  );
}

/* ── 30% Margin Goal Card ────────────────────────────────────────────────── */

function MarginGoalCard({
  currentMargin,
  alreadyAt30,
  priceFor30,
  paxFor30,
  costCutNeeded,
  currentPax,
  currentPrice,
}: {
  currentMargin: number;
  alreadyAt30: boolean;
  priceFor30: number | null;
  paxFor30: number | null;
  costCutNeeded: number | null;
  currentPax: number;
  currentPrice: number;
}) {
  const [open, setOpen] = useState(false);

  if (alreadyAt30) {
    return (
      <div className="flex items-start gap-3 bg-emerald-50 rounded-xl px-4 py-3 border border-emerald-200">
        <span className="text-base flex-shrink-0">🏆</span>
        <p className="text-sm text-emerald-700 leading-relaxed font-semibold">
          Sua margem atual de {formatPercent(currentMargin)} já supera os 30%. Ótimo trabalho!
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-brand-orange-200 overflow-hidden">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-brand-orange-50 hover:bg-brand-orange-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🎯</span>
          <span className="text-sm font-bold text-brand-orange">Como chegar em 30% de margem?</span>
        </div>
        <span className="text-brand-orange">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {/* Expandable content */}
      {open && (
        <div className="px-4 py-4 bg-white space-y-3">
          <p className="text-xs text-surface-500 leading-relaxed">
            Sua margem atual é <strong>{formatPercent(currentMargin)}</strong>. Aqui estão três caminhos para atingir os 30%:
          </p>

          {/* Option A — raise price */}
          {priceFor30 !== null && priceFor30 > currentPrice && (
            <div className="flex items-start gap-3 rounded-xl bg-surface-50 border border-surface-200 px-4 py-3">
              <span className="text-base flex-shrink-0">💰</span>
              <div>
                <p className="text-sm font-bold text-surface-800">Aumentar o preço</p>
                <p className="text-sm text-surface-600 leading-relaxed">
                  Com {currentPax} passageiros, você precisaria cobrar{' '}
                  <strong className="text-brand-navy">{formatBRL(priceFor30)}</strong> por pessoa
                  {' '}(hoje é {formatBRL(currentPrice)}, diferença de {formatBRL(priceFor30 - currentPrice)}).
                </p>
              </div>
            </div>
          )}

          {/* Option B — more people */}
          {paxFor30 !== null && paxFor30 > currentPax && (
            <div className="flex items-start gap-3 rounded-xl bg-surface-50 border border-surface-200 px-4 py-3">
              <span className="text-base flex-shrink-0">👥</span>
              <div>
                <p className="text-sm font-bold text-surface-800">Trazer mais pessoas</p>
                <p className="text-sm text-surface-600 leading-relaxed">
                  Mantendo o preço de {formatBRL(currentPrice)}, você precisaria de{' '}
                  <strong className="text-brand-navy">{paxFor30} passageiros</strong>
                  {' '}(mais {paxFor30 - currentPax} que agora).
                </p>
              </div>
            </div>
          )}

          {/* Option C — cut fixed costs */}
          {costCutNeeded !== null && costCutNeeded > 0 && (
            <div className="flex items-start gap-3 rounded-xl bg-surface-50 border border-surface-200 px-4 py-3">
              <span className="text-base flex-shrink-0">✂️</span>
              <div>
                <p className="text-sm font-bold text-surface-800">Reduzir custos fixos</p>
                <p className="text-sm text-surface-600 leading-relaxed">
                  Mantendo preço e passageiros, seria necessário cortar{' '}
                  <strong className="text-brand-navy">{formatBRL(costCutNeeded)}</strong> dos custos fixos do roteiro.
                </p>
              </div>
            </div>
          )}

          {priceFor30 === null && paxFor30 === null && costCutNeeded === null && (
            <p className="text-xs text-surface-500">
              Com os custos variáveis atuais, os 30% de margem não são alcançáveis com esse preço. Revise as taxas e comissões.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────────────── */

export function SimulationResults({
  simulation,
  estimatedPrice,
  isExplorationMode,
  breakEvenPax,
  simulationPax,
}: SimulationResultsProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const { rows } = simulation;

  /* ── Empty state ─────────────────────────────────────────────────────── */
  if (estimatedPrice <= 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">📊</div>
        <h3 className="text-lg font-bold text-surface-700 mb-2">Defina um preço para simular</h3>
        <p className="text-sm text-surface-400 max-w-sm mx-auto">
          Preencha os custos fixos, variáveis e o preço estimado por passageiro para ver os resultados.
        </p>
      </div>
    );
  }

  /* ── Primary row: simulationPax in exploration mode, first row otherwise ── */
  const row = isExplorationMode
    ? (simulation.rows.find(r => r.pax === simulationPax) ?? rows[0])
    : rows[0];
  if (!row) return null;

  const isProfitable = row.finalResult > 0;
  const isBreakEven = row.finalResult === 0;
  const totalFixed = simulation.totalFixedCosts;

  const scenarioPaxList = useMemo(
    () => isExplorationMode
      ? simulation.rows.map(r => r.pax)
      : breakEvenPax !== null
        ? buildScenariosForKnownBreakEven(breakEvenPax, row.pax)
        : buildScenariosForNullBreakEven(row.pax),
    [isExplorationMode, simulation.rows, breakEvenPax, row.pax]
  );

  const statusBadge = isBreakEven
    ? { label: 'No limite', color: 'bg-amber-100 text-amber-700' }
    : isProfitable
      ? { label: '✅ Lucrando', color: 'bg-emerald-100 text-emerald-700' }
      : { label: '❌ Prejuízo', color: 'bg-red-100 text-red-600' };

  return (
    <div className="space-y-4">
      {/* ── Hero card ── */}
      <div className={cn(
        'rounded-2xl p-6 ring-1',
        isProfitable || isBreakEven ? 'bg-white ring-surface-200' : 'bg-red-50 ring-red-200'
      )}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-1">
              {row.pax} pessoa{row.pax !== 1 ? 's' : ''} simuladas
            </p>
            <p className={cn('text-4xl font-extrabold tabular-nums',
              isProfitable ? 'text-emerald-600' : isBreakEven ? 'text-amber-600' : 'text-red-500'
            )}>
              {isProfitable ? '+' : ''}{formatBRL(row.finalResult)}
            </p>
            <p className={cn('text-sm font-bold mt-1',
              isProfitable ? 'text-emerald-600' : isBreakEven ? 'text-amber-600' : 'text-red-500'
            )}>
              {formatPercent(row.margin)} de lucro
            </p>
          </div>
          <span className={cn('text-xs font-bold px-3 py-1.5 rounded-full', statusBadge.color)}>
            {statusBadge.label}
          </span>
        </div>

        {/* Secondary metrics */}
        <div className="grid grid-cols-3 gap-2">
          <MetricCard
            label="Custo por pessoa"
            value={formatBRL(row.costPerPax)}
          />
          <MetricCard
            label="Total que vai entrar"
            value={formatBRL(row.revenue)}
          />
          <MetricCard
            label="Mínimo p/ não ter prejuízo"
            value={breakEvenPax !== null ? `${breakEvenPax} pessoas` : '—'}
            sub={breakEvenPax !== null ? undefined : 'não encontrado'}
          />
        </div>
      </div>

      {/* ── Toggle button ── */}
      <button
        onClick={() => setDetailOpen(o => !o)}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-surface-300 bg-white px-4 py-3 text-sm font-bold text-surface-700 hover:bg-surface-50 active:bg-surface-100 transition-colors"
      >
        {detailOpen ? (
          <>Fechar análise <ChevronUp size={16} /></>
        ) : (
          <>Ver análise detalhada <ChevronDown size={16} /></>
        )}
      </button>

      {/* ── Expandable detail panel ── */}
      <div className={cn(
        'overflow-hidden transition-all duration-300',
        detailOpen ? 'max-h-[4000px] opacity-100' : 'max-h-0 opacity-0'
      )}>
        <div className="space-y-8 pt-2">

          {/* Section 1 */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-surface-200">
              <Target size={16} className="text-brand-orange flex-shrink-0" />
              <h4 className="text-sm font-extrabold text-surface-800">Quantas pessoas você precisa?</h4>
            </div>
            <PaxBreakEvenCard breakEvenPax={breakEvenPax} simulatedPax={row.pax} />
          </section>

          {/* Section 2 */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-surface-200">
              <DollarSign size={16} className="text-brand-orange flex-shrink-0" />
              <h4 className="text-sm font-extrabold text-surface-800">Para onde vai cada real do seu preço?</h4>
            </div>
            <PriceDistBar row={row} totalFixed={totalFixed} estimatedPrice={estimatedPrice} />
          </section>

          {/* Section 3 — Comparação de cenários */}
          <section className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-surface-200">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-brand-orange flex-shrink-0" />
                <h4 className="text-sm font-extrabold text-surface-800">O que muda com mais ou menos pessoas?</h4>
              </div>
              {isExplorationMode && (
                <span className="text-[10px] font-bold bg-brand-orange-50 text-brand-orange border border-brand-orange-200 rounded-full px-2 py-0.5 whitespace-nowrap">
                  1 a {scenarioPaxList[scenarioPaxList.length - 1]} pax
                </span>
              )}
            </div>
            <ScenariosTable
              paxList={scenarioPaxList}
              simulatedPax={row.pax}
              breakEvenPax={breakEvenPax}
              totalFixed={totalFixed}
              simulation={simulation}
              estimatedPrice={estimatedPrice}
            />
          </section>

          {/* Section 4 */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-surface-200">
              {isProfitable
                ? <TrendingUp size={16} className="text-brand-orange flex-shrink-0" />
                : <TrendingDown size={16} className="text-red-500 flex-shrink-0" />}
              <h4 className="text-sm font-extrabold text-surface-800">O que isso significa para você?</h4>
            </div>
            <InsightsList
              row={row}
              totalFixed={totalFixed}
              estimatedPrice={estimatedPrice}
              breakEvenPax={breakEvenPax}
            />
          </section>

        </div>
      </div>
    </div>
  );
}
