import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { CostItem, CostCategory } from '@/types';
import { COST_CATEGORY_LABELS } from '@/types';
import { formatBRL } from '@/lib/pricing-engine';
import { cn } from '@/lib/utils';

interface FixedCostsFormProps {
  costs: CostItem[];
  totalFixed: number;
  onAdd: (item: Omit<CostItem, 'id'>) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<CostItem>) => void;
}

const CATEGORY_ICONS: Record<CostCategory, string> = {
  transfer: '🚐',
  hospedagem: '🏨',
  alimentacao: '🍽️',
  guia: '🧭',
  ingresso: '🎫',
  equipamento: '🎒',
  seguro: '🛡️',
  outro: '📦',
};

export function FixedCostsForm({ costs, totalFixed, onAdd, onRemove, onUpdate }: FixedCostsFormProps) {
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newCategory, setNewCategory] = useState<CostCategory>('transfer');

  const handleAdd = () => {
    if (!newLabel.trim() || !newValue) return;
    onAdd({
      label: newLabel.trim(),
      value: parseFloat(newValue) || 0,
      category: newCategory,
      currency: 'BRL',
    });
    setNewLabel('');
    setNewValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-brand-navy">Custos fixos</h3>
        <span className="text-sm font-semibold text-surface-500">
          Total: <span className="text-brand-navy">{formatBRL(totalFixed)}</span>
        </span>
      </div>

      {/* Existing costs */}
      <div className="space-y-2 mb-4">
        {costs.length === 0 && (
          <p className="text-sm text-surface-400 text-center py-6">
            Nenhum custo fixo adicionado. Adicione itens como transfer, diárias, alimentação...
          </p>
        )}
        {costs.map((cost, index) => (
          <div
            key={cost.id}
            className={cn(
              'flex items-center gap-3 p-3 rounded-xl transition-all animate-slide-up',
              index % 2 === 0 ? 'bg-surface-100' : 'bg-white'
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <span className="text-lg flex-shrink-0" role="img">
              {CATEGORY_ICONS[cost.category]}
            </span>
            <div className="flex-1 min-w-0">
              <input
                className="text-sm font-semibold text-surface-800 bg-transparent border-none p-0
                           focus:outline-none focus:ring-0 w-full"
                value={cost.label}
                onChange={e => onUpdate(cost.id, { label: e.target.value })}
              />
              <span className="text-xs text-surface-400">
                {COST_CATEGORY_LABELS[cost.category]}
              </span>
            </div>
            <input
              type="number"
              className="w-20 sm:w-28 text-right text-sm font-bold text-brand-navy bg-white
                         border border-surface-300 rounded-lg px-2 py-1.5
                         focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
              value={cost.value || ''}
              onChange={e => onUpdate(cost.id, { value: parseFloat(e.target.value) || 0 })}
            />
            <button
              onClick={() => onRemove(cost.id)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg
                         text-surface-400 hover:text-red-500 hover:bg-red-50 transition-all"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Add new cost */}
      <div className="flex flex-wrap items-end gap-2 pt-3 border-t border-surface-200">
        <div className="w-full sm:flex-1">
          <label className="input-label">Descrição</label>
          <input
            className="input text-sm"
            placeholder="Ex: Transfer aeroporto"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="w-full sm:w-36">
          <label className="input-label">Categoria</label>
          <select
            className="input text-sm"
            value={newCategory}
            onChange={e => setNewCategory(e.target.value as CostCategory)}
          >
            {Object.entries(COST_CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 sm:w-28 sm:flex-none">
          <label className="input-label">Valor (R$)</label>
          <input
            type="number"
            className="input text-sm text-right"
            placeholder="0,00"
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={!newLabel.trim() || !newValue}
          className="btn-primary btn-sm flex-shrink-0"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}
