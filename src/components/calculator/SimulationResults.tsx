import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { TrendingUp, TrendingDown, Target, Users } from 'lucide-react';
import type { SimulationSummary } from '@/types';
import { formatBRL, formatPercent } from '@/lib/pricing-engine';
import { cn } from '@/lib/utils';

interface SimulationResultsProps {
  simulation: SimulationSummary;
  keyScenarios: number[];
  estimatedPrice: number;
}

export function SimulationResults({ simulation, keyScenarios, estimatedPrice }: SimulationResultsProps) {
  const { breakEvenPax, rows } = simulation;

  const chartData = useMemo(() =>
    rows.map(row => ({
      pax: row.pax,
      custoTotal: row.totalCost,
      receita: row.revenue,
      resultado: row.finalResult,
    })),
    [rows]
  );

  const scenarioRows = useMemo(() =>
    keyScenarios.map(pax => rows.find(r => r.pax === pax)).filter(Boolean),
    [keyScenarios, rows]
  );

  if (estimatedPrice <= 0) {
    return (
      <div className="card text-center py-12">
        <div className="text-5xl mb-4">📊</div>
        <h3 className="text-lg font-bold text-surface-700 mb-2">
          Defina um preço para simular
        </h3>
        <p className="text-sm text-surface-400 max-w-sm mx-auto">
          Preencha os custos fixos, variáveis e o preço estimado por passageiro para ver a simulação de resultados.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Break-even */}
        <div className={cn(
          'card-hover text-center',
          breakEvenPax ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-red-500'
        )}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Target size={18} className={breakEvenPax ? 'text-emerald-500' : 'text-red-500'} />
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
              Ponto de equilíbrio
            </span>
          </div>
          <p className={cn(
            'text-3xl font-extrabold',
            breakEvenPax ? 'text-emerald-600' : 'text-red-500'
          )}>
            {breakEvenPax ? `${breakEvenPax} pax` : '—'}
          </p>
          <p className="text-xs text-surface-400 mt-1">
            {breakEvenPax
              ? 'mínimo para não ter prejuízo'
              : 'preço insuficiente para cobrir custos'}
          </p>
        </div>

        {/* Fixed costs */}
        <div className="card-hover text-center border-l-4 border-l-brand-navy">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Users size={18} className="text-brand-navy" />
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
              Custos fixos
            </span>
          </div>
          <p className="text-3xl font-extrabold text-brand-navy">
            {formatBRL(simulation.totalFixedCosts)}
          </p>
          <p className="text-xs text-surface-400 mt-1">
            independente da qtd de pax
          </p>
        </div>

        {/* Margin at 10 pax */}
        {rows.length >= 10 && (
          <div className={cn(
            'card-hover text-center border-l-4',
            rows[9].margin > 0 ? 'border-l-brand-orange' : 'border-l-red-400'
          )}>
            <div className="flex items-center justify-center gap-2 mb-2">
              {rows[9].margin > 0
                ? <TrendingUp size={18} className="text-brand-orange" />
                : <TrendingDown size={18} className="text-red-400" />
              }
              <span className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
                Margem com 10 pax
              </span>
            </div>
            <p className={cn(
              'text-3xl font-extrabold',
              rows[9].margin > 0 ? 'text-brand-orange' : 'text-red-500'
            )}>
              {formatPercent(rows[9].margin)}
            </p>
            <p className="text-xs text-surface-400 mt-1">
              resultado: {formatBRL(rows[9].finalResult)}
            </p>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="card">
        <h3 className="text-lg font-bold text-brand-navy mb-4">Receita vs Custo por passageiros</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
              <defs>
                <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#203478" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#203478" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradCusto" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EC6907" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#EC6907" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EF" />
              <XAxis
                dataKey="pax"
                tick={{ fontSize: 12, fill: '#6B7489' }}
                axisLine={{ stroke: '#C8CDD9' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6B7489' }}
                axisLine={{ stroke: '#C8CDD9' }}
                tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid #E4E7EF',
                  boxShadow: '0 4px 12px rgba(32,52,120,0.08)',
                  fontSize: '13px',
                }}
                formatter={(value: number, name: string) => [
                  formatBRL(value),
                  name === 'receita' ? 'Receita' : name === 'custoTotal' ? 'Custo total' : 'Resultado'
                ]}
                labelFormatter={(pax: number) => `${pax} passageiros`}
              />
              {breakEvenPax && (
                <ReferenceLine
                  x={breakEvenPax}
                  stroke="#10B981"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  label={{
                    value: `Equilíbrio: ${breakEvenPax} pax`,
                    position: 'top',
                    fontSize: 11,
                    fill: '#10B981',
                    fontWeight: 600,
                  }}
                />
              )}
              <Area
                type="monotone"
                dataKey="receita"
                stroke="#203478"
                strokeWidth={2.5}
                fill="url(#gradReceita)"
              />
              <Area
                type="monotone"
                dataKey="custoTotal"
                stroke="#EC6907"
                strokeWidth={2.5}
                fill="url(#gradCusto)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Scenario table */}
      <div className="card overflow-hidden">
        <h3 className="text-lg font-bold text-brand-navy mb-4">Cenários-chave</h3>
        <div className="overflow-x-auto -mx-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-brand-navy text-white">
                <th className="px-4 py-3 text-left font-semibold">Pax</th>
                <th className="px-4 py-3 text-right font-semibold">Custo/pax</th>
                <th className="px-4 py-3 text-right font-semibold">Custo total</th>
                <th className="px-4 py-3 text-right font-semibold">Receita</th>
                <th className="px-4 py-3 text-right font-semibold">Resultado</th>
                <th className="px-4 py-3 text-right font-semibold">Margem</th>
              </tr>
            </thead>
            <tbody>
              {scenarioRows.map((row, i) => {
                if (!row) return null;
                const isBreakEven = row.pax === breakEvenPax;
                const isProfitable = row.finalResult >= 0;
                return (
                  <tr
                    key={row.pax}
                    className={cn(
                      'border-b border-surface-200 transition-colors',
                      isBreakEven && 'bg-emerald-50 font-semibold',
                      !isBreakEven && i % 2 === 0 && 'bg-surface-50',
                    )}
                  >
                    <td className="px-4 py-3 font-bold">
                      {row.pax}
                      {isBreakEven && (
                        <span className="ml-2 badge-success">equilíbrio</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">{formatBRL(row.costPerPax)}</td>
                    <td className="px-4 py-3 text-right">{formatBRL(row.totalCost)}</td>
                    <td className="px-4 py-3 text-right">{formatBRL(row.revenue)}</td>
                    <td className={cn(
                      'px-4 py-3 text-right font-bold',
                      isProfitable ? 'text-emerald-600' : 'text-red-500'
                    )}>
                      {formatBRL(row.finalResult)}
                    </td>
                    <td className={cn(
                      'px-4 py-3 text-right font-semibold',
                      isProfitable ? 'text-emerald-600' : 'text-red-500'
                    )}>
                      {formatPercent(row.margin)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
