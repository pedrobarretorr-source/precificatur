import { useMemo, useState, useEffect, useRef } from 'react';
import { Sliders } from 'lucide-react';
import {
  calcPriceFromMargin,
  calcTotalVariablePercent,
  calcVariableCostAmount,
  formatBRL,
  formatPercent,
} from '@/lib/pricing-engine';
import type { VariableCost } from '@/types';
import { cn } from '@/lib/utils';

interface PricingLabProps {
  price: number;
  totalFixed: number;
  variables: VariableCost[];
  pax: number;
  breakEvenPax: number | null;
  onPriceChange: (price: number) => void;
}

const SLIDER_MAX = 100;
const MARGIN_SHORTCUTS: { label: string; value: number | 'break-even' }[] = [
  { label: 'Break-even', value: 'break-even' },
  { label: '20%', value: 20 },
  { label: '30%', value: 30 },
  { label: '40%', value: 40 },
];

export function PricingLab({ price, totalFixed, variables, pax, breakEvenPax, onPriceChange }: PricingLabProps) {
  const totalVarPct = useMemo(() => calcTotalVariablePercent(variables), [variables]);

  const revenue = price * pax;
  const varAmount = calcVariableCostAmount(price, variables, pax) * pax;
  const totalCost = totalFixed + varAmount;
  const profit = revenue - totalCost;
  const rawMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

  const maxFeasibleMargin = useMemo(() => {
    const cap = 100 - totalVarPct - 0.1;
    return Math.max(0, Math.min(SLIDER_MAX, cap));
  }, [totalVarPct]);

  const isInfeasibleRange = maxFeasibleMargin < SLIDER_MAX;

  const [priceStr, setPriceStr] = useState(price > 0 ? price.toFixed(2) : '');
  const editingRef = useRef(false);

  useEffect(() => {
    if (editingRef.current) return;
    setPriceStr(price > 0 ? price.toFixed(2) : '');
  }, [price]);

  function handlePriceInput(v: string) {
    editingRef.current = true;
    setPriceStr(v);
    const num = parseFloat(v.replace(',', '.'));
    if (!isNaN(num) && num >= 0) onPriceChange(num);
  }

  function handlePriceBlur() {
    editingRef.current = false;
    if (price > 0) setPriceStr(price.toFixed(2));
  }

  function handleMarginChange(m: number) {
    const clamped = Math.max(0, Math.min(maxFeasibleMargin, m));
    const newPrice = calcPriceFromMargin(totalFixed, variables, clamped, pax);
    if (newPrice !== null) onPriceChange(Math.round(newPrice * 100) / 100);
  }

  function applyShortcut(value: number | 'break-even') {
    if (value === 'break-even') {
      const newPrice = calcPriceFromMargin(totalFixed, variables, 0, pax);
      if (newPrice !== null) onPriceChange(Math.round(newPrice * 100) / 100);
      return;
    }
    handleMarginChange(value);
  }

  const sliderValue = Math.max(0, Math.min(SLIDER_MAX, rawMargin));
  const sliderPct = (sliderValue / SLIDER_MAX) * 100;
  const maxPct = (maxFeasibleMargin / SLIDER_MAX) * 100;

  const marginZoneColor =
    rawMargin >= 30 ? 'text-emerald-600' :
    rawMargin >= 15 ? 'text-brand-navy' :
    rawMargin > 0 ? 'text-amber-600' : 'text-red-500';

  return (
    <div className="rounded-2xl bg-white ring-1 ring-surface-200 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-brand-orange-50 flex items-center justify-center">
          <Sliders size={14} className="text-brand-orange" />
        </div>
        <h3 className="text-sm font-extrabold text-brand-navy">Laboratório de precificação</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Price input */}
        <div>
          <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">
            Preço por passageiro
          </label>
          <div className="mt-1.5 flex items-baseline gap-1.5 px-3 py-2.5 rounded-xl border-2 border-surface-200 focus-within:border-brand-orange transition-colors">
            <span className="text-lg font-bold text-surface-400">R$</span>
            <input
              type="text"
              inputMode="decimal"
              value={priceStr}
              onChange={e => handlePriceInput(e.target.value)}
              onBlur={handlePriceBlur}
              className="flex-1 text-2xl font-extrabold text-brand-navy tabular-nums outline-none bg-transparent min-w-0"
              placeholder="0,00"
            />
          </div>
          <p className="text-[10px] text-surface-400 mt-1">Receita total: {formatBRL(revenue)}</p>
        </div>

        {/* Margin slider */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">
              Margem desejada
            </label>
            <span className={cn('text-lg font-extrabold tabular-nums', marginZoneColor)}>
              {formatPercent(rawMargin)}
            </span>
          </div>
          <div className="relative h-6 flex items-center">
            {/* Zone backdrop: 0–15% amber, 15–30% navy, 30–100% emerald */}
            <div className="absolute inset-x-0 h-2 rounded-full overflow-hidden flex">
              <div className="bg-amber-200" style={{ width: '15%' }} />
              <div className="bg-brand-navy-100" style={{ width: '15%' }} />
              <div className="bg-emerald-200" style={{ width: '70%' }} />
            </div>
            {/* Infeasible overlay */}
            {isInfeasibleRange && (
              <div
                className="absolute h-2 bg-red-100 rounded-r-full"
                style={{ left: `${maxPct}%`, right: 0 }}
                title={`Inatingível acima de ${maxFeasibleMargin.toFixed(1)}% com as taxas atuais`}
              />
            )}
            {/* Progress fill */}
            <div
              className="absolute h-2 bg-gradient-to-r from-brand-orange to-brand-orange-500 rounded-full"
              style={{ width: `${sliderPct}%` }}
            />
            {/* Actual range input */}
            <input
              type="range"
              min={0}
              max={SLIDER_MAX}
              step={0.5}
              value={sliderValue}
              onChange={e => handleMarginChange(parseFloat(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
              aria-label="Margem de lucro"
            />
            {/* Thumb visual */}
            <div
              className="absolute w-5 h-5 bg-white border-2 border-brand-orange rounded-full shadow-md pointer-events-none transition-transform"
              style={{ left: `calc(${sliderPct}% - 10px)` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-[9px] font-bold text-surface-400 uppercase tracking-wider">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
          {isInfeasibleRange && (
            <p className="text-[10px] text-red-500 mt-1">
              ⚠ Máximo viável: {formatPercent(maxFeasibleMargin)} (taxas consomem {formatPercent(totalVarPct)})
            </p>
          )}
        </div>
      </div>

      {/* Shortcut chips */}
      <div className="mt-4 pt-4 border-t border-surface-100">
        <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-2">Atalhos</p>
        <div className="flex flex-wrap gap-2">
          {MARGIN_SHORTCUTS.map(s => {
            const disabled = s.value === 'break-even'
              ? breakEvenPax === null && pax <= 0
              : typeof s.value === 'number' && s.value > maxFeasibleMargin;
            const active = s.value !== 'break-even' && Math.abs(rawMargin - s.value) < 0.05;
            return (
              <button
                key={s.label}
                type="button"
                onClick={() => applyShortcut(s.value)}
                disabled={disabled}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-bold transition-all',
                  disabled
                    ? 'bg-surface-100 text-surface-300 cursor-not-allowed'
                    : active
                      ? 'bg-brand-orange text-white shadow-sm'
                      : 'bg-surface-100 text-surface-600 hover:bg-brand-orange-50 hover:text-brand-orange',
                )}
                title={
                  s.value === 'break-even'
                    ? 'Preço que zera lucro e prejuízo'
                    : `Ajustar preço para ${s.label} de margem`
                }
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
