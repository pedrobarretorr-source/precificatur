import { useState, useMemo, useRef, useEffect } from 'react';
import {
  ChevronLeft, ChevronRight, ChevronDown, Save, Check, Plus,
  Info, Sparkles, Bookmark, Inbox,
  Truck, BedDouble, Utensils, Compass, Ticket, Backpack, Shield, Package,
  type LucideIcon,
} from 'lucide-react';
import { SimulationResults } from '@/components/calculator/SimulationResults';
import { CalculatorGuide } from '@/components/calculator/CalculatorGuide';
import {
  runSimulation,
  findBreakEven,
  calcTotalFixedCosts,
  calcTotalVariablePercent,
  resolvePercentageVariables,
  formatBRL,
  formatPercent,
} from '@/lib/pricing-engine';
import {
  COST_CATEGORY_LABELS,
  DEFAULT_CHARGE_COSTS,
  type CostCategory,
  type CostItem,
  type VariableCost,
} from '@/types';
import { generateId, cn } from '@/lib/utils';
import type { RouteType, Currency, Route } from '@/types';
import { PRESET_FIXED_COSTS, PRESET_VARIABLE_COSTS, PRESET_CHARGE_COSTS } from '@/data/preset-costs';
import { useCustomCosts } from '@/hooks/useCustomCosts';

interface CalculatorPageProps {
  initialRoute?: Route;
  routes: Route[];
  saveRoute: (route: Partial<Route> & { id: string }) => Promise<string | null>;
  saving: boolean;
  onNavigate: (page: string, route?: Route) => void;
}

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

function CategoryIcon({ category, size = 14, className }: { category: CostCategory; size?: number; className?: string }) {
  const Icon = CATEGORY_ICON[category];
  return <Icon size={size} className={cn('text-surface-500', className)} />;
}

const VAR_COLOR_OPTIONS = [
  { id: 'orange',  bg: 'bg-orange-500' },
  { id: 'red',     bg: 'bg-red-500' },
  { id: 'amber',   bg: 'bg-amber-500' },
  { id: 'yellow',  bg: 'bg-yellow-500' },
  { id: 'lime',    bg: 'bg-lime-500' },
  { id: 'green',   bg: 'bg-green-500' },
  { id: 'teal',    bg: 'bg-teal-500' },
  { id: 'cyan',    bg: 'bg-cyan-500' },
  { id: 'blue',    bg: 'bg-blue-500' },
  { id: 'indigo',  bg: 'bg-indigo-500' },
  { id: 'violet',  bg: 'bg-violet-500' },
  { id: 'purple',  bg: 'bg-purple-500' },
  { id: 'pink',    bg: 'bg-pink-500' },
  { id: 'rose',    bg: 'bg-rose-500' },
  { id: 'fuchsia',  bg: 'bg-fuchsia-500' },
];

function getColorById(id: string) {
  return VAR_COLOR_OPTIONS.find(c => c.id === id) ?? VAR_COLOR_OPTIONS[0];
}

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
  { label: 'Variáveis', title: 'Custos extras / Inclusões', sub: 'Serviços adicionais por pessoa: ingressos, refeições, equipamentos, etc.' },
  { label: 'Taxas', title: 'Taxas e encargos', sub: 'Percentuais que incidem sobre o preço final: cartão, impostos, comissões.' },
  { label: 'Preço', title: 'Defina seu preço', sub: 'Escolha como quer precificar: pelo valor de venda ou pela margem de lucro.' },
  { label: 'Resultado', title: 'Simulação completa', sub: 'Análise financeira detalhada do seu roteiro.' },
];

const GUIDE_MESSAGES = [
  'Vamos começar! O nome do roteiro é como você vai identificar esse passeio depois. Quanto mais descritivo, mais fácil de encontrar nas suas análises.',
  'Aqui entram os gastos que existem independente de quantas pessoas vão. van, hotel, guia. Seja com 2 ou 20 passageiros, você paga do mesmo jeito.',
  'Aqui você adiciona serviços e inclusões por pessoa: ingressos, refeições, equipamentos, fotografia. São custos que variam com o número de passageiros.',
  'Defina os encargos percentuais que vão sobre o preço: máquina de cartão, comissões para parceiros, impostos e taxas administrativas.',
  'Aqui está o coração da precificação! Defina o preço que quer cobrar, ou diga qual margem de lucro quer ter, e a calculadora encontra o valor ideal.',
  'Pronto! Observe o ponto de equilíbrio: é o mínimo de passageiros para não ter prejuízo. Qualquer passageiro acima disso já é lucro!',
];

function Tip({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'info' }) {
  return (
    <div className="text-xs text-surface-600 bg-surface-100 rounded-lg px-3 py-2.5 border border-surface-200 flex items-start gap-2">
      <Info size={14} className={cn('flex-shrink-0 mt-0.5', variant === 'info' ? 'text-brand-blue' : 'text-surface-500')} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="flex-1 h-px bg-surface-200" />
      <span className="text-xs font-bold text-surface-400 uppercase tracking-wider">{label}</span>
      <div className="flex-1 h-px bg-surface-200" />
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-surface-100 rounded-xl border border-surface-200">
      <span className="text-sm font-semibold text-surface-600">{label}</span>
      <span className="text-sm font-extrabold text-brand-navy">{value}</span>
    </div>
  );
}

function AddBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="h-[42px] px-4 rounded-xl bg-brand-orange text-white font-bold text-sm hover:bg-brand-orange-500 transition-colors">
      <Plus size={18} />
    </button>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="p-1.5 rounded-lg text-surface-400 hover:text-red-500 hover:bg-red-50 transition-colors">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
      </svg>
    </button>
  );
}

