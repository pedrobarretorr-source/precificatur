import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Target, TrendingUp, TrendingDown, Users, DollarSign, LineChart, AlertTriangle, CheckCircle2, type LucideIcon } from 'lucide-react';
import type { SimulationSummary, SimulationRow, VariableCost } from '@/types';
import { formatBRL, formatPercent, resolvePercentageVariables, calcSimulationRow } from '@/lib/pricing-engine';
import { cn } from '@/lib/utils';
import { PricingLab } from './PricingLab';
import { ProfitCurveChart } from './ProfitCurveChart';

/* ── Props ───────────────────────────────────────────────────────────────── */

interface SimulationResultsProps {
  simulation: SimulationSummary;
  estimatedPrice: number;
  isExplorationMode: boolean;
  breakEvenPax: number | null;
  simulationPax: number;
  totalFixed: number;
  variables: VariableCost[];
  onPriceChange: (price: number) => void;
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

  const statusMsg: { Icon: LucideIcon; iconClass: string; text: string; color: string } = isExact
    ? { Icon: AlertTriangle, iconClass: 'text-amber-600', text: 'Você está exatamente no limite. Qualquer desistência gera prejuízo.', color: 'bg-amber-50 border-amber-200 text-amber-800' }
    : isOk
      ? { Icon: CheckCircle2, iconClass: 'text-emerald-600', text: `Você tem ${gap} pessoa${gap !== 1 ? 's' : ''} acima do mínimo — boa margem de segurança.`, color: 'bg-emerald-50 border-emerald-200 text-emerald-800' }
      : { Icon: AlertTriangle, iconClass: 'text-red-600', text: `Faltam ${Math.abs(gap)} pessoa${Math.abs(gap) !== 1 ? 's' : ''} para cobrir os custos. Abaixo do ponto de equilíbrio.`, color: 'bg-red-50 border-red-200 text-red-800' };

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
        <statusMsg.Icon size={16} className={cn('flex-shrink-0 mt-0.5', statusMsg.iconClass)} />
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

  const fixedW = fixedPct * scale;
  const varW = varPct * scale;
  const lucroW = lucroPct * scale;

  const sliceLabel = (pct: number) => pct >= 15;

