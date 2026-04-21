/**
 * SettingsPage.tsx
 * Página de configurações de custos customizados do usuário
 */
import { useState, useRef } from 'react';
import { Settings, Plus, Trash2, HelpCircle, Truck, BedDouble, Utensils, Compass, Ticket, Backpack, Shield, Package, ChevronDown, type LucideIcon } from 'lucide-react';
import { useCustomCosts, type CustomFixedCost, type CustomVariableCost } from '@/hooks/useCustomCosts';
import { COST_CATEGORY_LABELS, type CostCategory, type Currency } from '@/types';
import { formatBRL } from '@/lib/pricing-engine';
import { cn } from '@/lib/utils';

// ── Ícones das categorias (mesmos da CalculatorPage) ──
const CATEGORY_ICON: Record<CostCategory, LucideIcon> = {
  transfer: Truck,
  hospedagem: BedDouble,
  alimentacao: Utensils,
  guia: Compass,
  ingresso: Ticket,
  equipamento: Backpack,
  seguro: Shield,
  outro: Package,
};

function CategoryIcon({ category, size = 20, className }: { category: CostCategory; size?: number; className?: string }) {
  const Icon = CATEGORY_ICON[category];
  return <Icon size={size} className={cn('text-surface-500', className)} />;
}

// ── Paleta de cores para custos variáveis ──
const COLOR_OPTIONS = [
  { id: 'red',    label: 'Vermelho',    bg: 'bg-red-500',    ring: 'ring-red-500' },
  { id: 'orange', label: 'Laranja',    bg: 'bg-orange-500',  ring: 'ring-orange-500' },
  { id: 'amber',  label: 'Âmbar',      bg: 'bg-amber-500',   ring: 'ring-amber-500' },
  { id: 'yellow', label: 'Amarelo',    bg: 'bg-yellow-500',  ring: 'ring-yellow-500' },
  { id: 'lime',   label: 'Lima',       bg: 'bg-lime-500',    ring: 'ring-lime-500' },
  { id: 'green',  label: 'Verde',      bg: 'bg-green-500',   ring: 'ring-green-500' },
  { id: 'teal',   label: 'Verde-azul', bg: 'bg-teal-500',    ring: 'ring-teal-500' },
  { id: 'cyan',   label: 'Ciano',      bg: 'bg-cyan-500',    ring: 'ring-cyan-500' },
  { id: 'blue',   label: 'Azul',       bg: 'bg-blue-500',    ring: 'ring-blue-500' },
  { id: 'indigo', label: 'Índigo',      bg: 'bg-indigo-500',  ring: 'ring-indigo-500' },
  { id: 'violet', label: 'Violeta',    bg: 'bg-violet-500',  ring: 'ring-violet-500' },
  { id: 'purple', label: 'Roxo',       bg: 'bg-purple-500',  ring: 'ring-purple-500' },
  { id: 'fuchsia',label: 'Fúcsia',     bg: 'bg-fuchsia-500', ring: 'ring-fuchsia-500' },
  { id: 'pink',   label: 'Rosa',       bg: 'bg-pink-500',    ring: 'ring-pink-500' },
  { id: 'rose',   label: 'Rosa escuro', bg: 'bg-rose-500',   ring: 'ring-rose-500' },
];

const DEFAULT_COLOR_ID = 'orange';

function getColorById(id: string) {
  return COLOR_OPTIONS.find(c => c.id === id) ?? COLOR_OPTIONS[0];
}

// ── Tooltip Component ──
function Tooltip({ text }: { text: string }) {
  return (
    <div className="group relative inline-flex">
      <HelpCircle size={14} className="text-surface-400 hover:text-surface-600 cursor-help ml-1" />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
        <div className="bg-brand-navy text-white text-xs rounded-xl px-3 py-2 shadow-lg max-w-xs whitespace-normal">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-brand-navy" />
        </div>
      </div>
    </div>
  );
}


const CURRENCY_OPTIONS: { value: Currency; label: string }[] = [
  { value: 'BRL', label: 'R$ Real' },
  { value: 'USD', label: 'US$ Dólar' },
  { value: 'EUR', label: '€ Euro' },
  { value: 'VES', label: 'Bs Bolívar' },
];