export function CalculatorPage({ initialRoute, routes, saveRoute, saving, onNavigate }: CalculatorPageProps) {
  const [step, setStep] = useState(0);
  const [routeName, setRouteName] = useState(initialRoute?.name ?? '');
  const [client, setClient] = useState(initialRoute?.client ?? '');
  const [date, setDate] = useState(initialRoute?.date ?? '');
  const [notes, setNotes] = useState(initialRoute?.notes ?? '');
  // Preserve fields not editable in the wizard — carry them through unchanged on save
  const [contact] = useState(initialRoute?.contact ?? '');
  const [region] = useState(initialRoute?.region ?? '');
  const [routeType] = useState<RouteType>(initialRoute?.type ?? 'outro');
  const [fixedCosts, setFixedCosts] = useState<CostItem[]>(initialRoute?.fixedCosts ?? []);
  const [newCat, setNewCat] = useState<CostCategory>('outro');
  const [newVal, setNewVal] = useState('');
  const [newLbl, setNewLbl] = useState('');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const valInputRef = useRef<HTMLInputElement>(null);
  const lblInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [varCosts, setVarCosts] = useState<VariableCost[]>(
    initialRoute?.variableCosts?.length ? initialRoute.variableCosts : []
  );

  const [chargeCosts, setChargeCosts] = useState<VariableCost[]>(
    initialRoute?.chargeCosts?.length ? initialRoute.chargeCosts : DEFAULT_CHARGE_COSTS
  );

  // Estado para o formulário de adicionar novo custo variável
  const [newVarLbl, setNewVarLbl] = useState('');
  const [newVarVal, setNewVarVal] = useState('');
  const [newVarType, setNewVarType] = useState<'percentage' | 'brl'>('brl');
  const [newVarPerPax, setNewVarPerPax] = useState(true);
  const [newVarColor, setNewVarColor] = useState('orange');
  const [showVarForm, setShowVarForm] = useState(false);

  // Estado para o formulário de adicionar novo encargo percentual
  const [newChargeLbl, setNewChargeLbl] = useState('');
  const [newChargeVal, setNewChargeVal] = useState('');
  const [newChargeColor, setNewChargeColor] = useState('orange');
  const [showChargeForm, setShowChargeForm] = useState(false);

  // Preset de encargo selecionado para adição rápida
  const [chargePresetOpen, setChargePresetOpen] = useState(false);
  const chargePresetRef = useRef<HTMLDivElement>(null);

  // Preset selecionado para edição rápida
  const [presetSelected, setPresetSelected] = useState<{ label: string; emoji: string } | null>(null);
  const [presetFormType, setPresetFormType] = useState<'percentage' | 'brl'>('brl');
  const [presetFormValue, setPresetFormValue] = useState('');
  const [presetFormPerPax, setPresetFormPerPax] = useState(true);

  // Dropdowns do Step 2
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [savedVarOpen, setSavedVarOpen] = useState(false);
  const presetsRef = useRef<HTMLDivElement>(null);
  const savedVarRef = useRef<HTMLDivElement>(null);

  // Dropdowns do Step 1 (Custos Fixos)
  const [presetsFixedOpen, setPresetsFixedOpen] = useState(false);
  const [savedFixedOpen, setSavedFixedOpen] = useState(false);
  const presetsFixedRef = useRef<HTMLDivElement>(null);
  const savedFixedRef = useRef<HTMLDivElement>(null);

  const { fixedCosts: customFixedCosts, variableCosts: customVarCosts } = useCustomCosts();

  const [price, setPrice] = useState(initialRoute?.estimatedPrice ?? 0);
  const [simulationPax, setSimulationPax] = useState(initialRoute?.simulationPax ?? 0);
  const [maxPax, setMaxPax] = useState(initialRoute?.isExplorationMode ? (initialRoute.maxPax ?? 0) : 0);
  const isExplorationMode = maxPax > simulationPax && simulationPax >= 1;

  const [routeId] = useState<string>(() => initialRoute?.id ?? crypto.randomUUID());
  const [routeCreatedAt] = useState<string>(() => initialRoute?.createdAt ?? new Date().toISOString());
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const savedCostSuggestions = useMemo(() => {
    const countMap = new Map<string, { cost: import('@/types').CostItem; count: number }>();
    for (const r of routes) {
      for (const c of r.fixedCosts ?? []) {
        if (!c.label) continue;
        const existing = countMap.get(c.label);
        if (existing) { existing.count++; existing.cost = c; }
        else countMap.set(c.label, { cost: c, count: 1 });
      }
    }
    return Array.from(countMap.values()).sort((a, b) => b.count - a.count).slice(0, 8).map(x => x.cost);
  }, [routes]);

  // Custos variáveis já usados anteriormente (do histórico)
  const savedVarSuggestions = useMemo(() => {
    const countMap = new Map<string, { label: string; count: number; type: 'percentage' | 'brl'; defaultValue: number; perPax?: boolean; emoji: string }>();
    for (const r of routes) {
      for (const v of r.variableCosts ?? []) {
        const existing = countMap.get(v.label);
        if (existing) { existing.count++; }
        else countMap.set(v.label, { label: v.label, count: 1, type: v.type, defaultValue: v.type === 'percentage' ? (v.percentage ?? 0) : (v.brlValue ?? 0), perPax: v.perPax, emoji: v.emoji ?? 'orange' });
      }
    }
    return Array.from(countMap.values()).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [routes]);

  const totalFixed = useMemo(() => calcTotalFixedCosts(fixedCosts), [fixedCosts]);
  const allVarCosts = useMemo(() => [...varCosts, ...chargeCosts], [varCosts, chargeCosts]);
  const totalVarPct = useMemo(() => calcTotalVariablePercent(allVarCosts), [allVarCosts]);
  const totalChargePct = useMemo(() => calcTotalVariablePercent(chargeCosts), [chargeCosts]);

  // Percentage costs apply to total tour revenue (price × pax), not per-pax.
  // Convert them to rateado-BRL so the engine treats them as a fixed total.
  const effectiveVarCosts = useMemo(
    () => resolvePercentageVariables(allVarCosts, price, simulationPax || 1),
    [allVarCosts, price, simulationPax],
  );

  const simulation = useMemo(
    () => isExplorationMode
      ? runSimulation(fixedCosts, effectiveVarCosts, price, maxPax, 0, 1)
      : runSimulation(fixedCosts, effectiveVarCosts, price, simulationPax || 1, 0, simulationPax || 1),
    [fixedCosts, effectiveVarCosts, price, maxPax, simulationPax, isExplorationMode],
  );

  const breakEvenForDisplay = useMemo(
    () => findBreakEven(fixedCosts, effectiveVarCosts, price),
    [fixedCosts, effectiveVarCosts, price],
  );

  useEffect(() => {
    if (!suggestionsOpen) return;
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setSuggestionsOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [suggestionsOpen]);

  // Fechar dropdowns quando clicar fora (Step 2)
  useEffect(() => {
    if (!presetsOpen && !savedVarOpen) return;
    function handler(e: MouseEvent) {
      if (presetsRef.current && !presetsRef.current.contains(e.target as Node)) setPresetsOpen(false);
      if (savedVarRef.current && !savedVarRef.current.contains(e.target as Node)) setSavedVarOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [presetsOpen, savedVarOpen]);

  // Fechar dropdown de encargos quando clicar fora (Step 3)
  useEffect(() => {
    if (!chargePresetOpen) return;
    function handler(e: MouseEvent) {
      if (chargePresetRef.current && !chargePresetRef.current.contains(e.target as Node)) setChargePresetOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [chargePresetOpen]);

  function buildCurrentRoute() {
    return {
      id: routeId, name: routeName || 'Sem nome', client, date,
      contact, notes, region, type: routeType,
      fixedCosts, variableCosts: varCosts, chargeCosts, estimatedPrice: price,
      simulationPax, isExplorationMode, maxPax,
      currency: 'BRL' as Currency, days: [], isMultiDay: false,
      createdAt: routeCreatedAt, updatedAt: new Date().toISOString(),
    };
  }

  async function handleSave() {
    setSaveError(null);
    const err = await saveRoute(buildCurrentRoute());
    if (err) { setSaveError(err); return; }
    setSaved(true);
    setTimeout(() => { setSaved(false); onNavigate('routes'); }, 1200);
  }

  function canAdvance() {
    if (step === 0) return routeName.trim().length > 0 && simulationPax >= 1;
    if (step === 4) return price > 0;
    return true;
  }

  function applyFixedSuggestion(label: string, category: CostCategory) {
    setNewLbl(label);
    setNewCat(category);
  }

  function addFixedCost() {
    const v = parseFloat(newVal);
    if (!v || isNaN(v)) return;
    setFixedCosts(prev => [...prev, { id: generateId(), label: newLbl, value: v, category: newCat, currency: 'BRL' }]);
    setNewVal('');
    setNewLbl('');
  }

  // Selecionar preset - abre form para escolher tipo e valor
  function selectPreset(preset: { label: string; emoji: string }) {
    setPresetSelected(preset);
    setPresetFormType('brl');
    setPresetFormValue('');
    setPresetFormPerPax(true);
    setPresetsOpen(false);
    setSavedVarOpen(false);
  }

  function confirmPresetCost() {
    if (!presetSelected || !presetFormValue) return;
    const v = parseFloat(presetFormValue);
    if (isNaN(v)) return;

    setVarCosts(prev => [...prev, {
      id: generateId(), label: presetSelected.label, type: 'brl',
      percentage: 0, brlValue: v, perPax: true, emoji: presetSelected.emoji,
    }]);
    setPresetSelected(null);
    setPresetFormValue('');
  }

  function addSavedVarCost(item: { label: string; type: 'percentage' | 'brl'; defaultValue: number; perPax?: boolean; emoji: string }) {
    if (varCosts.some(c => c.label === item.label)) return;
    setVarCosts(prev => [...prev, {
      id: generateId(),
      label: item.label,
      type: item.type,
      percentage: item.type === 'percentage' ? item.defaultValue : 0,
      brlValue: item.type === 'brl' ? item.defaultValue : undefined,
      perPax: true,
      emoji: item.emoji,
    }]);
  }

  function addCustomCost(cost: { label: string; type: 'percentage' | 'brl'; default_value: number; per_pax: boolean; emoji?: string | null }) {
    if (varCosts.some(c => c.label === cost.label)) return;
    setVarCosts(prev => [...prev, {
      id: generateId(),
      label: cost.label,
      type: cost.type,
      percentage: cost.type === 'percentage' ? cost.default_value : 0,
      brlValue: cost.type === 'brl' ? cost.default_value : undefined,
      perPax: true,
      emoji: (cost.emoji ?? 'orange') as string,
    }]);
  }

  function addNewVarCost() {
    const v = parseFloat(newVarVal);
    if (!newVarLbl.trim() || isNaN(v)) return;
    setVarCosts(prev => [...prev, {
      id: generateId(), label: newVarLbl, type: 'brl',
      percentage: 0, brlValue: v, perPax: true, emoji: newVarColor,
    }]);
    setNewVarLbl('');
    setNewVarVal('');
    setShowVarForm(false);
  }

  function openAddVarForm() {
    setNewVarLbl('');
    setNewVarVal('');
    setNewVarType('brl');
    setNewVarPerPax(true);
    setNewVarColor('orange');
    setShowVarForm(true);
    setPresetSelected(null);
  }

  function addChargePreset(preset: { label: string; emoji: string }) {
    if (chargeCosts.some(c => c.label === preset.label)) return;
    setChargeCosts(prev => [...prev, {
      id: generateId(), label: preset.label, type: 'percentage',
      percentage: 0, emoji: preset.emoji,
    }]);
    setChargePresetOpen(false);
  }

  function addNewChargeCost() {
    const v = parseFloat(newChargeVal);
    if (!newChargeLbl.trim() || isNaN(v)) return;
    setChargeCosts(prev => [...prev, {
      id: generateId(), label: newChargeLbl, type: 'percentage',
      percentage: v, emoji: newChargeColor,
    }]);
    setNewChargeLbl('');
    setNewChargeVal('');
    setShowChargeForm(false);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-0 animate-fade-in">
      <div className="flex items-start justify-center mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-start flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors duration-200 border',
                i < step && 'bg-brand-navy border-brand-navy text-white',
                i === step && 'bg-brand-orange border-brand-orange text-white',
                i > step && 'bg-white border-surface-300 text-surface-400',
              )}>
                {i < step ? <Check size={12} strokeWidth={3} /> : i + 1}
              </div>
              <span className={cn(
                'hidden sm:block text-[10px] font-semibold mt-2 text-center leading-tight tracking-wide uppercase',
                i === step && 'text-brand-navy',
                i < step && 'text-surface-600',
                i > step && 'text-surface-400',
              )}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                'h-px flex-1 mt-[14px] mx-1 transition-colors duration-200',
                i < step ? 'bg-brand-navy' : 'bg-surface-300',
              )} />
            )}
          </div>
        ))}
      </div>

      {saved && <p className="text-center text-xs text-emerald-500 mb-3 -mt-4 flex items-center justify-center gap-1"><Check size={12} /> Roteiro salvo!</p>}

      <div className="card mb-5 animate-slide-up">
        <h2 className="text-xl font-extrabold text-brand-navy mb-1">{STEPS[step].title}</h2>
        <p className="text-sm text-surface-500 mb-6">{STEPS[step].sub}</p>

        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="input-label">Nome do roteiro *</label>
              <input className="input" list="route-name-suggestions" placeholder="Ex: Roteiro grupo do João" value={routeName} onChange={e => setRouteName(e.target.value)} />
              <datalist id="route-name-suggestions">{routes.map(r => <option key={r.id} value={r.name} />)}</datalist>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="input-label">Cliente <span className="font-normal text-surface-400">(opcional)</span></label><input className="input" placeholder="Ex: João Silva" value={client} onChange={e => setClient(e.target.value)} /></div>
