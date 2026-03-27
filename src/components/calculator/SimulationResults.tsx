import { useMemo } from 'react';
import { Target, Users, ArrowRight, Lightbulb } from 'lucide-react';
import type { SimulationSummary, SimulationRow } from '@/types';
import { formatBRL, formatPercent } from '@/lib/pricing-engine';
import { cn } from '@/lib/utils';

/* ── Props ───────────────────────────────────────────────────────────────── */

interface SimulationResultsProps {
  simulation: SimulationSummary;
  estimatedPrice: number;
  isExplorationMode: boolean;
  breakEvenPax: number | null;
  onCompareScenarios: () => void;
}

/* ── Key scenario selector (Exploration Mode) ────────────────────────────── */

function selectKeyScenarios(rows: SimulationRow[], breakEvenPax: number | null): number[] {
  const min = rows[0].pax;
  const max = rows[rows.length - 1].pax;
  const mid = Math.round((min + max) / 2);
  const range = max - min;

  const points = new Set<number>([min, max]);
  if (mid !== min && mid !== max) points.add(mid);
  if (breakEvenPax && breakEvenPax >= min && breakEvenPax <= max) points.add(breakEvenPax);
  if (range > 20) {
    const q1 = Math.round(min + range * 0.25);
    if (!points.has(q1)) points.add(q1);
  }

  return Array.from(points).sort((a, b) => a - b);
}

/* ── Metric tile (reusable) ──────────────────────────────────────────────── */

function MetricTile({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">
        {label}
      </span>
      <span
        className={cn(
          'text-base font-extrabold',
          positive === undefined
            ? 'text-brand-navy'
            : positive
            ? 'text-emerald-600'
            : 'text-red-500'
        )}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </span>
    </div>
  );
}

/* ── Component ──────────────────────────────────────────────────────────── */