  return (
    <div className="space-y-3">
      <div className="flex h-12 rounded-2xl overflow-hidden w-full shadow-sm ring-1 ring-surface-200">
        <div
          className="bg-gradient-to-br from-brand-navy-400 to-brand-navy flex items-center justify-center transition-all duration-500 text-white text-xs font-bold"
          style={{ width: `${fixedW}%` }}
          title={`Custos fixos: ${formatBRL(fixedSliceR)}`}
        >
          {sliceLabel(fixedW) && <span className="truncate px-1">{formatBRL(fixedSliceR)}</span>}
        </div>
        <div
          className="bg-gradient-to-br from-orange-400 to-brand-orange flex items-center justify-center transition-all duration-500 text-white text-xs font-bold"
          style={{ width: `${varW}%` }}
          title={`Custos variáveis: ${formatBRL(varSliceR)}`}
        >
          {sliceLabel(varW) && <span className="truncate px-1">{formatBRL(varSliceR)}</span>}
        </div>
        {isProfit ? (
          <div
            className="bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center transition-all duration-500 text-white text-xs font-bold"
            style={{ width: `${lucroW}%` }}
            title={`Seu lucro: ${formatBRL(lucroSliceR)}`}
          >
            {sliceLabel(lucroW) && <span className="truncate px-1">{formatBRL(lucroSliceR)}</span>}
          </div>
        ) : (
          <div
            className="bg-gradient-to-br from-red-300 to-red-500 flex items-center justify-center transition-all duration-500 text-white text-xs font-bold"
            style={{ width: `${Math.min(lucroW, 100 - fixedW - varW)}%` }}
            title={`Prejuízo: ${formatBRL(Math.abs(lucroSliceR))}`}
          >
            {sliceLabel(lucroW) && <span className="truncate px-1">{formatBRL(Math.abs(lucroSliceR))}</span>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-brand-navy-50 flex items-center justify-center flex-shrink-0">
            <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-br from-brand-navy-400 to-brand-navy" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-surface-700 truncate">Custos fixos</p>
            <p className="text-surface-500 tabular-nums">{formatBRL(fixedSliceR)} / pessoa</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-brand-orange-50 flex items-center justify-center flex-shrink-0">
            <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-br from-orange-400 to-brand-orange" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-surface-700 truncate">Taxas e variáveis</p>
            <p className="text-surface-500 tabular-nums">{formatBRL(varSliceR)} / pessoa</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0', isProfit ? 'bg-emerald-50' : 'bg-red-50')}>
            <span className={cn('w-2.5 h-2.5 rounded-sm bg-gradient-to-br', isProfit ? 'from-emerald-400 to-emerald-600' : 'from-red-300 to-red-500')} />
          </span>
          <div className="min-w-0">
            <p className={cn('font-semibold truncate', isProfit ? 'text-emerald-700' : 'text-red-600')}>
              {isProfit ? 'Seu lucro' : 'Prejuízo'}
            </p>
            <p className={cn('tabular-nums', isProfit ? 'text-emerald-600' : 'text-red-500')}>
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
  resolvedVars,
  estimatedPrice,
}: {
  paxList: number[];
  simulatedPax: number;
  breakEvenPax: number | null;
  totalFixed: number;
  resolvedVars: VariableCost[];
  estimatedPrice: number;
}) {
  const rows = paxList.map(pax => calcSimulationRow(pax, totalFixed, resolvedVars, estimatedPrice));
  const maxAbsProfit = Math.max(1, ...rows.map(r => Math.abs(r.finalResult)));

  return (
    <div className="rounded-xl border border-surface-200 overflow-hidden shadow-sm">
      <div className="overflow-y-auto overflow-x-auto max-h-[360px]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
            <tr className="bg-surface-50/95 backdrop-blur-sm border-b border-surface-200">
              <th className="text-left px-3 py-2.5 text-[11px] font-bold text-surface-500 uppercase tracking-wide">Pessoas</th>
              <th className="text-right px-3 py-2.5 text-[11px] font-bold text-surface-500 uppercase tracking-wide">Arrecadado</th>
              <th className="text-right px-3 py-2.5 text-[11px] font-bold text-surface-500 uppercase tracking-wide">Lucro / Prejuízo</th>
              <th className="text-right px-3 py-2.5 text-[11px] font-bold text-surface-500 uppercase tracking-wide">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const pax = paxList[idx];
              const isBreakEven = pax === breakEvenPax;
              const isSimulated = pax === simulatedPax;
              const isProfit = row.finalResult >= 0;
              const barWidth = (Math.abs(row.finalResult) / maxAbsProfit) * 100;

              return (
                <tr
                  key={pax}
                  className={cn(
                    'border-b border-surface-100 last:border-0 transition-colors',
                    isBreakEven ? 'bg-emerald-50/70' : isSimulated ? 'bg-brand-orange-50/70' : idx % 2 === 0 ? 'bg-white' : 'bg-surface-50/40',
                  )}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {isBreakEven ? (
                        <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                        </span>
                      ) : (
                        <span className="w-2.5 flex-shrink-0" />
                      )}
                      <span className={cn('font-bold tabular-nums', isBreakEven ? 'text-emerald-700' : 'text-surface-800')}>{pax}</span>
                      {isBreakEven && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 whitespace-nowrap">
                          <Target size={9} /> Mín.
                        </span>
                      )}
                      {isSimulated && !isBreakEven && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-orange whitespace-nowrap">
                          👤
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-surface-700 tabular-nums">
                    {formatBRL(row.revenue)}
                  </td>
                  <td className={cn('px-3 py-2.5 text-right font-bold tabular-nums relative min-w-[120px]', isProfit ? 'text-emerald-600' : 'text-red-500')}>
                    <div className="relative flex items-center justify-end gap-1.5">
                      <span
                        className={cn(
                          'absolute right-0 h-1 rounded-full -bottom-1 opacity-60',
                          isProfit ? 'bg-emerald-400' : 'bg-red-400',
                        )}
                        style={{ width: `${barWidth}%` }}
                      />
                      <span>{row.finalResult >= 0 ? '+' : ''}{formatBRL(row.finalResult)}</span>
                    </div>
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

  // ── 30% margin goal: cost-cut lever only ──
  const TARGET = 30;
  const alreadyAt30 = row.margin >= TARGET;
  const varFrac = estimatedPrice > 0 ? varSliceR / estimatedPrice : 0;
  const factor = 1 - varFrac - TARGET / 100;
  // totalFixed_max for 30% margin with current price/pax: price*pax*(1 - varFrac - 0.30)
  const maxFixedFor30 = estimatedPrice * row.pax * factor;
  const costCutNeeded = totalFixed > 0 && factor > 0 ? totalFixed - maxFixedFor30 : null;

  return (
    <div className="space-y-2.5">
      {insights.map((ins, i) => (
        <div key={i} className="flex items-start gap-3 bg-surface-50 rounded-xl px-4 py-3 border border-surface-100">
          <span className="text-base flex-shrink-0">{ins.icon}</span>
          <p className="text-sm text-surface-700 leading-relaxed">{ins.text}</p>
        </div>
      ))}

      {/* 30% goal — compact comparison + cost-cut lever */}
      <MarginGoalCard
        currentMargin={row.margin}
        alreadyAt30={alreadyAt30}
        costCutNeeded={costCutNeeded}
        totalFixed={totalFixed}
      />
    </div>
  );
}

/* ── 30% Margin Goal Card ────────────────────────────────────────────────── */

function MarginGoalCard({
  currentMargin,
  alreadyAt30,
  costCutNeeded,
  totalFixed,
}: {
  currentMargin: number;
  alreadyAt30: boolean;
  costCutNeeded: number | null;
  totalFixed: number;
}) {
  if (alreadyAt30) {
    return (
      <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-50 to-emerald-50/50 rounded-xl px-4 py-3 border border-emerald-200">
        <span className="text-lg flex-shrink-0">🏆</span>
        <p className="text-sm text-emerald-700 font-bold">
          {formatPercent(currentMargin)} de margem — excelente!
        </p>
      </div>
    );
  }

  const unreachableByCost = costCutNeeded === null || costCutNeeded >= totalFixed;

  return (
    <div className="rounded-xl border border-brand-orange-200 bg-gradient-to-br from-brand-orange-50/60 via-white to-white overflow-hidden">
      <div className="px-4 py-3 border-b border-brand-orange-100">
        <div className="flex items-center gap-2">
          <span className="text-base">🎯</span>
          <span className="text-sm font-bold text-brand-orange">Meta de 30% de margem</span>
        </div>
      </div>
      <div className="px-4 py-4 space-y-3">
        {/* Comparison row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface-50 border border-surface-200 px-3 py-2.5">
            <p className="text-[10px] font-bold text-surface-400 uppercase tracking-wider mb-0.5">Margem atual</p>
            <p className={cn(
              'text-xl font-extrabold tabular-nums',
              currentMargin >= 15 ? 'text-brand-navy' : currentMargin > 0 ? 'text-amber-600' : 'text-red-500',
            )}>
              {formatPercent(currentMargin)}
            </p>
          </div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5">
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-0.5">Margem saudável</p>
            <p className="text-xl font-extrabold text-emerald-700 tabular-nums">30%</p>
          </div>
        </div>

        {/* Cost-cut lever */}
        {!unreachableByCost && costCutNeeded !== null && costCutNeeded > 0 && (
          <div className="flex items-start gap-3 rounded-xl bg-white border border-surface-200 px-4 py-3">
            <span className="text-base flex-shrink-0">💡</span>
            <p className="text-sm text-surface-700 leading-relaxed">
              Mantendo preço e passageiros, corte{' '}
              <strong className="text-brand-navy tabular-nums">{formatBRL(costCutNeeded)}</strong>
              {' '}dos custos fixos para chegar em 30%.
            </p>
          </div>
        )}
        {unreachableByCost && (
          <p className="text-xs text-surface-500 leading-relaxed px-1">
            Com os parâmetros atuais, 30% não é alcançável só reduzindo custos fixos. Ajuste o preço ou a quantidade de passageiros no laboratório acima.
          </p>
        )}
        <p className="text-[10px] text-surface-400 leading-relaxed px-1">
          Outros caminhos — subir o preço ou trazer mais pessoas — você testa direto no laboratório e no gráfico.
        </p>
      </div>
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
  totalFixed,
  variables,
  onPriceChange,
}: SimulationResultsProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const { rows } = simulation;

  /* ── Empty state ─────────────────────────────────────────────────────── */
  if (estimatedPrice <= 0) {
    return (
      <div className="text-center py-12 rounded-2xl bg-surface-50 border border-dashed border-surface-300">
        <div className="text-4xl mb-3">📊</div>
        <h3 className="text-base font-bold text-surface-700 mb-1">Defina um preço para simular</h3>
        <p className="text-sm text-surface-400 max-w-sm mx-auto">
          Volte ao passo anterior e defina o valor por passageiro.
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

  const scenarioPaxList = useMemo(
    () => isExplorationMode
      ? simulation.rows.map(r => r.pax)
      : Array.from({ length: row.pax }, (_, i) => i + 1),
    [isExplorationMode, simulation.rows, row.pax]
  );

  // Percentage costs resolved to rateado-BRL at simulationPax — ensures the
  // fixed total (pct × price × simulationPax) is used for all pax scenarios.
  const resolvedVars = useMemo(
    () => resolvePercentageVariables(variables, estimatedPrice, simulationPax),
    [variables, estimatedPrice, simulationPax],
  );

  // Build chart points spanning 1..max(breakEven*2, simulationPax*1.5, 15)
  const chartPoints = useMemo(() => {
    const base = Math.max(
      breakEvenPax !== null ? breakEvenPax * 2 : 0,
      Math.ceil(row.pax * 1.5),
      15,
    );
    const upper = Math.min(100, base);
    const pts: { pax: number; profit: number; margin: number }[] = [];
    for (let p = 1; p <= upper; p++) {
      const r = calcSimulationRow(p, totalFixed, resolvedVars, estimatedPrice);
      pts.push({ pax: p, profit: r.finalResult, margin: r.margin });
    }
    return pts;
  }, [breakEvenPax, row.pax, totalFixed, resolvedVars, estimatedPrice]);

  const statusBadge = isBreakEven
    ? { label: 'No limite', color: 'bg-amber-100 text-amber-700' }
    : isProfitable
      ? { label: '✅ Lucrando', color: 'bg-emerald-100 text-emerald-700' }
      : { label: '❌ Prejuízo', color: 'bg-red-100 text-red-600' };

  const heroBg = isProfitable
    ? 'bg-gradient-to-br from-white via-white to-emerald-50/40 ring-emerald-100'
    : isBreakEven
      ? 'bg-gradient-to-br from-white via-white to-amber-50/40 ring-amber-100'
      : 'bg-gradient-to-br from-red-50/60 via-white to-red-50/40 ring-red-200';

  return (
    <div className="space-y-4">
      {/* ── Hero card ── */}
      <div className={cn('rounded-2xl p-6 ring-1 transition-colors duration-300', heroBg)}>
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

      {/* ── Cards always visible: Ponto de equilíbrio + Sua simulação ── */}
      <PaxBreakEvenCard breakEvenPax={breakEvenPax} simulatedPax={row.pax} />

      {/* ── Profit curve (always visible) ── */}
      <ProfitCurveChart
        points={chartPoints}
        breakEvenPax={breakEvenPax}
        simulatedPax={row.pax}
      />

      {/* ── Toggle button ── */}
      <button
        onClick={() => setDetailOpen(o => !o)}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-surface-300 bg-white px-4 py-3 text-sm font-bold text-surface-700 hover:bg-surface-50 active:bg-surface-100 transition-colors"
      >
        {detailOpen ? (
          <>Fechar análise detalhada <ChevronUp size={16} /></>
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
                <LineChart size={16} className="text-brand-orange flex-shrink-0" />
                <h4 className="text-sm font-extrabold text-surface-800">O que muda com mais ou menos pessoas?</h4>
              </div>
              {isExplorationMode && (
                <span className="text-[10px] font-bold bg-brand-orange-50 text-brand-orange border border-brand-orange-200 rounded-full px-2 py-0.5 whitespace-nowrap">
                  1 a {scenarioPaxList[scenarioPaxList.length - 1]} pax
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Users size={14} className="text-surface-400" />
              <span className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">Tabela de cenários</span>
            </div>
            <ScenariosTable
              paxList={scenarioPaxList}
              simulatedPax={row.pax}
              breakEvenPax={breakEvenPax}
              totalFixed={totalFixed}
              resolvedVars={resolvedVars}
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

          {/* ── Pricing Lab (dentro da análise detalhada) ── */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-surface-200">
              <TrendingUp size={16} className="text-brand-orange flex-shrink-0" />
              <h4 className="text-sm font-extrabold text-surface-800">Laboratório de precificação</h4>
            </div>
            <PricingLab
              price={estimatedPrice}
              totalFixed={totalFixed}
              variables={variables}
              pax={row.pax}
              breakEvenPax={breakEvenPax}
              onPriceChange={onPriceChange}
            />
          </section>

        </div>
      </div>
    </div>
  );
}