<div><label className="input-label">Data do serviço <span className="font-normal text-surface-400">(opcional)</span></label><input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            </div>
            <div>
              <label className="input-label">Quantidade de passageiros *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                {/* Card: Mínimo */}
                <div className="flex flex-col p-4 rounded-xl bg-white border border-surface-300 focus-within:border-brand-orange focus-within:ring-2 focus-within:ring-brand-orange/20 transition-all">
                  <span className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1">Mínimo</span>
                  <input
                    className="w-full text-3xl font-extrabold text-brand-navy bg-transparent focus:outline-none tabular-nums"
                    type="number"
                    min={1}
                    max={100}
                    placeholder="0"
                    value={simulationPax || ''}
                    onChange={e => setSimulationPax(Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                  />
                  <span className="text-xs text-surface-500 mt-1">número de pagantes</span>
                </div>

                {/* Card: Máximo */}
                <div className={cn(
                  'flex flex-col p-4 rounded-xl bg-white border transition-all',
                  simulationPax >= 1
                    ? 'border-surface-300 focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/20'
                    : 'border-dashed border-surface-300 opacity-60',
                )}>
                  <span className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1">Até (opcional)</span>
                  <input
                    className="w-full text-3xl font-extrabold text-brand-navy bg-transparent focus:outline-none tabular-nums disabled:cursor-not-allowed"
                    type="number"
                    min={simulationPax + 1}
                    max={100}
                    placeholder="0"
                    disabled={simulationPax < 1}
                    value={maxPax || ''}
                    onChange={e => setMaxPax(Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                  />
                  <span className="text-xs text-surface-500 mt-1">comparar cenários</span>
                </div>
              </div>
              {simulationPax >= 1 && maxPax > simulationPax && (
                <p className="text-xs text-brand-blue mt-2">
                  Simulando de {simulationPax} até {maxPax} passageiros
                </p>
              )}
            </div>
            <div><label className="input-label">Anotações <span className="font-normal text-surface-400">(opcional)</span></label><textarea className="input resize-none" rows={3} placeholder="Observações sobre o roteiro..." value={notes} onChange={e => setNotes(e.target.value)} /></div>
            <CalculatorGuide step={step} />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            {/* ── dois dropdowns lado a lado ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Dropdown: Sugestões Rápidas */}
              <div ref={presetsFixedRef} className="relative">
                <button
                  type="button"
                  onClick={() => { setPresetsFixedOpen(o => !o); setSavedFixedOpen(false); }}
                  className={cn('w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-left transition-colors duration-150', presetsFixedOpen ? 'border-brand-navy bg-white' : 'border-surface-300 bg-white hover:border-surface-400')}
                >
                  <span className="flex items-center gap-2">
                    <Sparkles size={14} className="text-brand-orange" />
                    <span className="text-sm font-semibold text-surface-800">Sugestões rápidas</span>
                  </span>
                  <ChevronDown size={16} className={cn('text-surface-400 transition-transform duration-200', presetsFixedOpen && 'rotate-180')} />
                </button>
                
                {presetsFixedOpen && (
                  <div className="absolute z-30 left-0 right-0 mt-1 rounded-xl border border-surface-200 bg-white shadow-lg overflow-hidden animate-slide-up">
                    <div className="max-h-64 overflow-y-auto">
                      <div className="sticky top-0 px-3 py-1.5 bg-surface-50 border-b border-surface-100">
                        <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Custos sugeridos</span>
                      </div>
                      {GROUPED_PRESETS.map(group => (
                        <div key={group.category}>
                          <div className="sticky top-0 px-3 py-1.5 bg-surface-50 border-b border-surface-100 flex items-center gap-1.5">
                            <CategoryIcon category={group.category} size={12} />
                            <span className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">{COST_CATEGORY_LABELS[group.category]}</span>
                          </div>
                          {group.items.map(p => {
                            const alreadyAdded = fixedCosts.some(c => c.label === p.label);
                            return (
                              <button
                                key={p.label}
                                type="button"
                                disabled={alreadyAdded}
                                onClick={() => { applyFixedSuggestion(p.label, p.category); setPresetsFixedOpen(false); setTimeout(() => valInputRef.current?.focus(), 50); }}
                                className={cn('w-full text-left px-4 py-2.5 text-sm transition-colors', alreadyAdded ? 'text-surface-300 cursor-default bg-surface-50' : 'text-surface-700 hover:bg-brand-orange-50 font-medium cursor-pointer')}
                              >
                                <span className="flex items-center justify-between">
                                  <span>{p.label}</span>
                                  {alreadyAdded ? <Check size={14} className="text-emerald-400" /> : null}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Dropdown: Custos salvos */}
              <div ref={savedFixedRef} className="relative">
                <button
                  type="button"
                  onClick={() => { setSavedFixedOpen(o => !o); setPresetsFixedOpen(false); }}
                  className={cn('w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-left transition-colors duration-150', savedFixedOpen ? 'border-brand-navy bg-white' : 'border-surface-300 bg-white hover:border-surface-400')}
                >
                  <span className="flex items-center gap-2">
                    <Bookmark size={14} className="text-brand-navy" />
                    <span className="text-sm font-semibold text-surface-800">Custos salvos</span>
                  </span>
                  <ChevronDown size={16} className={cn('text-surface-400 transition-transform duration-200', savedFixedOpen && 'rotate-180')} />
                </button>
                
                {savedFixedOpen && (
                  <div className="absolute z-30 left-0 right-0 mt-1 rounded-xl border border-surface-200 bg-white shadow-lg overflow-hidden animate-slide-up">
                    <div className="max-h-64 overflow-y-auto">
                      {/* Últimos utilizados */}
                      {savedCostSuggestions.length > 0 && (
                        <div>
                          <div className="sticky top-0 px-3 py-1.5 bg-surface-50 border-b border-surface-200">
                            <span className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">Recentes</span>
                          </div>
                          {savedCostSuggestions.map(c => {
                            const alreadyAdded = fixedCosts.some(x => x.label === c.label);
                            return (
                              <button
                                key={`saved-${c.label}`}
                                type="button"
                                disabled={alreadyAdded}
                                onClick={() => { applyFixedSuggestion(c.label, c.category); setNewVal(String(c.value)); setSavedFixedOpen(false); setTimeout(() => valInputRef.current?.focus(), 50); }}
                                className={cn('w-full text-left px-4 py-2.5 text-sm transition-colors', alreadyAdded ? 'text-surface-300 cursor-default bg-surface-50' : 'text-surface-700 hover:bg-brand-navy-50 font-medium cursor-pointer')}
                              >
                                <span className="flex items-center justify-between gap-2">
                                  <span className="flex items-center gap-2 min-w-0">
                                    <CategoryIcon category={c.category} size={14} />
                                    <span className="truncate">{c.label}</span>
                                  </span>
                                  {alreadyAdded ? <Check size={14} className="text-emerald-400 flex-shrink-0" /> : <span className="text-xs font-bold text-brand-navy whitespace-nowrap flex-shrink-0">{formatBRL(c.value)}</span>}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {/* Minhas configurações */}
                      {customFixedCosts.length > 0 && (
                        <div className={savedCostSuggestions.length > 0 ? 'border-t border-surface-100' : ''}>
                          <div className="sticky top-0 px-3 py-1.5 bg-surface-50 border-b border-surface-200">
                            <span className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">Minhas configurações</span>
                          </div>
                          {customFixedCosts.map(cost => {
                            const alreadyAdded = fixedCosts.some(x => x.label === cost.label);
                            return (
                              <button
                                key={`custom-fixed-${cost.id}`}
                                type="button"
                                disabled={alreadyAdded}
                                onClick={() => { applyFixedSuggestion(cost.label, cost.category); setNewVal(String(cost.value)); setSavedFixedOpen(false); setTimeout(() => valInputRef.current?.focus(), 50); }}
                                className={cn('w-full text-left px-4 py-2.5 text-sm transition-colors', alreadyAdded ? 'text-surface-300 cursor-default bg-surface-50' : 'text-surface-700 hover:bg-brand-navy-50 font-medium cursor-pointer')}
                              >
                                <span className="flex items-center justify-between gap-2">
                                  <span className="flex items-center gap-2 min-w-0">
                                    <CategoryIcon category={cost.category} size={14} />
                                    <span className="truncate">{cost.label}</span>
                                  </span>
                                  {alreadyAdded ? <Check size={14} className="text-emerald-400 flex-shrink-0" /> : <span className="text-xs font-bold text-brand-navy whitespace-nowrap flex-shrink-0">{formatBRL(cost.value)}</span>}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {savedCostSuggestions.length === 0 && customFixedCosts.length === 0 && (
                        <div className="px-4 py-6 text-center text-surface-400 text-sm">
                          <p>Nenhum custo salvo ainda.</p>
                          <p className="text-xs mt-1">Adicione custos nas Configurações.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Campo personalizado + valor + botão ── */}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="input-label">Custo fixo personalizado:</label>
                <input 
                  ref={lblInputRef}
                  className="input" 
                  placeholder="Ex: Aluguel de tenda" 
                  value={newLbl} 
                  onChange={e => setNewLbl(e.target.value)} 
                  onKeyDown={e => { if (e.key === 'Enter' && newLbl.trim()) valInputRef.current?.focus(); }}
                />
              </div>
              <div className="w-32">
                <label className="input-label">Valor (R$)</label>
                <input 
                  ref={valInputRef}
                  className="input text-right" 
                  type="number" 
                  placeholder="0,00" 
                  value={newVal} 
                  onChange={e => setNewVal(e.target.value)} 
                  onKeyDown={e => { if (e.key === 'Enter' && newVal) { addFixedCost(); setNewLbl(''); setTimeout(() => lblInputRef.current?.focus(), 50); } }}
                />
              </div>
              <AddBtn onClick={() => { addFixedCost(); setNewLbl(''); lblInputRef.current?.focus(); }} />
            </div>
            <Divider label={`Custos adicionados${fixedCosts.length > 0 ? ` (${fixedCosts.length})` : ''}`} />
            {fixedCosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-surface-400 gap-2">
                <Inbox size={24} className="opacity-60" />
                <p className="text-sm">Nenhum custo fixo adicionado.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {fixedCosts.map(c => (
                  <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-100 border border-surface-200">
                    <div className="w-8 h-8 rounded-lg bg-white border border-surface-200 flex items-center justify-center flex-shrink-0">
                      <CategoryIcon category={c.category} size={14} className="text-brand-navy" />
                    </div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-surface-800 truncate">{c.label || COST_CATEGORY_LABELS[c.category]}</p></div>
                    <span className="text-sm font-bold text-brand-navy whitespace-nowrap tabular-nums">{formatBRL(c.value)}</span>
                    <RemoveBtn onClick={() => setFixedCosts(p => p.filter(x => x.id !== c.id))} />
                  </div>
                ))}
              </div>
            )}
            <TotalRow label="Total custos fixos:" value={formatBRL(totalFixed)} />
            <CalculatorGuide step={step} />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {/* ── Formulário para preset selecionado ── */}
            {presetSelected && (
              <div className="rounded-xl bg-surface-50 border border-surface-300 p-4 space-y-3 animate-slide-up">
                <div className="flex items-center gap-2">
                  <div className={cn('w-3 h-3 rounded-full', getColorById(presetSelected.emoji).bg)} />
                  <span className="text-sm font-semibold text-brand-navy">{presetSelected.label}</span>
                  <button type="button" onClick={() => setPresetSelected(null)} aria-label="Cancelar" className="ml-auto text-surface-400 hover:text-surface-700 text-sm">✕</button>
                </div>
                <div>
                  <label className="input-label">Valor por pessoa (R$)</label>
                  <input className="input text-right" type="number" placeholder="0,00" value={presetFormValue} onChange={e => setPresetFormValue(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={confirmPresetCost} className="flex-1 py-2 rounded-xl bg-brand-orange text-white text-sm font-bold hover:bg-brand-orange-500 transition-colors">Adicionar</button>
                  <button type="button" onClick={() => setPresetSelected(null)} className="px-4 py-2 rounded-xl bg-surface-200 text-surface-600 text-sm font-bold hover:bg-surface-300 transition-colors">Cancelar</button>
                </div>
              </div>
            )}

            {/* ── PARTE SUPERIOR: Adicionar custos (dois dropdowns) ── */}
            {!presetSelected && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Dropdown: Custos sugeridos/recomendados */}
                  <div ref={presetsRef} className="relative">
                    <button
                      type="button"
                      onClick={() => { setPresetsOpen(o => !o); setSavedVarOpen(false); }}
                      className={cn('w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-left transition-colors duration-150', presetsOpen ? 'border-brand-navy bg-white' : 'border-surface-300 bg-white hover:border-surface-400')}
                    >
                      <span className="flex items-center gap-2">
                        <Sparkles size={14} className="text-brand-orange" />
                        <span className="text-sm font-semibold text-surface-800">Sugestões rápidas</span>
                      </span>
                      <ChevronDown size={16} className={cn('text-surface-400 transition-transform duration-200', presetsOpen && 'rotate-180')} />
                    </button>
                    
                    {presetsOpen && (
                      <div className="absolute z-30 left-0 right-0 mt-1 rounded-xl border border-surface-200 bg-white shadow-lg overflow-hidden animate-slide-up">
                        <div className="max-h-64 overflow-y-auto">
                          <div className="sticky top-0 px-3 py-1.5 bg-surface-50 border-b border-surface-100">
                            <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Escolha um custo</span>
                          </div>
                          {PRESET_VARIABLE_COSTS.map(preset => {
                            const colorInfo = getColorById(preset.emoji);
                            const alreadyAdded = varCosts.some(c => c.label === preset.label);
                            return (
                              <button
                                key={preset.label}
                                type="button"
                                disabled={alreadyAdded}
                                onClick={() => selectPreset(preset)}
                                className={cn('w-full text-left px-4 py-2.5 text-sm transition-colors', alreadyAdded ? 'text-surface-300 cursor-default bg-surface-50' : 'text-surface-700 hover:bg-brand-orange-50 font-medium cursor-pointer')}
                              >
                                <span className="flex items-center justify-between">
                                  <span className="flex items-center gap-2">
                                    <div className={cn('w-3 h-3 rounded-full', colorInfo.bg)} />
                                    <span>{preset.label}</span>
                                  </span>
                                  {alreadyAdded ? <Check size={14} className="text-emerald-400" /> : null}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Dropdown: Meus custos salvos (SettingsPage + histórico) */}
                  <div ref={savedVarRef} className="relative">
                    <button
                      type="button"
                      onClick={() => { setSavedVarOpen(o => !o); setPresetsOpen(false); }}
                      className={cn('w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-left transition-colors duration-150', savedVarOpen ? 'border-brand-navy bg-white' : 'border-surface-300 bg-white hover:border-surface-400')}
                    >
                      <span className="flex items-center gap-2">
                        <Bookmark size={14} className="text-brand-navy" />
                        <span className="text-sm font-semibold text-surface-800">Custos salvos</span>
                      </span>
                      <ChevronDown size={16} className={cn('text-surface-400 transition-transform duration-200', savedVarOpen && 'rotate-180')} />
                    </button>
                    
                    {savedVarOpen && (
                      <div className="absolute z-30 left-0 right-0 mt-1 rounded-xl border border-surface-200 bg-white shadow-lg overflow-hidden animate-slide-up">
                        <div className="max-h-64 overflow-y-auto">
                          
                          {/* Custos do SettingsPage (Minhas configurações) — apenas BRL */}
                          {customVarCosts.filter(c => c.type === 'brl').length > 0 && (
                            <div>
                              <div className="sticky top-0 px-3 py-1.5 bg-brand-navy-50 border-b border-brand-navy-100">
                                <span className="text-[10px] font-bold text-brand-navy uppercase tracking-wider">Minhas configurações</span>
                              </div>
                              {customVarCosts.filter(c => c.type === 'brl').map(cost => {
                                const colorInfo = getColorById(cost.emoji ?? 'orange');
                                const alreadyAdded = varCosts.some(c => c.label === cost.label);
                                return (
                                  <button
                                    key={`custom-${cost.id}`}
                                    type="button"
                                    disabled={alreadyAdded}
                                    onClick={() => { addCustomCost(cost); setSavedVarOpen(false); }}
                                    className={cn('w-full text-left px-4 py-2.5 text-sm transition-colors', alreadyAdded ? 'text-surface-300 cursor-default bg-surface-50' : 'text-surface-700 hover:bg-brand-navy-50 font-medium cursor-pointer')}
                                  >
                                    <span className="flex items-center justify-between">
                                      <span className="flex items-center gap-2">
                                        <div className={cn('w-3 h-3 rounded-full', colorInfo.bg)} />
                                        <span>{cost.label}</span>
                                      </span>
                                      {alreadyAdded ? <Check size={14} className="text-emerald-400" /> : null}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Custos usados anteriormente (histórico) — apenas BRL */}
                          {savedVarSuggestions.filter(i => i.type === 'brl').length > 0 && (
                            <div className={customVarCosts.filter(c => c.type === 'brl').length > 0 ? 'border-t border-surface-100' : ''}>
                              <div className="sticky top-0 px-3 py-1.5 bg-surface-50 border-b border-surface-100">
                                <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Usados anteriormente</span>
                              </div>
                              {savedVarSuggestions.filter(i => i.type === 'brl').map((item, idx) => {
                                const colorInfo = getColorById(item.emoji);
                                const alreadyAdded = varCosts.some(c => c.label === item.label);
                                return (
                                  <button
                                    key={`saved-var-${idx}`}
                                    type="button"
                                    disabled={alreadyAdded}
                                    onClick={() => { addSavedVarCost(item); setSavedVarOpen(false); }}
                                    className={cn('w-full text-left px-4 py-2.5 text-sm transition-colors', alreadyAdded ? 'text-surface-300 cursor-default bg-surface-50' : 'text-surface-700 hover:bg-brand-blue-50 font-medium cursor-pointer')}
                                  >
                                    <span className="flex items-center justify-between">
                                      <span className="flex items-center gap-2">
                                        <div className={cn('w-3 h-3 rounded-full', colorInfo.bg)} />
                                        <span>{item.label}</span>
                                      </span>
                                      {alreadyAdded ? <Check size={14} className="text-emerald-400" /> : <span className="text-xs text-surface-400">{item.count}x</span>}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {customVarCosts.filter(c => c.type === 'brl').length === 0 && savedVarSuggestions.filter(i => i.type === 'brl').length === 0 && (
                            <div className="px-4 py-6 text-center text-surface-400 text-sm">
                              <p>Nenhum custo salvo ainda.</p>
                              <p className="text-xs mt-1">Adicione custos nas Configurações ou use-os aqui para salvar.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Adicionar manualmente */}
                <button
                  type="button"
                  onClick={openAddVarForm}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-surface-300 bg-white text-surface-700 font-semibold text-sm hover:border-brand-navy hover:text-brand-navy transition-colors"
                >
                  <Plus size={14} /> Adicionar custo personalizado
                </button>

                {showVarForm && (
                  <div className="rounded-xl bg-surface-50 border border-surface-300 p-4 space-y-3 animate-slide-up">
                    <div className="flex items-center gap-2"><div className={cn('w-3 h-3 rounded-full', getColorById(newVarColor).bg)} /><span className="text-sm font-semibold text-brand-navy">Novo custo por pessoa</span></div>
                    <div><label className="input-label">Nome</label><input className="input" placeholder="Ex: Ingresso parque" value={newVarLbl} onChange={e => setNewVarLbl(e.target.value)} /></div>
                    <div className="flex items-center gap-2"><label className="input-label">Cor</label><div className="flex gap-1.5 p-2 bg-white rounded-lg">{VAR_COLOR_OPTIONS.slice(0, 8).map(color => <button key={color.id} type="button" onClick={() => setNewVarColor(color.id)} className={cn('w-5 h-5 rounded-full transition-all', color.bg, newVarColor === color.id && 'ring-2 ring-offset-1 ring-brand-navy')} />)}</div></div>
                    <div>
                      <label className="input-label">Valor por pessoa (R$)</label>
                      <input className="input text-right" type="number" placeholder="0,00" value={newVarVal} onChange={e => setNewVarVal(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={addNewVarCost} className="flex-1 py-2 rounded-xl bg-brand-orange text-white text-sm font-bold hover:bg-brand-orange-500 transition-colors">Adicionar</button>
                      <button type="button" onClick={() => setShowVarForm(false)} className="px-4 py-2 rounded-xl bg-surface-200 text-surface-600 text-sm font-bold hover:bg-surface-300 transition-colors">Cancelar</button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── PARTE INFERIOR: Custos adicionados ── */}
            <div className="border-t border-surface-200 pt-4 mt-4">
              <Divider label={`Custos adicionados${varCosts.length > 0 ? ` (${varCosts.length})` : ''}`} />
              {varCosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-surface-400 gap-2">
                  <Inbox size={24} className="opacity-60" />
                  <p className="text-sm">Nenhum custo extra adicionado.</p>
                  <p className="text-xs">Use os botões acima para adicionar.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {varCosts.map(v => {
                    const colorInfo = getColorById(v.emoji ?? 'orange');
                    return (
                      <div key={v.id} className="flex items-center gap-3 px-3 py-3 rounded-xl bg-surface-100 border border-surface-200">
                        <div className={cn('w-5 h-5 rounded-full flex-shrink-0', colorInfo.bg)} />
                        <p className="text-sm font-semibold text-surface-800 flex-1 min-w-0 truncate">{v.label}</p>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-surface-500">R$</span>
                          <input type="number" min={0} step={0.5} value={v.brlValue ?? ''} onChange={e => setVarCosts(p => p.map(c => c.id === v.id ? { ...c, brlValue: parseFloat(e.target.value) || 0 } : c))} className="input w-20 text-right font-extrabold text-brand-navy py-1.5" placeholder="0" />
                          <span className="text-xs text-surface-500">/pax</span>
                        </div>
                        <RemoveBtn onClick={() => setVarCosts(p => p.filter(c => c.id !== v.id))} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <CalculatorGuide step={step} />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {/* ── PARTE SUPERIOR: Adicionar encargos ── */}
            {/* Dropdown: Sugestões rápidas */}
            <div ref={chargePresetRef} className="relative">
              <button
                type="button"
                onClick={() => setChargePresetOpen(o => !o)}
                className={cn('w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-left transition-colors duration-150', chargePresetOpen ? 'border-brand-navy bg-white' : 'border-surface-300 bg-white hover:border-surface-400')}
              >
                <span className="flex items-center gap-2">
                  <Sparkles size={14} className="text-brand-orange" />
                  <span className="text-sm font-semibold text-surface-800">Sugestões rápidas</span>
                </span>
                <ChevronDown size={16} className={cn('text-surface-400 transition-transform duration-200', chargePresetOpen && 'rotate-180')} />
              </button>

              {chargePresetOpen && (
                <div className="absolute z-30 left-0 right-0 mt-1 rounded-xl border border-surface-200 bg-white shadow-lg overflow-hidden animate-slide-up">
                  <div className="max-h-64 overflow-y-auto">
                    <div className="sticky top-0 px-3 py-1.5 bg-surface-50 border-b border-surface-100">
                      <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Encargos sugeridos</span>
                    </div>
                    {PRESET_CHARGE_COSTS.map(preset => {
                      const colorInfo = getColorById(preset.emoji);
                      const alreadyAdded = chargeCosts.some(c => c.label === preset.label);
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          disabled={alreadyAdded}
                          onClick={() => addChargePreset(preset)}
                          className={cn('w-full text-left px-4 py-2.5 text-sm transition-colors', alreadyAdded ? 'text-surface-300 cursor-default bg-surface-50' : 'text-surface-700 hover:bg-brand-orange-50 font-medium cursor-pointer')}
                        >
                          <span className="flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              <div className={cn('w-3 h-3 rounded-full', colorInfo.bg)} />
                              <span>{preset.label}</span>
                            </span>
                            {alreadyAdded ? <Check size={14} className="text-emerald-400" /> : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Botão + formulário personalizado */}
            <button
              type="button"
              onClick={() => { setShowChargeForm(o => !o); setNewChargeLbl(''); setNewChargeVal(''); setNewChargeColor('orange'); }}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-surface-300 bg-white text-surface-700 font-semibold text-sm hover:border-brand-navy hover:text-brand-navy transition-colors"
            >
              <Plus size={14} /> Adicionar encargo personalizado
            </button>

            {showChargeForm && (
              <div className="rounded-xl bg-surface-50 border border-surface-300 p-4 space-y-3 animate-slide-up">
                <div className="flex items-center gap-2">
                  <div className={cn('w-3 h-3 rounded-full', getColorById(newChargeColor).bg)} />
                  <span className="text-sm font-semibold text-brand-navy">Novo encargo</span>
                </div>
                <div><label className="input-label">Nome</label><input className="input" placeholder="Ex: Taxa de cartão online" value={newChargeLbl} onChange={e => setNewChargeLbl(e.target.value)} /></div>
                <div className="flex items-center gap-2"><label className="input-label">Cor</label><div className="flex gap-1.5 p-2 bg-white rounded-lg">{VAR_COLOR_OPTIONS.slice(0, 8).map(color => <button key={color.id} type="button" onClick={() => setNewChargeColor(color.id)} className={cn('w-5 h-5 rounded-full transition-all', color.bg, newChargeColor === color.id && 'ring-2 ring-offset-1 ring-brand-navy')} />)}</div></div>
                <div><label className="input-label">Percentual (%)</label><input className="input text-right" type="number" min="0" max="100" step="0.5" placeholder="0" value={newChargeVal} onChange={e => setNewChargeVal(e.target.value)} /></div>
                <div className="flex gap-2">
                  <button type="button" onClick={addNewChargeCost} className="flex-1 py-2 rounded-xl bg-brand-orange text-white text-sm font-bold hover:bg-brand-orange-500 transition-colors">Adicionar</button>
                  <button type="button" onClick={() => setShowChargeForm(false)} className="px-4 py-2 rounded-xl bg-surface-200 text-surface-600 text-sm font-bold hover:bg-surface-300 transition-colors">Cancelar</button>
                </div>
              </div>
            )}

            {/* ── PARTE INFERIOR: Encargos adicionados ── */}
            <div className="border-t border-surface-200 pt-4 mt-2">
              <Divider label={`Encargos${chargeCosts.length > 0 ? ` (${chargeCosts.length})` : ''}`} />

              {chargeCosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-surface-400 gap-2">
                  <Inbox size={24} className="opacity-60" />
                  <p className="text-sm">Nenhum encargo adicionado.</p>
                  <p className="text-xs">Use os botões acima para adicionar.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2 mb-4">
                    {chargeCosts.map(charge => {
                      const colorInfo = getColorById(charge.emoji ?? 'orange');
                      return (
                        <div key={charge.id} className="flex items-center gap-3 px-3 py-3 rounded-xl bg-surface-100 border border-surface-200">
                          <div className={cn('w-4 h-4 rounded-full flex-shrink-0', colorInfo.bg)} />
                          <span className="text-sm font-medium text-surface-700 flex-1 min-w-0 truncate">{charge.label}</span>
                          <div className="flex items-center gap-2 w-44">
                            <input
                              type="range"
                              min="0"
                              max="30"
                              step="0.5"
                              value={charge.percentage}
                              onChange={e => setChargeCosts(p => p.map(c => c.id === charge.id ? { ...c, percentage: parseFloat(e.target.value) } : c))}
                              className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer bg-surface-300 accent-brand-orange"
                            />
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              value={charge.percentage}
                              onChange={e => setChargeCosts(p => p.map(c => c.id === charge.id ? { ...c, percentage: parseFloat(e.target.value) || 0 } : c))}
                              className="w-14 text-right text-sm font-bold text-brand-navy bg-white border border-surface-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                            />
                            <span className="text-xs text-surface-400">%</span>
                          </div>
                          <RemoveBtn onClick={() => setChargeCosts(p => p.filter(c => c.id !== charge.id))} />
                        </div>
                      );
                    })}
                  </div>

                  {/* Barra visual */}
                  <div className="h-2 rounded-full bg-surface-200 overflow-hidden">
                    <div
                      className="h-full rounded-full gradient-accent transition-all duration-500"
                      style={{ width: `${Math.min(totalChargePct, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-surface-400">0%</span>
                    <span className="text-xs text-surface-400">
                      {totalChargePct > 50 && '⚠️ '}
                      {totalChargePct.toFixed(1)}% do preço vai para taxas e encargos
                    </span>
                  </div>
                </>
              )}
            </div>

            <CalculatorGuide step={step} />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
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
            {allVarCosts.length > 0 && (
              <div className="p-4 rounded-xl bg-surface-50 border border-surface-200 space-y-3">
                {varCosts.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-surface-500 uppercase tracking-wide mb-2">Inclusões por pessoa</p>
                    <div className="flex flex-wrap gap-2">
                      {varCosts.map(v => {
                        const colorInfo = getColorById(v.emoji ?? 'orange');
                        return (
                          <div key={v.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-surface-200">
                            <div className={cn('w-3 h-3 rounded-full', colorInfo.bg)} />
                            <span className="text-xs font-medium text-surface-600">{v.label}</span>
                            <span className="text-xs text-surface-400">
                              {v.type === 'percentage' ? `${v.percentage || 0}%` : `R$ ${v.brlValue ?? 0}${v.perPax ? '/pax' : ' rateado'}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {chargeCosts.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-surface-500 uppercase tracking-wide mb-2">Taxas e encargos</p>
                    <div className="flex flex-wrap gap-2">
                      {chargeCosts.map(v => {
                        const colorInfo = getColorById(v.emoji ?? 'orange');
                        return (
                          <div key={v.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-surface-200">
                            <div className={cn('w-3 h-3 rounded-full', colorInfo.bg)} />
                            <span className="text-xs font-medium text-surface-600">{v.label}</span>
                            <span className="text-xs text-surface-400">{v.percentage || 0}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {totalChargePct > 0 && (
                  <p className="text-xs text-surface-500">Total de {formatPercent(totalChargePct)} em taxas sobre o preço.</p>
                )}
              </div>
            )}
            <CalculatorGuide step={step} />
          </div>
        )}

        {step === 5 && (
          <div>
            <SimulationResults
              simulation={simulation}
              estimatedPrice={price}
              isExplorationMode={isExplorationMode}
              breakEvenPax={breakEvenForDisplay}
              simulationPax={simulationPax}
              totalFixed={totalFixed}
              variables={allVarCosts}
              onPriceChange={setPrice}
            />
            <div className="mt-6">
              <CalculatorGuide step={step} />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center">
        <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} className={cn('flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all', step === 0 ? 'text-surface-300 cursor-not-allowed' : 'text-surface-600 hover:bg-surface-200')}><ChevronLeft size={16} /> Voltar</button>
        {step < STEPS.length - 1 ? (
          <button onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))} disabled={!canAdvance()} className={cn('flex items-center gap-1 px-5 py-2.5 rounded-xl text-sm font-bold transition-all', canAdvance() ? 'bg-brand-orange text-white hover:bg-brand-orange-500' : 'bg-surface-200 text-surface-400 cursor-not-allowed')}>Continuar <ChevronRight size={16} /></button>
        ) : (
          <button onClick={handleSave} disabled={saving} className={cn('flex items-center gap-1 px-5 py-2.5 rounded-xl text-sm font-bold transition-all', saving ? 'bg-surface-300 text-surface-500 cursor-wait' : 'bg-brand-orange text-white hover:bg-brand-orange-500')}><Save size={16} />{saving ? 'Salvando...' : 'Salvar roteiro'}</button>
        )}
      </div>
      {saveError && <p className="text-center text-xs text-red-500 mt-2">{saveError}</p>}
    </div>
  );
}