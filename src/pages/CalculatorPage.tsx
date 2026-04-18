import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Save, Check } from 'lucide-react';
import { SimulationResults } from '@/components/calculator/SimulationResults';
import {
  runSimulation,
  findBreakEven,
  calcTotalFixedCosts,
  calcTotalVariablePercent,
  formatBRL,
  formatPercent,
} from '@/lib/pricing-engine';
import {
  COST_CATEGORY_LABELS,
  DEFAULT_VARIABLE_COSTS,
  type CostCategory,
  type CostItem,
  type VariableCost,
} from '@/types';
import { generateId, cn } from '@/lib/utils';
import type { RouteType, Currency, Route } from '@/types';
import { PRESET_FIXED_COSTS, PRESET_VARIABLE_COSTS } from '@/data/preset-costs';

interface CalculatorPageProps {
  initialRoute?: Route;
  routes: Route[];
  saveRoute: (route: Partial<Route> & { id: string }) => Promise<string | null>;
  saving: boolean;
  onNavigate: (page: string, route?: Route) => void;
}

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<CostCategory, string> = {
  transfer: '🚐',
  hospedagem: '🏨',
  alimentacao: '🍽️',
  guia: '🧭',
  ingresso: '🎫',
  equipamento: '🎒',
  seguro: '🛡️',
  outro: '📦',
};

// Group preset fixed costs by category for the dropdown menu
const GROUPED_PRESETS = (() => {
  const map = new Map<CostCategory, (typeof PRESET_FIXED_COSTS)[number][]>();
  for (const p of PRESET_FIXED_COSTS) {
    if (!map.has(p.category)) map.set(p.category, []);
    map.get(p.category)!.push(p);
  }
  return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
})();

const STEPS = [
  { label: 'Roteiro', title: 'Sobre o roteiro', sub: 'Identifique seu roteiro com um nome. Cliente e data são opcionais.' },
  { label: 'Custos fixos', title: 'Custos fixos do roteiro', sub: 'Custos que não mudam com a quantidade de passageiros.' },
  { label: 'Variáveis', title: 'Custos variáveis', sub: 'Percentuais sobre o preço de venda. Ajuste ou adicione novos.' },
  { label: 'Preço', title: 'Defina seu preço', sub: 'Escolha como quer precificar: pelo valor de venda ou pela margem de lucro.' },
  { label: 'Resultado', title: 'Simulação completa', sub: 'Análise financeira detalhada do seu roteiro.' },
];

const GUIDE_MESSAGES = [
  'Vamos começar! O nome do roteiro é como você vai identificar esse passeio depois. Quanto mais descritivo, mais fácil de encontrar nas suas análises.',
  'Aqui entram os gastos que existem independente de quantas pessoas vão. van, hotel, guia. Seja com 2 ou 20 passageiros, você paga do mesmo jeito.',
  'Esses percentuais incidem sobre o preço de venda. Taxas de cartão, comissão de agência... Como dependem do valor cobrado, entram como %.',
  'Aqui está o coração da precificação! Defina o preço que quer cobrar, ou diga qual margem de lucro quer ter, e a calculadora encontra o valor ideal.',
  'Pronto! Observe o ponto de equilíbrio: é o mínimo de passageiros para não ter prejuízo. Qualquer passageiro acima disso já é lucro!',
];

type PricingMode = 'price' | 'profit';