export function SimulationResults({
  simulation,
  estimatedPrice,
  isExplorationMode,
  breakEvenPax,
  onCompareScenarios,
}: SimulationResultsProps) {
  const { rows } = simulation;

  // Hooks must be called unconditionally — compute key scenarios always.
  const keyPaxValues = useMemo(
    () => (rows.length > 0 ? selectKeyScenarios(rows, breakEvenPax) : []),
    [rows, breakEvenPax]
  );

  /* ── Empty state ─────────────────────────────────────────────────────── */

  if (estimatedPrice <= 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">📊</div>
        <h3 className="text-lg font-bold text-surface-700 mb-2">
          Defina um preço para simular
        </h3>
        <p className="text-sm text-surface-400 max-w-sm mx-auto">
          Preencha os custos fixos, variáveis e o preço estimado por passageiro
          para ver a simulação de resultados.
        </p>
      </div>
    );
  }

  /* ── Direct Mode ─────────────────────────────────────────────────────── */

  if (!isExplorationMode) {
    const row = rows[0];
    if (!row) return null;

    const isProfitable = row.finalResult > 0;
    const isBreakEven = row.finalResult === 0;

    let observation: React.ReactNode;

    if (isBreakEven) {
      observation = (
        <p className="text-sm text-surface-600">
          Com {row.pax} passageiros você cobre exatamente seus custos.
        </p>
      );
    } else if (isProfitable) {
      observation = (
        <>
          <p className="text-sm text-surface-600">
            Com {row.pax} passageiros você tem margem de{' '}
            <span className="font-bold text-emerald-600">{formatPercent(row.margin)}</span>.
            {breakEvenPax != null && (
              <>
                {' '}Seu ponto de equilíbrio é{' '}
                <span className="font-bold">{breakEvenPax} pax</span>.
              </>
            )}
          </p>
          {breakEvenPax === null && (
            <p className="text-sm text-surface-500 mt-1">
              Não foi possível encontrar o ponto de equilíbrio até 100 passageiros.
            </p>
          )}
        </>
      );
    } else {
      observation = (
        <>
          <p className="text-sm text-surface-600">
            Com {row.pax} passageiros você tem prejuízo de{' '}
            <span className="font-bold text-red-500">
              {formatBRL(Math.abs(row.finalResult))}
            </span>.
            {breakEvenPax != null && (
              <>
                {' '}Você precisa de pelo menos{' '}
                <span className="font-bold">{breakEvenPax} passageiros</span> para cobrir os custos.
              </>
            )}
          </p>
          {breakEvenPax === null && (
            <p className="text-sm text-surface-500 mt-1">
              Não foi possível encontrar o ponto de equilíbrio até 100 passageiros.
            </p>
          )}
        </>
      );
    }

    return (
      <div className="rounded-2xl bg-white ring-1 ring-surface-200 p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-navy flex items-center justify-center flex-shrink-0">
            <Users size={16} className="text-white" />
          </div>
          <h3 className="text-base font-extrabold text-brand-navy">
            Resultado para {row.pax} passageiro{row.pax !== 1 ? 's' : ''}
          </h3>
        </div>

        {/* 4-metric grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetricTile label="Custo por pax" value={formatBRL(row.costPerPax)} />
          <MetricTile label="Receita total" value={formatBRL(row.revenue)} />
          <MetricTile
            label="Resultado"
            value={formatBRL(row.finalResult)}
            positive={row.finalResult >= 0}
          />
          <MetricTile
            label="Margem"
            value={formatPercent(row.margin)}
            positive={row.margin >= 0}
          />
        </div>

        {/* Observations */}
        <div className="bg-surface-50 rounded-xl p-4 flex gap-3">
          <Lightbulb size={18} className="text-brand-orange flex-shrink-0 mt-0.5" />
          <div>{observation}</div>
        </div>

        {/* CTA */}
        <button
          onClick={onCompareScenarios}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-navy px-4 py-3 text-sm font-bold text-white hover:opacity-90 active:opacity-80 transition-opacity"
        >
          Comparar cenários
          <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  /* ── Exploration Mode ────────────────────────────────────────────────── */

  const keyRows = keyPaxValues
    .map(pax => rows.find(r => r.pax === pax))
    .filter((r): r is SimulationRow => r !== undefined);

  const minPax = rows[0]?.pax ?? 0;
  const maxPax = rows[rows.length - 1]?.pax ?? 0;
  const breakEvenOutsideRange =
    breakEvenPax != null &&
    (breakEvenPax < minPax || breakEvenPax > maxPax);

  return (
    <div className="space-y-3">
      {keyRows.map(row => {
        const isBreakEvenCard = row.pax === breakEvenPax;
        const isProfitable = row.finalResult >= 0;

        return (
          <div
            key={row.pax}
            className={cn(
              'rounded-2xl p-5 ring-1 space-y-4',
              isBreakEvenCard
                ? 'bg-emerald-50 ring-emerald-200'
                : isProfitable
                ? 'bg-white ring-surface-200'
                : 'bg-red-50 ring-red-200'
            )}
          >
            {/* Card header */}
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'text-xl font-extrabold',
                  isBreakEvenCard
                    ? 'text-emerald-700'
                    : isProfitable
                    ? 'text-brand-navy'
                    : 'text-red-600'
                )}
              >
                {row.pax} pax
              </span>
              {isBreakEvenCard && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                  <Target size={10} />
                  Equilíbrio
                </span>
              )}
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricTile label="Custo total" value={formatBRL(row.totalCost)} />
              <MetricTile label="Receita" value={formatBRL(row.revenue)} />
              <MetricTile
                label="Resultado"
                value={formatBRL(row.finalResult)}
                positive={isProfitable}
              />
              <MetricTile
                label="Margem"
                value={formatPercent(row.margin)}
                positive={isProfitable}
              />
            </div>
          </div>
        );
      })}

      {/* Footer notes */}
      {breakEvenOutsideRange && (
        <p className="text-[11px] text-surface-500 flex items-start gap-1.5 px-1 pt-1">
          <Target size={12} className="text-emerald-500 flex-shrink-0 mt-0.5" />
          O ponto de equilíbrio está em{' '}
          <span className="font-bold text-emerald-600">{breakEvenPax} pax</span>,
          fora da faixa selecionada.
        </p>
      )}
      {breakEvenPax === null && (
        <p className="text-[11px] text-surface-500 px-1 pt-1">
          Não foi possível encontrar o ponto de equilíbrio até 100 passageiros.
        </p>
      )}
    </div>
  );
}
