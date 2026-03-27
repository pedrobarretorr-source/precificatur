import { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Save, Check } from 'lucide-react';
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
import { useRoutes } from '@/hooks/useRoutes';
import type { RouteType, Currency } from '@/types';
import { PRESET_FIXED_COSTS, PRESET_VARIABLE_COSTS } from '@/data/preset-costs';

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

const STEPS = [
  { label: 'Roteiro',      title: 'Sobre o roteiro',        sub: 'Identifique seu roteiro com um nome. Cliente e data são opcionais.' },
  { label: 'Custos fixos', title: 'Custos fixos do roteiro', sub: 'Custos que não mudam com a quantidade de passageiros.' },
  { label: 'Variáveis',    title: 'Custos variáveis',        sub: 'Percentuais sobre o preço de venda. Ajuste ou adicione novos.' },
  { label: 'Preço',        title: 'Defina seu preço',        sub: 'Escolha como quer precificar: pelo valor de venda ou pela margem de lucro.' },
  { label: 'Resultado',    title: 'Simulação completa',      sub: 'Análise financeira detalhada do seu roteiro.' },
];

const GUIDE_MESSAGES = [
  'Vamos começar! O nome do roteiro é como você vai identificar esse passeio depois. Quanto mais descritivo, mais fácil de encontrar nas suas análises.',
  'Aqui entram os gastos que existem independente de quantas pessoas vão — van, hotel, guia. Seja com 2 ou 20 passageiros, você paga do mesmo jeito.',
  'Esses percentuais incidem sobre o preço de venda. Taxas de cartão, comissão de agência... Como dependem do valor cobrado, entram como %.',
  'Aqui está o coração da precificação! Defina o preço que quer cobrar, ou diga qual margem de lucro quer ter — e a calculadora encontra o valor ideal.',
  'Pronto! Observe o ponto de equilíbrio: é o mínimo de passageiros para não ter prejuízo. Qualquer passageiro acima disso já é lucro puro!',
];

type PricingMode = 'price' | 'profit';

