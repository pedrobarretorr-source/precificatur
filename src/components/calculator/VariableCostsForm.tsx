import type { VariableCost } from '@/types';

interface VariableCostsFormProps {
  costs: VariableCost[];
  onUpdate: (id: string, percentage: number) => void;
}

export function VariableCostsForm({ costs, onUpdate }: VariableCostsFormProps) {
  const totalPercent = costs.reduce((sum, v) => sum + v.percentage, 0);

  return (
    <div className="card">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <h3 className="text-lg font-bold text-brand-navy">Custos variáveis</h3>
        <span className="text-sm font-semibold text-surface-500">
          Total: <span className="text-brand-navy">{totalPercent.toFixed(1)}%</span> do preço
        </span>
      </div>

      <p className="text-xs text-surface-400 mb-4">
        Percentuais aplicados sobre o preço de venda. Valores sugeridos para o mercado de turismo.
      </p>

      <div className="space-y-3">
        {costs.map(cost => (
          <div key={cost.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <label className="text-sm font-medium text-surface-700">
              {cost.label}
            </label>
            <div className="flex items-center gap-2 w-full sm:w-48">
              <input
                type="range"
                min="0"
                max="30"
                step="0.5"
                value={cost.percentage}
                onChange={e => onUpdate(cost.id, parseFloat(e.target.value))}
                className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer
                           bg-surface-300 accent-brand-orange"
              />
              <div className="w-16 text-right">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={cost.percentage}
                  onChange={e => onUpdate(cost.id, parseFloat(e.target.value) || 0)}
                  className="w-full text-right text-sm font-bold text-brand-navy
                             bg-surface-100 border border-surface-300 rounded-lg px-2 py-1
                             focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                />
              </div>
              <span className="text-xs text-surface-400 w-4">%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Visual bar */}
      <div className="mt-4 pt-3 border-t border-surface-200">
        <div className="h-2 rounded-full bg-surface-200 overflow-hidden">
          <div
            className="h-full rounded-full gradient-accent transition-all duration-500"
            style={{ width: `${Math.min(totalPercent, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-surface-400">0%</span>
          <span className="text-xs text-surface-400">
            {totalPercent > 50 && '⚠️ '}
            {totalPercent.toFixed(1)}% do preço vai para custos variáveis
          </span>
        </div>
      </div>
    </div>
  );
}
