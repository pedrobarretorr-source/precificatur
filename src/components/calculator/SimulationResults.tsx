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

function PaxProgressBar({ breakEvenPax, simulatedPax }: { breakEvenPax: number | null; simulatedPax: number }) {
  if (breakEvenPax === null) {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
        Com os custos e preço atuais, não foi possível calcular o mínimo de pessoas. Tente aumentar o preço ou reduzir os custos.
      </div>
    );
  }

  const isOk = simulatedPax >= breakEvenPax;
  const barMax = Math.round(Math.max(breakEvenPax, simulatedPax) * 1.5);
  const breakEvenPct = Math.min(100, (breakEvenPax / barMax) * 100);
  const simulatedPct = Math.min(100, (simulatedPax / barMax) * 100);

  return (
    <div className="space-y-3">
      <div className="relative h-6 rounded-full bg-surface-200 overflow-hidden">
        {/* Break-even segment */}
        <div
          className={cn('absolute left-0 top-0 h-full rounded-full transition-all duration-500',
            isOk ? 'bg-emerald-400' : 'bg-red-400'
          )}
          style={{ width: `${breakEvenPct}%` }}
        />
        {/* Simulated pax marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-brand-navy"
          style={{ left: `${simulatedPct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-surface-500">
        <span>0</span>
        <span className="font-bold text-surface-700">{barMax} pessoas</span>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1.5">
          <span className={cn('w-3 h-3 rounded-full flex-shrink-0', isOk ? 'bg-emerald-400' : 'bg-red-400')} />
          <span>Mínimo para lucrar: <strong>{breakEvenPax} pessoas</strong></span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-0.5 h-4 bg-brand-navy flex-shrink-0" />
          <span>Sua simulação: <strong>{simulatedPax} pessoas</strong></span>
        </span>
      </div>

      <p className={cn('text-sm font-semibold', isOk ? 'text-emerald-700' : 'text-red-600')}>
        {isOk
          ? simulatedPax === breakEvenPax
            ? `Você simulou exatamente o mínimo. Qualquer desistência gera prejuízo.`
            : `✅ Você simulou ${simulatedPax - breakEvenPax} pessoa${simulatedPax - breakEvenPax !== 1 ? 's' : ''} acima do mínimo.`
          : `⚠️ Faltam ${breakEvenPax - simulatedPax} pessoa${breakEvenPax - simulatedPax !== 1 ? 's' : ''} para começar a lucrar.`
        }
      </p>
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
    <div className="overflow-x-auto rounded-xl border border-surface-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-50 border-b border-surface-200">
            <th className="text-left px-3 py-2.5 text-[11px] font-bold text-surface-500 uppercase tracking-wide">Pessoas</th>
            <th className="text-right px-3 py-2.5 text-[11px] font-bold text-surface-500 uppercase tracking-wide">Total arrecadado</th>
            <th className="text-right px-3 py-2.5 text-[11px] font-bold text-surface-500 uppercase tracking-wide">Lucro / Prejuízo</th>
            <th className="text-right px-3 py-2.5 text-[11px] font-bold text-surface-500 uppercase tracking-wide">% de lucro</th>
          </tr>
        </thead>
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
                    <span className="font-bold text-surface-800">{pax}</span>
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

  return (
    <div className="space-y-2.5">
      {insights.map((ins, i) => (
        <div key={i} className="flex items-start gap-3 bg-surface-50 rounded-xl px-4 py-3 border border-surface-100">
          <span className="text-base flex-shrink-0">{ins.icon}</span>
          <p className="text-sm text-surface-700 leading-relaxed">{ins.text}</p>
        </div>
      ))}
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
            <PaxProgressBar breakEvenPax={breakEvenPax} simulatedPax={row.pax} />
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