// price = totalFixed / (pax × (1 - varPct/100) × (1 - marginPct/100))
function calcPriceFromMargin(totalFixed: number, totalVarPct: number, marginPct: number, pax: number): number {
  const factor = pax * (1 - totalVarPct / 100) * (1 - marginPct / 100);
  if (factor <= 0) return 0;
  return totalFixed / factor;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CalculatorPage() {
  // Wizard step
  const [step, setStep] = useState(0);

  // Step 0 — Route info
  const [routeName, setRouteName] = useState('');
  const [client, setClient] = useState('');
  const [date, setDate] = useState('');

  // Step 1 — Fixed costs
  const [fixedCosts, setFixedCosts] = useState<CostItem[]>([]);
  const [newCat, setNewCat] = useState<CostCategory>('transfer');
  const [newVal, setNewVal] = useState('');
  const [newLbl, setNewLbl] = useState('');

  // Step 2 — Variable costs
  const [varCosts, setVarCosts] = useState<VariableCost[]>(DEFAULT_VARIABLE_COSTS);
  const [newVarLbl, setNewVarLbl] = useState('');
  const [newVarVal, setNewVarVal] = useState('');
  const [newVarType, setNewVarType] = useState<'percentage' | 'brl'>('percentage');
  const [newVarPerPax, setNewVarPerPax] = useState(true);


  // Step 3 — Pricing
  const [mode, setMode] = useState<PricingMode>('price');
  const [price, setPrice] = useState(0);
  const [marginPct, setMarginPct] = useState(0);
  const [marginPax, setMarginPax] = useState(10);
  const [simulationPax, setSimulationPax] = useState(0);
  const [isExplorationMode, setIsExplorationMode] = useState(false);
  const [maxPax, setMaxPax] = useState(50);

  // Persistence — stable identity for this calculator session
  const [routeId] = useState<string>(() => crypto.randomUUID());
  const [routeCreatedAt] = useState<string>(() => new Date().toISOString());
  const { saveRoute, saving } = useRoutes();

  // ── Derived ──
  const totalFixed = useMemo(() => calcTotalFixedCosts(fixedCosts), [fixedCosts]);
  const totalVarPct = useMemo(() => calcTotalVariablePercent(varCosts), [varCosts]);

  const effectivePrice = useMemo(() => {
    if (mode === 'price') return price;
    return calcPriceFromMargin(totalFixed, totalVarPct, marginPct, marginPax);
  }, [mode, price, marginPct, marginPax, totalFixed, totalVarPct]);

  const simulation = useMemo(
    () => isExplorationMode
      ? runSimulation(fixedCosts, varCosts, effectivePrice, maxPax, 0, simulationPax || 1)
      : runSimulation(fixedCosts, varCosts, effectivePrice, simulationPax || 1, 0, simulationPax || 1),
    [fixedCosts, varCosts, effectivePrice, maxPax, simulationPax, isExplorationMode],
  );

  const breakEvenForDisplay = useMemo(
    () => findBreakEven(fixedCosts, varCosts, effectivePrice),
    [fixedCosts, varCosts, effectivePrice],
  );

  // ── Persistence ──
  function buildCurrentRoute() {
    return {
      id: routeId,
      name: routeName || 'Sem nome',
      client,
      date,
      contact: '' as string,
      notes: '' as string,
      region: '' as string,
      type: 'outro' as RouteType,
      fixedCosts,
      variableCosts: varCosts,
      estimatedPrice: effectivePrice,
      currency: 'BRL' as Currency,
      days: [],
      isMultiDay: false,
      createdAt: routeCreatedAt,
      updatedAt: new Date().toISOString(),
    };
  }

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveRoute(buildCurrentRoute());
    }, 1500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixedCosts, varCosts, effectivePrice, routeName, client, date]);

  // ── Validation ──
  function canAdvance() {
    if (step === 0) return routeName.trim().length > 0;
    if (step === 3) {
      if (mode === 'price') return price > 0 && simulationPax > 0;
      return marginPct > 0 && marginPax > 0 && simulationPax > 0;
    }
    return true;
  }

  // ── Suggestion helpers ──
  function applyFixedSuggestion(label: string, category: CostCategory) {
    setNewLbl(label);
    setNewCat(category);
  }

  function applyVarSuggestion(label: string) {
    setNewVarLbl(label);
    setNewVarType('brl');
    setNewVarPerPax(true);
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
                i < step  && 'bg-emerald-500 text-white',
                i === step && 'bg-brand-orange text-white scale-110 shadow-button',
                i > step  && 'bg-surface-200 text-surface-500',
              )}>
                {i < step ? <Check size={14} /> : i + 1}
              </div>
              <span className={cn(
                'text-[10px] font-bold mt-1.5 text-center leading-tight',
                i === step && 'text-brand-navy',
                i < step  && 'text-emerald-600',
                i > step  && 'text-surface-400',
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

      {/* Auto-save indicator */}
      {saving && (
        <p className="text-center text-xs text-surface-400 mb-3 -mt-4">Salvando...</p>
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
                placeholder="Ex: City Tour Boa Vista"
                value={routeName}
                onChange={e => setRouteName(e.target.value)}
              />
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
            <Tip>
              O nome do roteiro aparecerá nos relatórios e na gestão de roteiros. Seja descritivo!
            </Tip>
          </div>
        )}

        {/* ───── STEP 1 — Custos fixos ───── */}
        {step === 1 && (
          <div className="space-y-3">
            {fixedCosts.length === 0 ? (
              <div className="text-center py-8 text-surface-400">
                <div className="text-4xl mb-2">📋</div>
                <p className="text-sm">
                  Nenhum custo fixo adicionado.<br />
                  Selecione o tipo, informe o valor e adicione.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {fixedCosts.map(c => (
                  <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-100">
                    <span className="text-lg">{CATEGORY_EMOJI[c.category]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-surface-800 truncate">
                        {COST_CATEGORY_LABELS[c.category]}
                        {c.label ? ` — ${c.label}` : ''}
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

            <Divider label="Sugestões" />

            {/* Chips sempre visíveis */}
            <div className="rounded-xl bg-surface-50 border border-surface-200 p-4">
              <div className="flex flex-wrap gap-2">
              {PRESET_FIXED_COSTS.map(p => {
                const alreadyAdded = fixedCosts.some(c => c.label === p.label);
                const isSelected = newLbl === p.label && newCat === p.category;
                return (
                  <button
                    key={p.label}
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() => applyFixedSuggestion(p.label, p.category)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-150',
                      alreadyAdded
                        ? 'bg-emerald-50 text-emerald-400 cursor-default line-through'
                        : isSelected
                          ? 'bg-brand-orange text-white border border-brand-orange'
                          : 'bg-white border border-surface-300 text-surface-600 hover:bg-brand-orange-50 hover:border-brand-orange-200 hover:text-brand-orange-700'
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => { setNewCat('outro'); setNewLbl(''); }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-150 border',
                  newCat === 'outro' && newLbl === ''
                    ? 'bg-surface-700 text-white border-surface-700'
                    : 'bg-surface-200 border-surface-300 text-surface-500 hover:bg-surface-300 hover:text-surface-700'
                )}
              >
                + Outro
              </button>
              </div>
            </div>

            <Divider label="Adicionar custo" />

            <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
              <div className="flex-[2]">
                <label className="input-label">
                  Descrição <span className="font-normal text-surface-400">(opcional)</span>
                </label>
                <input
                  className="input"
                  placeholder="Ex: Van para 15 pessoas"
                  value={newLbl}
                  onChange={e => setNewLbl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addFixedCost()}
                />
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1 sm:w-28">
                  <label className="input-label">Valor (R$)</label>
                  <input
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

            <Tip>
              Custos fixos não mudam com a quantidade de passageiros: transfer, diárias,
              alimentação, guia local, ingressos.
            </Tip>
          </div>
        )}

        {/* ───── STEP 2 — Variáveis ───── */}
        {step === 2 && (
          <div className="space-y-3">
            <div className="space-y-0 divide-y divide-surface-200">
              {varCosts.map(v => (
                <div key={v.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex-1 text-sm font-semibold text-surface-700">{v.label}</span>
                  {v.type === 'brl' ? (
                    <span className="text-xs text-surface-500 italic">
                      {formatBRL(v.brlValue ?? 0)} {v.perPax ? '/ pax' : 'rateado'}
                    </span>
                  ) : (
                    <>
                      <input
                        type="range"
                        min={0}
                        max={30}
                        step={0.5}
                        value={v.percentage}
                        onChange={e =>
                          setVarCosts(p =>
                            p.map(c => c.id === v.id ? { ...c, percentage: parseFloat(e.target.value) } : c)
                          )
                        }
                        className="w-24 accent-brand-orange cursor-pointer"
                      />
                      <span className="w-12 text-right text-sm font-extrabold text-brand-navy">
                        {v.percentage}%
                      </span>
                    </>
                  )}
                  <RemoveBtn onClick={() => setVarCosts(p => p.filter(c => c.id !== v.id))} />
                </div>
              ))}
            </div>

            <TotalRow label="Total % sobre o preço:" value={formatPercent(totalVarPct)} />

            <Divider label="Sugestões" />

            {/* Chips sempre visíveis */}
            <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-surface-50 border border-surface-200">
              {PRESET_VARIABLE_COSTS.map(p => {
                const alreadyAdded = varCosts.some(c => c.label === p.label);
                const isSelected = newVarLbl === p.label;
                return (
                  <button
                    key={p.label}
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() => applyVarSuggestion(p.label)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors duration-150',
                      alreadyAdded
                        ? 'bg-emerald-50 text-emerald-400 cursor-default line-through'
                        : isSelected
                          ? 'bg-brand-orange text-white border border-brand-orange'
                          : 'bg-white border border-surface-300 text-surface-600 hover:bg-brand-orange-50 hover:border-brand-orange-200 hover:text-brand-orange-700'
                    )}
                  >
                    {p.label}
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

            <Divider label="Adicionar custo variável" />

            {/* Toggle % / R$ */}
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
                <span className="text-sm font-semibold text-surface-700">Por passageiro?</span>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <div className="text-center">
                  <label className="input-label block text-center">Qtd. passageiros</label>
                  <input
                    className="input text-2xl sm:text-3xl font-extrabold text-brand-navy text-center py-4"
                    type="number"
                    placeholder="10"
                    value={marginPax || ''}
                    onChange={e => setMarginPax(parseInt(e.target.value) || 10)}
                  />
                </div>
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
                  Para ter {formatPercent(marginPct)} de margem com {marginPax} passageiros
                </p>
              </div>
            )}

            <div>
              <label className="input-label">
                {isExplorationMode ? 'Faixa de passageiros' : 'Quantidade de passageiros'}
              </label>
              {isExplorationMode ? (
                <div className="grid grid-cols-2 gap-3 max-w-xs">
                  <div>
                    <label className="input-label font-normal text-surface-400">De</label>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={maxPax - 1}
                      value={simulationPax || ''}
                      onChange={e => {
                        const v = Math.max(1, parseInt(e.target.value) || 0);
                        setSimulationPax(v);
                        if (v >= maxPax) setMaxPax(v + 1);
                      }}
                    />
                  </div>
                  <div>
                    <label className="input-label font-normal text-surface-400">Até (máx. 100)</label>
                    <input
                      className="input"
                      type="number"
                      min={(simulationPax || 1) + 1}
                      max={100}
                      value={maxPax || ''}
                      onChange={e => {
                        const v = Math.min(100, parseInt(e.target.value) || 0);
                        setMaxPax(v);
                        if (v <= simulationPax) setSimulationPax(Math.max(1, v - 1));
                      }}
                    />
                  </div>
                </div>
              ) : (
                <input
                  className="input max-w-[160px]"
                  type="number"
                  min={1}
                  max={100}
                  placeholder="Ex: 25"
                  value={simulationPax || ''}
                  onChange={e => setSimulationPax(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                />
              )}
            </div>
          </div>
        )}

        {/* ───── STEP 4 — Resultado ───── */}
        {step === 4 && (
          <div>
            <div className="text-xs text-surface-600 bg-surface-100 rounded-lg px-3 py-2 mb-5">
              {mode === 'profit'
                ? `Preço calculado: ${formatBRL(effectivePrice)} (margem ${formatPercent(marginPct)} com ${marginPax} pax)`
                : `Preço definido: ${formatBRL(effectivePrice)} por passageiro`}
            </div>
            <SimulationResults
              simulation={simulation}
              estimatedPrice={effectivePrice}
              isExplorationMode={isExplorationMode}
              breakEvenPax={breakEvenForDisplay}
              onCompareScenarios={() => {
                setIsExplorationMode(true);
                const safePax = Math.min(simulationPax, 99);
                setSimulationPax(safePax);
                setMaxPax(Math.min(100, safePax + 20));
                setStep(3);
              }}
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
          <button
            onClick={() => saveRoute(buildCurrentRoute())}
            disabled={saving}
            className="btn btn-secondary flex items-center gap-2 text-sm disabled:opacity-60"
          >
            {saving ? 'Salvando...' : <><Save size={16} /> Salvar roteiro</>}
          </button>
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

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-surface-50 border border-surface-200">
      <span className="text-xs text-surface-500">{label}</span>
      <span className="text-sm font-extrabold text-brand-navy">{value}</span>
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