export function SettingsPage() {
  const {
    fixedCosts,
    variableCosts,
    loading,
    saving,
    addFixedCost,
    updateFixedCost,
    deleteFixedCost,
    addVariableCost,
    updateVariableCost,
    deleteVariableCost,
    exportCosts,
    importCosts,
    resetToDefaults,
  } = useCustomCosts();

  // Tab state
  const [activeTab, setActiveTab] = useState<'fixed' | 'variable'>('fixed');

  // Modal states
  const [showFixedForm, setShowFixedForm] = useState(false);
  const [showVarForm, setShowVarForm] = useState(false);
  const [editingFixed, setEditingFixed] = useState<CustomFixedCost | null>(null);
  const [editingVar, setEditingVar] = useState<CustomVariableCost | null>(null);

  // Form states
  const [fixedLabel, setFixedLabel] = useState('');
  const [fixedCategory, setFixedCategory] = useState<CostCategory>('outro');
  const [fixedValue, setFixedValue] = useState('');
  const [fixedCurrency, setFixedCurrency] = useState<Currency>('BRL');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const [varLabel, setVarLabel] = useState('');
  const [varColor, setVarColor] = useState(DEFAULT_COLOR_ID);
  const [varType, setVarType] = useState<'percentage' | 'brl'>('percentage');
  const [varDefaultValue, setVarDefaultValue] = useState('');
  const [varPerPax, setVarPerPax] = useState(true);

  // Messages
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Fixed Cost Handlers ──

  function openAddFixed() {
    setEditingFixed(null);
    setFixedLabel('');
    setFixedCategory('outro');
    setFixedValue('');
    setFixedCurrency('BRL');
    setShowCategoryDropdown(false);
    setShowFixedForm(true);
  }

  function openEditFixed(cost: CustomFixedCost) {
    setEditingFixed(cost);
    setFixedLabel(cost.label);
    setFixedCategory(cost.category);
    setFixedValue(String(cost.value));
    setFixedCurrency(cost.currency);
    setShowCategoryDropdown(false);
    setShowFixedForm(true);
  }

  async function handleSaveFixed() {
    const value = parseFloat(fixedValue);
    if (!fixedLabel.trim() || isNaN(value)) return;

    if (editingFixed) {
      await updateFixedCost(editingFixed.id, {
        label: fixedLabel.trim(),
        category: fixedCategory,
        value,
        currency: fixedCurrency,
      });
    } else {
      await addFixedCost(fixedLabel.trim(), fixedCategory, value, fixedCurrency);
    }

    setShowFixedForm(false);
  }

  async function handleDeleteFixed(id: string) {
    if (confirm('Excluir este custo customizado?')) {
      await deleteFixedCost(id);
    }
  }

  // ── Variable Cost Handlers ──

  function openAddVar() {
    setEditingVar(null);
    setVarLabel('');
    setVarColor(DEFAULT_COLOR_ID);
    setVarType('percentage');
    setVarDefaultValue('');
    setVarPerPax(true);
    setShowVarForm(true);
  }

  function openEditVar(cost: CustomVariableCost) {
    setEditingVar(cost);
    setVarLabel(cost.label);
    setVarColor((cost.emoji as string) || DEFAULT_COLOR_ID);
    setVarType(cost.type);
    setVarDefaultValue(String(cost.default_value));
    setVarPerPax(cost.per_pax);
    setShowVarForm(true);
  }

  async function handleSaveVar() {
    const value = parseFloat(varDefaultValue);
    if (!varLabel.trim() || isNaN(value)) return;

    if (editingVar) {
      await updateVariableCost(editingVar.id, {
        label: varLabel.trim(),
        emoji: varColor,
        type: varType,
        default_value: value,
        per_pax: varPerPax,
      });
    } else {
      await addVariableCost(varLabel.trim(), varType, value, varColor, varPerPax);
    }

    setShowVarForm(false);
  }

  async function handleDeleteVar(id: string) {
    if (confirm('Excluir este custo variável customizado?')) {
      await deleteVariableCost(id);
    }
  }

  // ── Import/Export Handlers ──

  function handleExport() {
    const json = exportCosts();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `precificatur-costs-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      const result = await importCosts(text);
      setImportMessage({ type: result.success ? 'success' : 'error', text: result.message });
      setTimeout(() => setImportMessage(null), 4000);
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  async function handleReset() {
    if (confirm('Tem certeza que deseja restaurar os padrões? Todos os seus custos customizados serão removidos.')) {
      const success = await resetToDefaults();
      if (success) {
        setImportMessage({ type: 'success', text: 'Padrões restaurados com sucesso!' });
        setTimeout(() => setImportMessage(null), 3000);
      }
    }
  }

  // ── Render ──

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-surface-400">Carregando configurações...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-brand-orange-100 flex items-center justify-center">
            <Settings size={20} className="text-brand-orange" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-brand-navy">Configurações</h1>
            <p className="text-sm text-surface-500">Personalize seus custos fixos e variáveis preferidos</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface-200 rounded-xl mb-6 w-fit">
        <button
          onClick={() => setActiveTab('fixed')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-bold transition-all',
            activeTab === 'fixed' ? 'bg-white text-brand-navy shadow-sm' : 'text-surface-500 hover:text-surface-700'
          )}
        >
          Custos Fixos ({fixedCosts.length})
        </button>
        <button
          onClick={() => setActiveTab('variable')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-bold transition-all',
            activeTab === 'variable' ? 'bg-white text-brand-navy shadow-sm' : 'text-surface-500 hover:text-surface-700'
          )}
        >
          Custos Variáveis ({variableCosts.length})
        </button>
      </div>

      {/* ── Fixed Costs Tab ── */}
      {activeTab === 'fixed' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={openAddFixed}
              className="btn-primary btn-sm flex items-center gap-2"
            >
              <Plus size={16} />
              Novo Custo Fixo
            </button>
          </div>

          {fixedCosts.length === 0 ? (
            <div className="card text-center py-12">
              <div className="w-12 h-12 rounded-full bg-surface-100 flex items-center justify-center mx-auto mb-3">
                <Package size={24} className="text-surface-400" />
              </div>
              <p className="text-surface-500 mb-1">Nenhum custo fixo customizado</p>
              <p className="text-xs text-surface-400">Adicione custos que você usa frequentemente nos roteiros</p>
            </div>
          ) : (
            <div className="space-y-2">
              {fixedCosts.map(cost => (
                <div
                  key={cost.id}
                  className="flex items-center gap-3 p-4 rounded-xl bg-white border border-surface-200 hover:border-surface-300 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-surface-100 border border-surface-200 flex items-center justify-center flex-shrink-0">
                    <CategoryIcon category={cost.category} size={16} className="text-brand-navy" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-surface-800">{cost.label}</p>
                    <p className="text-xs text-surface-400">
                      {COST_CATEGORY_LABELS[cost.category]} • {cost.usage_count}x usado
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-brand-navy">{formatBRL(cost.value)}</p>
                    <p className="text-xs text-surface-400">{cost.currency}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditFixed(cost)}
                      className="p-2 rounded-lg text-surface-400 hover:text-brand-navy hover:bg-surface-100 transition-colors"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteFixed(cost.id)}
                      className="p-2 rounded-lg text-surface-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Variable Costs Tab ── */}
      {activeTab === 'variable' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={openAddVar}
              className="btn-primary btn-sm flex items-center gap-2"
            >
              <Plus size={16} />
              Novo Custo Variável
            </button>
          </div>

          {variableCosts.length === 0 ? (
            <div className="card text-center py-12">
              <div className="w-12 h-12 rounded-full bg-surface-100 flex items-center justify-center mx-auto mb-3">
                <Package size={24} className="text-surface-400" />
              </div>
              <p className="text-surface-500 mb-1">Nenhum custo variável customizado</p>
              <p className="text-xs text-surface-400">Adicione percentuais ou valores fixos que sempre aplicam</p>
            </div>
          ) : (
            <div className="space-y-2">
              {variableCosts.map(cost => {
                const colorInfo = getColorById(cost.emoji ?? DEFAULT_COLOR_ID);
                return (
                  <div
                    key={cost.id}
                    className="flex items-center gap-3 p-4 rounded-xl bg-white border border-surface-200 hover:border-surface-300 transition-colors"
                  >
                    <div className={cn('w-5 h-5 rounded-full flex-shrink-0', colorInfo.bg)} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-surface-800">{cost.label}</p>
                      <p className="text-xs text-surface-400">
                        {cost.type === 'percentage' ? 'Percentual' : 'Valor fixo (R$)'}
                        {cost.type === 'brl' && (cost.per_pax ? ' por pessoa' : ' rateado')}
                        • {cost.usage_count}x usado
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-brand-navy">
                        {cost.type === 'percentage' ? `${cost.default_value}%` : formatBRL(cost.default_value)}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEditVar(cost)}
                        className="p-2 rounded-lg text-surface-400 hover:text-brand-navy hover:bg-surface-100 transition-colors"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteVar(cost.id)}
                        className="p-2 rounded-lg text-surface-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Fixed Cost Form Modal ── */}
      {showFixedForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md animate-slide-up">
            <h3 className="text-lg font-bold text-brand-navy mb-4">
              {editingFixed ? 'Editar Custo Fixo' : 'Novo Custo Fixo'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="input-label">Nome do custo</label>
                <input
                  className="input"
                  placeholder="Ex: Van 15 lugares"
                  value={fixedLabel}
                  onChange={e => setFixedLabel(e.target.value)}
                />
              </div>
              <div className="relative">
                <label className="input-label">Categoria</label>
                <button
                  type="button"
                  onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-surface-300 bg-white text-left hover:border-surface-400 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <CategoryIcon category={fixedCategory} size={18} className="text-brand-navy" />
                    <span className="text-sm font-semibold text-surface-800">{COST_CATEGORY_LABELS[fixedCategory]}</span>
                  </span>
                  <ChevronDown size={16} className="text-surface-400" />
                </button>
                {showCategoryDropdown && (
                  <div className="absolute z-20 w-full mt-1 rounded-xl border border-surface-200 bg-white shadow-lg overflow-hidden animate-slide-up">
                    {(Object.keys(COST_CATEGORY_LABELS) as CostCategory[]).map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => { setFixedCategory(cat); setShowCategoryDropdown(false); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-brand-navy-50 transition-colors"
                      >
                        <CategoryIcon category={cat} size={18} className="text-brand-navy" />
                        <span className="text-surface-700">{COST_CATEGORY_LABELS[cat]}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Valor padrão</label>
                  <input
                    className="input text-right"
                    type="number"
                    placeholder="0,00"
                    value={fixedValue}
                    onChange={e => setFixedValue(e.target.value)}
                  />
                </div>
                <div>
                  <label className="input-label">Moeda</label>
                  <select
                    className="input"
                    value={fixedCurrency}
                    onChange={e => setFixedCurrency(e.target.value as Currency)}
                  >
                    {CURRENCY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowFixedForm(false)}
                className="btn-outline flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveFixed}
                disabled={!fixedLabel.trim() || !fixedValue}
                className="btn-primary flex-1"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Variable Cost Form Modal ── */}
      {showVarForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md animate-slide-up">
            <h3 className="text-lg font-bold text-brand-navy mb-4">
              {editingVar ? 'Editar Custo Variável' : 'Novo Custo Variável'}
            </h3>
            <div className="space-y-4">
              {/* Nome do custo */}
              <div>
                <label className="input-label">
                  Nome do custo
                  <Tooltip text="Nomeie o custo variável. Ex: Taxa de cartão, Comissão, ISS" />
                </label>
                <input
                  className="input"
                  placeholder="Ex: Taxa de serviço"
                  value={varLabel}
                  onChange={e => setVarLabel(e.target.value)}
                />
              </div>

              {/* Cor */}
              <div>
                <label className="input-label">
                  Cor de identificação
                  <Tooltip text="Escolha uma cor para identificar visualmente este custo na calculadora" />
                </label>
                <div className="flex flex-wrap gap-2 p-3 bg-surface-50 rounded-xl">
                  {COLOR_OPTIONS.map(color => (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => setVarColor(color.id)}
                      className={cn(
                        'w-7 h-7 rounded-full transition-all duration-150',
                        color.bg,
                        varColor === color.id
                          ? cn('ring-2 ring-offset-2', color.ring, 'ring-offset-white')
                          : 'opacity-70 hover:opacity-100'
                      )}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>

              {/* Tipo */}
              <div>
                <label className="input-label">
                  Tipo de custo
                  <Tooltip text="Percentual incide sobre o preço de venda (ex: 3% de taxa de cartão). Valor fixo é um valor definido (ex: R$50 de fotografia)." />
                </label>
                <div className="flex rounded-xl bg-surface-200 p-1">
                  <button
                    type="button"
                    onClick={() => setVarType('percentage')}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-sm font-bold transition-all',
                      varType === 'percentage' ? 'bg-white text-brand-navy shadow-sm' : 'text-surface-500'
                    )}
                  >
                    Percentual (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setVarType('brl')}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-sm font-bold transition-all',
                      varType === 'brl' ? 'bg-white text-brand-navy shadow-sm' : 'text-surface-500'
                    )}
                  >
                    Valor (R$)
                  </button>
                </div>
              </div>

              {/* Valor padrão */}
              <div>
                <label className="input-label">Valor padrão</label>
                <input
                  className="input text-right"
                  type="number"
                  placeholder={varType === 'percentage' ? '10' : '50,00'}
                  value={varDefaultValue}
                  onChange={e => setVarDefaultValue(e.target.value)}
                />
              </div>

              {/* Por passageiro */}
              {varType === 'brl' && (
                <div className="flex items-center justify-between p-3 bg-surface-100 rounded-xl">
                  <span className="text-sm font-semibold text-surface-700">
                    Por passageiro?
                    <Tooltip text="Sim: o valor é multiplicado pela quantidade de pessoas. Não: o valor é dividido entre todos os passageiros." />
                  </span>
                  <div className="flex rounded-lg bg-surface-200 p-0.5 gap-0.5">
                    {[true, false].map(opt => (
                      <button
                        key={String(opt)}
                        onClick={() => setVarPerPax(opt)}
                        className={cn(
                          'px-4 py-1.5 rounded-md text-xs font-bold transition-all',
                          varPerPax === opt ? 'bg-white text-brand-navy shadow-sm' : 'text-surface-500'
                        )}
                      >
                        {opt ? 'Sim' : 'Não'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowVarForm(false)}
                className="btn-outline flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveVar}
                disabled={!varLabel.trim() || !varDefaultValue}
                className="btn-primary flex-1"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