// price = totalFixed / (pax × (1 - varPct/100) × (1 - marginPct/100))
function calcPriceFromMargin(totalFixed: number, totalVarPct: number, marginPct: number, pax: number): number {
  const factor = pax * (1 - totalVarPct / 100) * (1 - marginPct / 100);
  if (factor <= 0) return 0;
  return totalFixed / factor;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CalculatorPage({ initialRoute, routes, saveRoute, saving, onNavigate }: CalculatorPageProps) {
  // Wizard step
  const [step, setStep] = useState(0);

  // Step 0 — Route info
  const [routeName, setRouteName] = useState(initialRoute?.name ?? '');
  const [client, setClient] = useState(initialRoute?.client ?? '');
  const [date, setDate] = useState(initialRoute?.date ?? '');
  const [notes, setNotes] = useState(initialRoute?.notes ?? '');

  // Step 1 — Fixed costs
  const [fixedCosts, setFixedCosts] = useState<CostItem[]>(initialRoute?.fixedCosts ?? []);
  const [newCat, setNewCat] = useState<CostCategory>('transfer');
  const [newVal, setNewVal] = useState('');
  const [newLbl, setNewLbl] = useState('');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const valInputRef = useRef<HTMLInputElement>(null);
  const lblInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Step 2 — Variable costs
  const [varCosts, setVarCosts] = useState<VariableCost[]>(
    initialRoute?.variableCosts?.length ? initialRoute.variableCosts : DEFAULT_VARIABLE_COSTS
  );
  const [newVarLbl, setNewVarLbl] = useState('');
  const [newVarVal, setNewVarVal] = useState('');
  const [newVarType, setNewVarType] = useState<'percentage' | 'brl'>('percentage');
  const [newVarPerPax, setNewVarPerPax] = useState(true);
  const [pendingPreset, setPendingPreset] = useState<import('@/data/preset-costs').PresetVariableCost | null>(null);
  const [pendingPresetVal, setPendingPresetVal] = useState('');

  // Step 3 — Pricing
  const [mode, setMode] = useState<PricingMode>('price');
  const [price, setPrice] = useState(initialRoute?.estimatedPrice ?? 0);
  const [marginPct, setMarginPct] = useState(0);

  const [simulationPax, setSimulationPax] = useState(initialRoute?.simulationPax ?? 0);
  const [maxPax, setMaxPax] = useState(
    initialRoute?.isExplorationMode ? (initialRoute.maxPax ?? 0) : 0
  );
  const isExplorationMode = maxPax > simulationPax && simulationPax >= 1;

  // Persistence — use existing id if editing, new id if creating
  const [routeId] = useState<string>(() => initialRoute?.id ?? crypto.randomUUID());
  const [routeCreatedAt] = useState<string>(() => initialRoute?.createdAt ?? new Date().toISOString());
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Derived ──
  const totalFixed = useMemo(() => calcTotalFixedCosts(fixedCosts), [fixedCosts]);
  const totalVarPct = useMemo(() => calcTotalVariablePercent(varCosts), [varCosts]);

  const effectivePrice = useMemo(() => {
    if (mode === 'price') return price;
    return calcPriceFromMargin(totalFixed, totalVarPct, marginPct, simulationPax);
  }, [mode, price, marginPct, simulationPax, totalFixed, totalVarPct]);

  const simulation = useMemo(
    () => isExplorationMode
      ? runSimulation(fixedCosts, varCosts, effectivePrice, maxPax, 0, 1)
      : runSimulation(fixedCosts, varCosts, effectivePrice, simulationPax || 1, 0, simulationPax || 1),
    [fixedCosts, varCosts, effectivePrice, maxPax, simulationPax, isExplorationMode],
  );

  const breakEvenForDisplay = useMemo(
    () => findBreakEven(fixedCosts, varCosts, effectivePrice),
    [fixedCosts, varCosts, effectivePrice],
  );

  // Close suggestions dropdown when clicking outside
  useEffect(() => {
    if (!suggestionsOpen) return;
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setSuggestionsOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [suggestionsOpen]);

  // ── Persistence ──
  function buildCurrentRoute() {
    return {
      id: routeId,
      name: routeName || 'Sem nome',
      client,
      date,
      contact: '' as string,
      notes,
      region: '' as string,
      type: 'outro' as RouteType,
      fixedCosts,
      variableCosts: varCosts,
      estimatedPrice: effectivePrice,
      simulationPax,
      isExplorationMode,
      maxPax,
      currency: 'BRL' as Currency,
      days: [],
      isMultiDay: false,
      createdAt: routeCreatedAt,
      updatedAt: new Date().toISOString(),
    };
  }

  async function handleSave() {
    setSaveError(null);
    const err = await saveRoute(buildCurrentRoute());
    if (err) {
      setSaveError(err);
      return;
    }
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onNavigate('routes');
    }, 1200);
  }

  // ── Validation ──
  function canAdvance() {
    if (step === 0) return routeName.trim().length > 0 && simulationPax >= 1;
    if (step === 3) {
      if (mode === 'price') return price > 0;
      return marginPct > 0;
    }
    return true;
  }

  // ── Suggestion helpers ──
  function applyFixedSuggestion(label: string, category: CostCategory) {
    setNewLbl(label);
    setNewCat(category);
  }

  function selectPreset(p: import('@/data/preset-costs').PresetVariableCost) {
    if (varCosts.some(c => c.label === p.label)) return;
    setPendingPreset(p);
    setPendingPresetVal('');
  }

  function confirmPreset() {
    if (!pendingPreset) return;
    const numVal = parseFloat(pendingPresetVal) || 0;
    setVarCosts(prev => [...prev, {
      id: generateId(),
      label: pendingPreset.label,
      emoji: pendingPreset.emoji,
      type: pendingPreset.type,
      percentage: pendingPreset.type === 'percentage' ? numVal : 0,
      brlValue: pendingPreset.type === 'brl' ? numVal : undefined,
      perPax: pendingPreset.perPax,
    }]);
    setPendingPreset(null);
    setPendingPresetVal('');
  }

  // ── Fixed cost helpers ──
  function addFixedCost() {
    const v = parseFloat(newVal);
    if (!v || isNaN(v)) return;
    setFixedCosts(prev => [
      ...prev,
      { id: generateId(), label: newLbl, value: v, category: newCat, currency: 'BRL' },
    ]);
    setNewVal('');
    setNewLbl('');
  }

  // ── Variable cost helpers ──
  function addVarCost() {
    const v = parseFloat(newVarVal);
    if (!newVarLbl.trim() || isNaN(v)) return;
    setVarCosts(prev => [
      ...prev,
      newVarType === 'percentage'
        ? { id: generateId(), label: newVarLbl, type: 'percentage', percentage: v }
        : { id: generateId(), label: newVarLbl, type: 'brl', percentage: 0, brlValue: v, perPax: newVarPerPax },
    ]);
    setNewVarLbl('');
    setNewVarVal('');
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-0 animate-fade-in">

      {/* ── Progress bar ── */}
      <div className="flex items-start justify-center mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-start flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300',
                i < step && 'bg-emerald-500 text-white',
                i === step && 'bg-brand-orange text-white scale-110 shadow-button',
                i > step && 'bg-surface-200 text-surface-500',
              )}>
                {i < step ? <Check size={14} /> : i + 1}
              </div>
              <span className={cn(
                'hidden sm:block text-[10px] font-bold mt-1.5 text-center leading-tight',
                i === step && 'text-brand-navy',
                i < step && 'text-emerald-600',
                i > step && 'text-surface-400',
              )}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                'h-[3px] flex-1 mt-[18px] mx-1 rounded-full transition-all duration-300',
                i < step ? 'bg-emerald-400' : 'bg-surface-300',
              )} />
            )}
          </div>
        ))}
      </div>

      {/* Save indicator */}
      {saved && (
        <p className="text-center text-xs text-emerald-500 mb-3 -mt-4 flex items-center justify-center gap-1">
          <Check size={12} /> Roteiro salvo!
        </p>
      )}

      {/* ── Step card ── */}
      <div className="card mb-5 animate-slide-up">
        <h2 className="text-xl font-extrabold text-brand-navy mb-1">{STEPS[step].title}</h2>
        <p className="text-sm text-surface-500 mb-6">{STEPS[step].sub}</p>

        {/* ───── STEP 0 — Roteiro ───── */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="input-label">Nome do roteiro *</label>
              <input
                className="input"
                list="route-name-suggestions"
                placeholder="Ex: City Tour Boa Vista"
                value={routeName}
                onChange={e => setRouteName(e.target.value)}
              />
              <datalist id="route-name-suggestions">
                {routes.map(r => (
                  <option key={r.id} value={r.name} />
                ))}
              </datalist>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="input-label">
                  Cliente <span className="font-normal text-surface-400">(opcional)</span>
                </label>
                <input
                  className="input"
                  placeholder="Ex: João Silva"
                  value={client}
                  onChange={e => setClient(e.target.value)}
                />
              </div>
              <div>
                <label className="input-label">
                  Data <span className="font-normal text-surface-400">(opcional)</span>
                </label>
                <input
                  className="input"
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="input-label">Quantidade de passageiros *</label>

              <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-3">
                {/* Mínimo — obrigatório */}
                <div className="flex flex-col items-center">
                  <input
                    className="input w-full sm:w-32 text-center text-2xl font-extrabold text-brand-navy py-3"
                    type="number"
                    min={1}
                    max={100}
                    placeholder="15"
                    value={simulationPax || ''}
                    onChange={e => {
                      const v = Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0));
                      setSimulationPax(v);
                    }}
                  />
                  <span className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mt-1">
                    passageiros
                  </span>
                </div>

                {/* Conector "até" */}
                <span className="text-sm font-bold text-surface-400 self-center sm:pb-8 sm:px-1">
                  até
                </span>

                {/* Máximo — opcional, ghost quando vazio */}
                <div className="flex flex-col items-center">
                  <input
                    className={cn(
                      'w-full sm:w-32 text-center text-2xl font-extrabold text-brand-navy py-3 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue',
                      simulationPax < 1 && 'opacity-50 pointer-events-none',
                      maxPax > 0
                        ? 'border border-surface-300 bg-white placeholder:text-surface-500 placeholder:font-normal'
                        : 'border border-dashed border-surface-300 bg-surface-50 placeholder:text-surface-400 placeholder:font-normal'
                    )}
                    type="number"
                    min={simulationPax + 1}
                    max={100}
                    placeholder={simulationPax < 1 ? 'preencha o mínimo' : 'comparar até…'}
                    disabled={simulationPax < 1}
                    value={maxPax || ''}
                    onChange={e => {
                      const v = Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0));
                      setMaxPax(v);
                    }}
                  />
                  <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider mt-1">
                    (opcional)
                  </span>
                </div>
              </div>

              <p className="input-hint mt-3">
                Informe até quantos passageiros para comparar cenários lado a lado e ver como o preço e o lucro mudam conforme o grupo cresce.
              </p>

              {maxPax > 0 && maxPax <= simulationPax && (
                <p className="text-xs text-red-500 mt-1">
                  O máximo precisa ser maior que o mínimo.
                </p>
              )}
            </div>

            <div>
              <label className="input-label">
                Anotações <span className="font-normal text-surface-400">(opcional)</span>
              </label>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="Observações sobre o roteiro, restrições, pedidos especiais..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            <Tip>
              O nome do roteiro aparecerá nos relatórios e na gestão de roteiros. Seja descritivo!
            </Tip>
          </div>
        )}

        {/* ───── STEP 1 — Custos fixos ───── */}
        {step === 1 && (
          <div className="space-y-4">
            {/* ── Selection area (top) ── */}

            {/* Dropdown selector */}
            <div ref={dropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setSuggestionsOpen(o => !o)}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 text-left transition-all duration-200',
                  newLbl
                    ? 'border-brand-orange bg-brand-orange-50'
                    : 'border-surface-300 bg-white hover:border-surface-400',
                )}
              >
                <span className="flex items-center gap-2.5">
                  {newLbl ? (
                    <>
                      <span className="text-lg">{CATEGORY_EMOJI[newCat]}</span>
                      <span className="text-sm font-bold text-surface-800">{newLbl}</span>
                    </>
                  ) : (
                    <span className="text-sm text-surface-400">Selecione o tipo de custo...</span>
                  )}
                </span>
                <ChevronDown
                  size={18}
                  className={cn(
                    'text-surface-400 transition-transform duration-200',
                    suggestionsOpen && 'rotate-180',
                  )}
                />
              </button>

              {/* Expanded suggestions panel */}
              {suggestionsOpen && (
                <div className="absolute z-30 left-0 right-0 mt-1 rounded-xl border border-surface-200 bg-white shadow-lg overflow-hidden animate-slide-up">
                  <div className="max-h-64 overflow-y-auto">
                    {GROUPED_PRESETS.map(group => (
                      <div key={group.category}>
                        <div className="sticky top-0 px-3 py-1.5 bg-surface-50 border-b border-surface-100">
                          <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">
                            {CATEGORY_EMOJI[group.category]} {COST_CATEGORY_LABELS[group.category]}
                          </span>
                        </div>
                        {group.items.map(p => {
                          const alreadyAdded = fixedCosts.some(c => c.label === p.label);
                          return (
                            <button
                              key={p.label}
                              type="button"
                              disabled={alreadyAdded}
                              onClick={() => {
                                applyFixedSuggestion(p.label, p.category);
                                setSuggestionsOpen(false);
                                setTimeout(() => valInputRef.current?.focus(), 50);
                              }}
                              className={cn(
                                'w-full text-left px-4 py-2.5 text-sm transition-colors',
                                alreadyAdded
                                  ? 'text-surface-300 cursor-default bg-surface-50'
                                  : 'text-surface-700 hover:bg-brand-orange-50 font-medium cursor-pointer',
                              )}
                            >
                              <span className="flex items-center justify-between">
                                <span>{p.label}</span>
                                {alreadyAdded && <Check size={14} className="text-emerald-400" />}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                    {/* Outro */}
                    <button
                      type="button"
                      onClick={() => {
                        setNewCat('outro');
                        setNewLbl('');
                        setSuggestionsOpen(false);
                        setTimeout(() => lblInputRef.current?.focus(), 50);
                      }}
                      className="w-full text-left px-4 py-3 text-sm font-bold text-surface-500 hover:bg-surface-100 border-t border-surface-200 transition-colors"
                    >
                      📦 + Outro (digitar nome)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Input row */}
            <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
              {/* Description — visible when no preset selected (custom / "Outro") */}
              {!PRESET_FIXED_COSTS.some(p => p.label === newLbl) && (
                <div className="flex-[2]">
                  <label className="input-label">Descrição</label>
                  <input
                    ref={lblInputRef}
                    className="input"
                    placeholder="Ex: Passeio de barco"
                    value={newLbl}
                    onChange={e => setNewLbl(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') valInputRef.current?.focus();
                    }}
                  />
                </div>
              )}
              <div className="flex gap-2 items-end flex-1">
                <div className="flex-1">
                  <label className="input-label">Valor (R$)</label>
                  <input
                    ref={valInputRef}
                    className="input text-right"
                    type="number"
                    placeholder="0,00"
                    value={newVal}
                    onChange={e => setNewVal(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addFixedCost()}
                  />
                </div>
                <AddBtn onClick={addFixedCost} />
              </div>
            </div>

            {/* ── Results area (bottom) ── */}
            <Divider label={`Custos adicionados${fixedCosts.length > 0 ? ` (${fixedCosts.length})` : ''}`} />

            {fixedCosts.length === 0 ? (
              <div className="text-center py-5 text-surface-400">
                <p className="text-sm">Nenhum custo fixo adicionado ainda.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {fixedCosts.map(c => (
                  <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-100">
                    <span className="text-lg">{CATEGORY_EMOJI[c.category]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-surface-800 truncate">
                        {c.label || COST_CATEGORY_LABELS[c.category]}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-brand-navy whitespace-nowrap">
                      {formatBRL(c.value)}
                    </span>
                    <RemoveBtn onClick={() => setFixedCosts(p => p.filter(x => x.id !== c.id))} />
                  </div>
                ))}
              </div>
            )}

            <TotalRow label="Total custos fixos:" value={formatBRL(totalFixed)} />

            <Tip>
              Custos fixos não dependem do número de pessoas, eles existem desde a primeira vaga.
              Ex: Van, Guia, Hotel, Passeio de barco, Ingresso.
            </Tip>
          </div>
        )}

        {/* ───── STEP 2 — Variáveis ───── */}
        {step === 2 && (
          <div className="space-y-3">
            {varCosts.length === 0 ? (
              <div className="text-center py-8 text-surface-400">
                <div className="text-4xl mb-2">📊</div>
                <p className="text-sm">
                  Nenhum custo variável adicionado.<br />
                  Selecione uma sugestão ou adicione abaixo.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {varCosts.map(v => (
                  <div key={v.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-100">
                    {v.emoji && <span className="text-lg">{v.emoji}</span>}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-surface-800 truncate">{v.label}</p>
                    </div>
                    {v.type === 'brl' ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={v.brlValue ?? ''}
                          onChange={e =>
                            setVarCosts(p =>
                              p.map(c => c.id === v.id ? { ...c, brlValue: parseFloat(e.target.value) || 0 } : c)
                            )
                          }
                          className="input w-24 text-right font-extrabold text-brand-navy py-1.5"
                          placeholder="0"
                        />
                        <span className="text-xs text-surface-500 whitespace-nowrap">{v.perPax ? '/ pax' : 'rateado'}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={v.percentage || ''}
                          onChange={e =>
                            setVarCosts(p =>
                              p.map(c => c.id === v.id ? { ...c, percentage: parseFloat(e.target.value) || 0 } : c)
                            )
                          }
                          className="input w-20 text-right font-extrabold text-brand-navy py-1.5"
                          placeholder="0"
                        />
                        <span className="text-sm font-bold text-surface-500">%</span>
                      </div>
                    )}
                    <RemoveBtn onClick={() => setVarCosts(p => p.filter(c => c.id !== v.id))} />
                  </div>
                ))}
              </div>
            )}

            <TotalRow
              label="Total % sobre o preço:"
              value={formatPercent(totalVarPct)}
              tooltip="Esse percentual sai do seu preço antes do lucro. Se o total for 30%, você fica com apenas 70% de cada venda para cobrir custos fixos e lucro."
            />

            <Divider label="Sugestões" />

            {/* Chips sempre visíveis */}
            <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-surface-50 border border-surface-200">
              {PRESET_VARIABLE_COSTS.map(p => {
                const alreadyAdded = varCosts.some(c => c.label === p.label);
                const isPending = pendingPreset?.label === p.label;
                return (
                  <button
                    key={p.label}
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() => isPending ? setPendingPreset(null) : selectPreset(p)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors duration-150',
                      alreadyAdded
                        ? 'bg-emerald-50 text-emerald-400 cursor-default line-through'
                        : isPending
                          ? 'bg-brand-orange text-white border border-brand-orange'
                          : 'bg-white border border-surface-300 text-surface-600 hover:bg-brand-orange-50 hover:border-brand-orange-200 hover:text-brand-orange-700'
                    )}
                  >
                    {p.emoji} {p.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setNewVarLbl('')}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold border bg-surface-200 border-surface-300 text-surface-500 hover:bg-surface-300 hover:text-surface-700 transition-colors duration-150"
              >
                + Outro
              </button>
            </div>

            {/* Painel de confirmação do preset selecionado */}
            {pendingPreset && (() => {
              const numVal = parseFloat(pendingPresetVal) || 0;
              const monetaryPreview = pendingPreset.type === 'percentage' && effectivePrice > 0
                ? formatBRL(effectivePrice * numVal / 100)
                : null;
              return (
                <div className="rounded-xl bg-brand-orange-50 border-2 border-brand-orange-200 p-4 space-y-3 animate-slide-up">
                  {/* Header */}
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{pendingPreset.emoji}</span>
                    <span className="text-sm font-extrabold text-surface-800">{pendingPreset.label}</span>
                  </div>

                  {/* Input */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-surface-500 uppercase tracking-wide">
                      {pendingPreset.type === 'percentage'
                        ? 'Percentual sobre o preço de venda (%)'
                        : pendingPreset.perPax
                          ? 'Valor por passageiro (R$)'
                          : 'Valor total rateado entre passageiros (R$)'}
                    </label>
                    <div className="flex items-center gap-2">
                      {pendingPreset.type === 'brl' && (
                        <span className="text-sm font-extrabold text-surface-500">R$</span>
                      )}
                      <input
                        autoFocus
                        type="number"
                        min={0}
                        step={0.5}
                        placeholder="0"
                        value={pendingPresetVal}
                        onChange={e => setPendingPresetVal(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') confirmPreset();
                          if (e.key === 'Escape') { setPendingPreset(null); setPendingPresetVal(''); }
                        }}
                        className="input w-28 text-right font-extrabold text-brand-navy py-1.5"
                      />
                      {pendingPreset.type === 'percentage' && (
                        <span className="text-sm font-extrabold text-surface-500">%</span>
                      )}
                    </div>
                    {/* Monetary preview for % type */}
                    {pendingPreset.type === 'percentage' && numVal > 0 && (
                      <p className="text-xs text-surface-500">
                        {effectivePrice > 0
                          ? `≈ ${monetaryPreview} por passageiro (sobre o preço de ${formatBRL(effectivePrice)})`
                          : 'Defina o preço na próxima etapa para ver o valor em R$.'}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={confirmPreset}
                      className="flex-1 py-2 rounded-xl bg-brand-orange text-white text-sm font-bold hover:bg-brand-orange-500 transition-colors"
                    >
                      Adicionar ao orçamento
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPendingPreset(null); setPendingPresetVal(''); }}
                      className="px-4 py-2 rounded-xl bg-surface-200 text-surface-600 text-sm font-bold hover:bg-surface-300 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              );
            })()}

            <Divider label="Adicionar custo variável" />

            {/* Toggle % / R$ */}
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Tipo de custo</span>
              <Tooltip text="Percentual: incide sobre o preço de venda. Ex: taxa de cartão de 3% = R$3 por cada R$100 cobrado. Valor fixo (R$): custo direto com valor definido, como um fotógrafo." />
            </div>
            <div className="flex rounded-xl bg-surface-200 p-1">
              {(['percentage', 'brl'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setNewVarType(t)}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-bold transition-all',
                    newVarType === t ? 'bg-white text-brand-navy shadow-sm' : 'text-surface-500'
                  )}
                >
                  {t === 'percentage' ? 'Percentual (%)' : 'Valor (R$)'}
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
              <input
                className="input flex-[2]"
                placeholder={newVarType === 'percentage' ? 'Ex: Comissão plataforma' : 'Ex: Fotógrafo'}
                value={newVarLbl}
                onChange={e => setNewVarLbl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addVarCost()}
              />
              <div className="flex gap-2 items-end">
                <input
                  className="input flex-1 text-right"
                  type="number"
                  placeholder={newVarType === 'percentage' ? '%' : 'R$'}
                  value={newVarVal}
                  onChange={e => setNewVarVal(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addVarCost()}
                />
                <AddBtn onClick={addVarCost} />
              </div>
            </div>

            {/* Por pax toggle — só aparece no modo R$ */}
            {newVarType === 'brl' && (
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-surface-100 border border-surface-200">
                <span className="flex items-center gap-1 text-sm font-semibold text-surface-700">
                  Por passageiro?
                  <Tooltip text="Por passageiro: cada pessoa paga esse valor individualmente. Não (rateado): o custo total é dividido entre todos os passageiros." />
                </span>
                <div className="flex rounded-lg bg-surface-200 p-0.5 gap-0.5">
                  {[true, false].map(opt => (
                    <button
                      key={String(opt)}
                      onClick={() => setNewVarPerPax(opt)}
                      className={cn(
                        'px-4 py-1.5 rounded-md text-xs font-bold transition-all',
                        newVarPerPax === opt ? 'bg-white text-brand-navy shadow-sm' : 'text-surface-500'
                      )}
                    >
                      {opt ? 'Sim' : 'Não'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Tip variant="info">
              Use <strong>%</strong> para taxas sobre o preço (cartão, comissão). Use <strong>R$</strong> para serviços com valor fixo, como fotógrafo ou refeição.
            </Tip>
          </div>
        )}

        {/* ───── STEP 3 — Preço ───── */}
        {step === 3 && (
          <div className="space-y-5">
            {/* Mode toggle */}
            <div className="flex rounded-xl bg-surface-200 p-1">
              {(['price', 'profit'] as PricingMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    'flex-1 py-2.5 rounded-lg text-sm font-bold transition-all duration-200',
                    mode === m
                      ? 'bg-white text-brand-navy shadow-sm'
                      : 'text-surface-500 hover:text-surface-700',
                  )}
                >
                  {m === 'price' ? 'Definir preço de venda' : 'Definir margem de lucro'}
                </button>
              ))}
            </div>

            {mode === 'price' ? (
              <div className="text-center">
                <label className="input-label block text-center">Preço por passageiro (R$)</label>
                <input
                  className="input text-3xl font-extrabold text-brand-navy text-center py-4"
                  type="number"
                  placeholder="0"
                  value={price || ''}
                  onChange={e => setPrice(parseFloat(e.target.value) || 0)}
                />
                <p className="input-hint text-center">Quanto o cliente vai pagar por pessoa</p>
              </div>
            ) : (
              <div className="text-center">
                <label className="input-label block text-center">Margem desejada (%)</label>
                <input
                  className="input text-2xl sm:text-3xl font-extrabold text-brand-navy text-center py-4"
                  type="number"
                  placeholder="0"
                  value={marginPct || ''}
                  onChange={e => setMarginPct(parseFloat(e.target.value) || 0)}
                />
              </div>
            )}

            {/* Price preview for profit mode */}
            {mode === 'profit' && marginPct > 0 && effectivePrice > 0 && (
              <div className="text-center p-4 rounded-xl bg-brand-navy-50 border border-brand-navy-100">
                <p className="text-xs font-bold text-brand-navy uppercase tracking-wide mb-1">
                  Preço calculado por passageiro
                </p>
                <p className="text-3xl font-extrabold text-brand-navy">{formatBRL(effectivePrice)}</p>
                <p className="text-xs text-surface-500 mt-1">
                  Para ter {formatPercent(marginPct)} de margem com {simulationPax} passageiros
                </p>
              </div>
            )}

          </div>
        )}

        {/* ───── STEP 4 — Resultado ───── */}
        {step === 4 && (
          <div>
            <div className="text-xs text-surface-600 bg-surface-100 rounded-lg px-3 py-2 mb-5">
              {mode === 'profit'
                ? `Preço calculado: ${formatBRL(effectivePrice)} (margem ${formatPercent(marginPct)} com ${simulationPax} pax)`
                : `Preço definido: ${formatBRL(effectivePrice)} por passageiro`}
            </div>
            <SimulationResults
              simulation={simulation}
              estimatedPrice={effectivePrice}
              isExplorationMode={isExplorationMode}
              breakEvenPax={breakEvenForDisplay}
              simulationPax={simulationPax}
            />
          </div>
        )}

        {/* ───── Wizard Guide ───── */}
        <WizardGuide key={step} step={step} />
      </div>

      {/* ── Navigation ── */}
      <div className="flex justify-between items-center">
        {step > 0 ? (
          <button
            onClick={() => setStep(s => s - 1)}
            className="btn btn-outline flex items-center gap-2 text-sm"
          >
            <ChevronLeft size={16} /> Voltar
          </button>
        ) : (
          <div />
        )}

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={!canAdvance()}
            className="btn btn-primary flex items-center gap-2 text-sm"
          >
            Próximo <ChevronRight size={16} />
          </button>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-secondary flex items-center gap-2 text-sm disabled:opacity-60"
            >
              {saving ? 'Salvando...' : saved ? <><Check size={16} /> Salvo!</> : <><Save size={16} /> Salvar roteiro</>}
            </button>
            {saveError && <p className="text-xs text-red-500">{saveError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Small reusable sub-components ──────────────────────────────────────────────

function Tip({ children, variant = 'gold' }: { children: React.ReactNode; variant?: 'gold' | 'info' }) {
  const styles = {
    gold: 'bg-brand-gold-50 border-brand-gold-200 text-brand-gold-800',
    info: 'bg-brand-blue-50 border-brand-blue-100 text-brand-blue-700',
  };
  return (
    <div className={cn('flex items-start gap-3 p-3 rounded-xl border text-xs', styles[variant])}>
      <span className="text-base mt-px">💡</span>
      <p>{children}</p>
    </div>
  );
}

function TotalRow({ label, value, tooltip }: { label: string; value: string; tooltip?: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-surface-50 border border-surface-200">
      <span className="flex items-center gap-1 text-xs text-surface-500">
        {label}
        {tooltip && <Tooltip text={tooltip} />}
      </span>
      <span className="text-sm font-extrabold text-brand-navy">{value}</span>
    </div>
  );
}

function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-4 h-4 rounded-full bg-surface-200 text-surface-500 text-[10px] font-extrabold flex items-center justify-center hover:bg-surface-300 transition-colors"
        aria-label="Ajuda"
      >
        ?
      </button>
      {open && (
        <div className="absolute left-5 top-0 z-50 w-64 rounded-xl bg-white border border-surface-200 shadow-lg p-3 text-xs text-surface-600 leading-relaxed">
          {text}
        </div>
      )}
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 my-1">
      <div className="flex-1 h-px bg-surface-200" />
      <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-surface-200" />
    </div>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-7 h-7 rounded-lg flex items-center justify-center text-lg text-surface-400
                 hover:bg-red-50 hover:text-red-500 transition-colors flex-shrink-0"
    >
      ×
    </button>
  );
}

function AddBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-11 h-11 self-end rounded-xl bg-brand-orange text-white text-xl font-bold
                 hover:bg-brand-orange-500 transition-colors flex-shrink-0 flex items-center justify-center"
    >
      +
    </button>
  );
}

function WizardGuide({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-3 mt-6 pt-5 border-t border-surface-200">
      {/* Avatar */}
      <img
        src="/AVATAR-TESTE.png"
        alt="Guia"
        className="w-16 h-16 rounded-full object-cover flex-shrink-0 shadow-md animate-fade-in scale-x-[-1]"
      />

      {/* Speech bubble */}
      <div
        className="relative flex-1 animate-slide-in-right"
        style={{ animationDelay: '200ms', animationFillMode: 'both' }}
      >
        {/* Left arrow */}
        <div className="absolute -left-2 top-4 w-3.5 h-3.5 bg-brand-navy-50 border-l border-b border-brand-navy-100 rotate-45 z-10" />
        {/* Bubble body */}
        <div className="bg-brand-navy-50 border border-brand-navy-100 rounded-2xl px-4 py-3">
          <p className="text-xs font-bold text-brand-navy mb-0.5">Guia PrecificaTur</p>
          <p className="text-xs text-brand-navy-700 leading-relaxed">
            {GUIDE_MESSAGES[step]}
          </p>
        </div>
      </div>
    </div>
  );
}
