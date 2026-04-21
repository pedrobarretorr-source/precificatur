import { useMemo, useState, useEffect } from 'react';
import {
  Map, Calendar, User, Copy, Calculator, TrendingUp, TrendingDown,
  Loader2, Trash2, Check, X, ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react';
import { ROUTE_TYPE_LABELS, COST_CATEGORY_LABELS, type Route } from '@/types';
import {
  runSimulation,
  calcTotalFixedCosts,
  calcTotalVariablePercent,
  formatBRL,
  formatPercent,
} from '@/lib/pricing-engine';
import { cn } from '@/lib/utils';

const CATEGORY_EMOJI: Record<string, string> = {
  transfer: '🚐', hospedagem: '🏨', alimentacao: '🍽️',
  guia: '🧭', ingresso: '🎫', equipamento: '🎒', seguro: '🛡️', outro: '📦',
};

type SortKey = 'name' | 'date';
type SortDir = 'asc' | 'desc';

interface RoutesPageProps {
  onNavigate: (page: string, route?: Route) => void;
  routes: Route[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  deleteRoute: (id: string) => Promise<void>;
  saveRoute: (route: Partial<Route> & { id: string }) => Promise<string | null>;
}

export function RoutesPage({ onNavigate, routes, loading, saving, error, deleteRoute, saveRoute }: RoutesPageProps) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sortedRoutes = useMemo(() => {
    const arr = [...routes];
    const factor = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      if (sortKey === 'name') {
        return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }) * factor;
      }
      const da = new Date(a.date || a.createdAt).getTime();
      const db = new Date(b.date || b.createdAt).getTime();
      return (da - db) * factor;
    });
    return arr;
  }, [routes, sortKey, sortDir]);

  const selectedRoute = useMemo(
    () => sortedRoutes.find((r) => r.id === selectedId) ?? null,
    [sortedRoutes, selectedId],
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center">
              <Map size={20} className="text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-brand-navy">Meus roteiros</h1>
          </div>
          <p className="text-sm text-surface-500 ml-[52px]">
            {routes.length > 0
              ? `${routes.length} ${routes.length === 1 ? 'roteiro salvo' : 'roteiros salvos'}. Clique em um card para ver detalhes.`
              : 'Roteiros salvos aparecerão aqui.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {saving && (
            <span className="text-xs text-surface-400 flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" /> Salvando...
            </span>
          )}
          {routes.length > 0 && (
            <div
              role="group"
              aria-label="Ordenar roteiros"
              className="flex items-center gap-1 p-1 rounded-xl bg-surface-100 border border-surface-200"
            >
              <SortButton active={sortKey === 'name'} dir={sortDir} onClick={() => toggleSort('name')}>
                Nome
              </SortButton>
              <SortButton active={sortKey === 'date'} dir={sortDir} onClick={() => toggleSort('date')}>
                Data
              </SortButton>
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-surface-400">
          <Loader2 size={24} className="animate-spin mr-2" /> Carregando roteiros...
        </div>
      ) : routes.length === 0 ? (
        <div className="card text-center py-12 text-surface-400 text-sm">
          Nenhum roteiro salvo ainda. Use a calculadora para criar e salvar um roteiro.
        </div>
      ) : (
        <div
          className={cn(
            'grid gap-3',
            'grid-cols-2',       // mobile: 2
            'sm:grid-cols-3',    // larger mobile: 3
            'md:grid-cols-3',    // tablet: 3
            'lg:grid-cols-4',    // small desktop: 4
            'xl:grid-cols-5',    // desktop: 5
          )}
        >
          {sortedRoutes.map((route) => (
            <CompactRouteCard
              key={route.id}
              route={route}
              onOpen={() => setSelectedId(route.id)}
            />
          ))}
        </div>
      )}

      {/* Reuse explanation */}
      {routes.length > 0 && (
        <div className="card bg-brand-navy-50 border-brand-navy-100">
          <h3 className="text-sm font-extrabold text-brand-navy mb-2">
            🔄 Como reaproveitar um roteiro
          </h3>
          <ol className="space-y-1.5 text-xs text-brand-navy-700 list-decimal list-inside leading-relaxed">
            <li>Clique em qualquer card para ver os detalhes completos.</li>
            <li>Use <strong>"Abrir na Calculadora"</strong> para carregar custos e preço automaticamente.</li>
            <li><strong>"Duplicar"</strong> cria uma cópia sem alterar o original — ideal para variações.</li>
          </ol>
        </div>
      )}

      {/* Detail modal */}
      {selectedRoute && (
        <RouteDetailModal
          route={selectedRoute}
          onClose={() => setSelectedId(null)}
          onNavigate={(page, r) => {
            setSelectedId(null);
            onNavigate(page, r);
          }}
          onDelete={async (id) => {
            setSelectedId(null);
            await deleteRoute(id);
          }}
          onDuplicate={saveRoute}
        />
      )}
    </div>
  );
}

// ── Sort Button ───────────────────────────────────────────────────────────────

function SortButton({
  active, dir, onClick, children,
}: {
  active: boolean; dir: SortDir; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange',
        active
          ? 'bg-white text-brand-navy shadow-sm'
          : 'text-surface-500 hover:text-brand-navy',
      )}
    >
      {children}
      {active
        ? (dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)
        : <ArrowUpDown size={12} className="opacity-40" />}
    </button>
  );
}

// ── Compact Route Card ────────────────────────────────────────────────────────

function CompactRouteCard({ route, onOpen }: { route: Route; onOpen: () => void }) {
  const simPax = route.simulationPax || 1;
  const maxPax = Math.max(simPax, route.maxPax || simPax, 1);
  const simulation = runSimulation(route.fixedCosts, route.variableCosts, route.estimatedPrice, maxPax);
  const atPax = simulation.rows.find(r => r.pax === simPax) ?? simulation.rows[simulation.rows.length - 1] ?? null;
  const isProfit = atPax ? atPax.finalResult >= 0 : null;

  const displayDate = route.date
    ? new Date(route.date + 'T12:00:00').toLocaleDateString('pt-BR')
    : new Date(route.createdAt).toLocaleDateString('pt-BR');

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Abrir detalhes do roteiro ${route.name}`}
      className={cn(
        'group relative flex flex-col text-left p-3 rounded-2xl',
        'bg-brand-navy text-white shadow-card',
        'hover:bg-brand-navy-700 hover:shadow-card-hover hover:-translate-y-0.5',
        'transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-orange',
        'touch-manipulation',
      )}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Top: type + profit indicator */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="bg-brand-navy-800 text-white text-[9px] font-bold px-2 py-0.5 rounded-full truncate max-w-full">
          {ROUTE_TYPE_LABELS[route.type]}
        </span>
        {isProfit !== null && (
          <span
            aria-label={isProfit ? 'Lucrativo em 10 pax' : 'Prejuízo em 10 pax'}
            className={cn(
              'flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full text-white',
              isProfit ? 'bg-emerald-500' : 'bg-red-500',
            )}
          >
            {isProfit ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          </span>
        )}
      </div>

      {/* Name */}
      <h3 className="font-extrabold text-white text-sm leading-tight line-clamp-2 min-w-0 mb-2">
        {route.name}
      </h3>

      {/* Meta */}
      <div className="mt-auto space-y-1 text-[11px] text-brand-navy-100 min-w-0">
        <div className="flex items-center gap-1 truncate">
          <Calendar size={10} className="flex-shrink-0" />
          <span className="truncate">{displayDate}</span>
        </div>
        {route.client && (
          <div className="flex items-center gap-1 truncate">
            <User size={10} className="flex-shrink-0" />
            <span className="truncate">{route.client}</span>
          </div>
        )}
      </div>

      {/* Price pill */}
      <div className="mt-2 pt-2 border-t border-white/10 flex items-baseline justify-between gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wide text-brand-navy-200">Preço/pax</span>
        <span className="text-sm font-extrabold text-brand-gold truncate">
          {formatBRL(route.estimatedPrice)}
        </span>
      </div>
    </button>
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────────

function RouteDetailModal({
  route, onClose, onNavigate, onDelete, onDuplicate,
}: {
  route: Route;
  onClose: () => void;
  onNavigate: (page: string, route?: Route) => void;
  onDelete: (id: string) => void;
  onDuplicate: (route: Partial<Route> & { id: string }) => Promise<string | null>;
}) {
  const [duplicating, setDuplicating] = useState(false);
  const [duplicated, setDuplicated] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ESC to close + lock body scroll
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function handleDuplicate() {
    setDuplicating(true);
    await onDuplicate({
      ...route,
      id: crypto.randomUUID(),
      name: `${route.name} (cópia)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setDuplicating(false);
    setDuplicated(true);
    setTimeout(() => setDuplicated(false), 2000);
  }

  const totalFixed = calcTotalFixedCosts(route.fixedCosts);
  const totalVarPct = calcTotalVariablePercent(route.variableCosts);
  const simPax = route.simulationPax || 1;
  const maxPax = Math.max(simPax, route.maxPax || simPax, 1);
  const simulation = runSimulation(route.fixedCosts, route.variableCosts, route.estimatedPrice, maxPax);
  const { breakEvenPax, rows } = simulation;
  const atPax = rows.find(r => r.pax === simPax) ?? rows[rows.length - 1] ?? null;

  const createdDate = new Date(route.createdAt).toLocaleDateString('pt-BR');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="route-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-brand-navy/60 backdrop-blur-sm animate-fade-in" />

      {/* Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'relative w-full sm:max-w-3xl max-h-full sm:max-h-[90vh]',
          'bg-white sm:rounded-2xl shadow-elevated flex flex-col overflow-hidden',
          'animate-fade-in',
        )}
        style={{ overscrollBehavior: 'contain' }}
      >
        {/* Modal header — solid navy */}
        <div className="flex items-start justify-between gap-3 p-5 bg-brand-navy text-white">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <h2
                id="route-detail-title"
                className="text-lg sm:text-xl font-extrabold text-white truncate"
              >
                {route.name}
              </h2>
              <span className="bg-brand-orange text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {ROUTE_TYPE_LABELS[route.type]}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-brand-navy-100 flex-wrap">
              {route.client && (
                <span className="flex items-center gap-1">
                  <User size={11} /> {route.client}
                </span>
              )}
              {route.date && (
                <span className="flex items-center gap-1">
                  <Calendar size={11} />
                  {new Date(route.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                </span>
              )}
              <span className="text-brand-navy-200">Criado em {createdDate}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhes"
            className="flex-shrink-0 w-9 h-9 rounded-xl bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy focus-visible:ring-brand-orange"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal body (scrollable) */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5" style={{ overscrollBehavior: 'contain' }}>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Custos fixos" value={formatBRL(totalFixed)} sub="do roteiro" color="navy" />
            <StatCard label="Variáveis" value={formatPercent(totalVarPct)} sub="sobre o preço" color="orange" />
            <StatCard label="Preço por pax" value={formatBRL(route.estimatedPrice)} sub="por passageiro" color="navy" />
            <StatCard
              label="Ponto de equilíbrio"
              value={breakEvenPax ? `${breakEvenPax} pax` : '—'}
              sub="mínimo sem prejuízo"
              color={breakEvenPax ? 'green' : 'red'}
            />
          </div>

          {/* Margin preview at simPax */}
          {atPax && (
            <div className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl border text-sm',
              atPax.finalResult >= 0
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-red-50 border-red-200',
            )}>
              {atPax.finalResult >= 0
                ? <TrendingUp size={16} className="text-emerald-600 flex-shrink-0" />
                : <TrendingDown size={16} className="text-red-500 flex-shrink-0" />}
              <span className="text-surface-700">
                Com <strong>{simPax} {simPax === 1 ? 'passageiro' : 'passageiros'}</strong>:{' '}
                <span className={cn('font-extrabold', atPax.finalResult >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                  {formatBRL(atPax.finalResult)}
                </span>
                {' '}de resultado —{' '}
                <span className="font-semibold">{formatPercent(atPax.margin)} de margem</span>
              </span>
            </div>
          )}

          {/* Costs breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-surface-500 uppercase tracking-wide mb-2">Custos fixos</p>
              <div className="space-y-1.5">
                {route.fixedCosts.length === 0 && (
                  <p className="text-xs text-surface-400 italic">Nenhum custo fixo.</p>
                )}
                {route.fixedCosts.map(c => (
                  <div key={c.id} className="flex items-center gap-2 text-sm min-w-0">
                    <span>{CATEGORY_EMOJI[c.category] ?? '📦'}</span>
                    <span className="flex-1 text-surface-700 truncate min-w-0">
                      {COST_CATEGORY_LABELS[c.category]}{c.label ? ` — ${c.label}` : ''}
                    </span>
                    <span className="font-semibold text-brand-navy whitespace-nowrap">
                      {formatBRL(c.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-surface-500 uppercase tracking-wide mb-2">Custos variáveis</p>
              <div className="space-y-1.5">
                {route.variableCosts.length === 0 && (
                  <p className="text-xs text-surface-400 italic">Nenhum custo variável.</p>
                )}
                {route.variableCosts.map(v => (
                  <div key={v.id} className="flex items-center justify-between gap-2 text-sm min-w-0">
                    <span className="text-surface-700 truncate min-w-0">{v.label}</span>
                    <span className="font-semibold text-brand-navy whitespace-nowrap">
                      {v.type === 'brl'
                        ? `${formatBRL(v.brlValue ?? 0)}${v.perPax ? '/pax' : ' rateado'}`
                        : formatPercent(v.percentage)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Notes */}
          {route.notes && (
            <div className="flex items-start gap-2 text-xs text-surface-600 bg-brand-gold-50 border border-brand-gold-200 rounded-xl px-3 py-2.5">
              <span className="text-base">📝</span>
              <p className="min-w-0 break-words">{route.notes}</p>
            </div>
          )}
        </div>

        {/* Modal footer — actions */}
        <div className="p-4 border-t border-surface-100 flex flex-wrap gap-2 justify-end bg-surface-50/50 sm:rounded-b-2xl">
          {confirmDelete ? (
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto" role="alert">
              <span className="text-xs text-red-600 font-semibold flex-1 sm:flex-none">
                Excluir este roteiro?
              </span>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-2 rounded-xl border-2 border-surface-300 text-surface-600 text-xs font-bold hover:border-surface-400 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => onDelete(route.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-all"
              >
                <Trash2 size={14} /> Confirmar
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                aria-label="Excluir roteiro"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-red-200 text-red-500 text-xs font-bold hover:border-red-300 transition-all"
              >
                <Trash2 size={14} /> Excluir
              </button>
              <button
                type="button"
                onClick={handleDuplicate}
                disabled={duplicating || duplicated}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-surface-300 text-surface-600 text-xs font-bold hover:border-surface-400 transition-all disabled:opacity-60"
              >
                {duplicated
                  ? <><Check size={14} className="text-emerald-500" /> <span className="text-emerald-600">Duplicado!</span></>
                  : duplicating
                    ? <><Loader2 size={14} className="animate-spin" /> Duplicando...</>
                    : <><Copy size={14} /> Duplicar</>}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('calculator', route)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-orange text-white text-xs font-bold hover:bg-brand-orange-500 transition-all"
              >
                <Calculator size={14} /> Abrir na Calculadora
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

type StatColor = 'navy' | 'orange' | 'green' | 'red';

function StatCard({ label, value, sub, color }: {
  label: string; value: string; sub: string; color: StatColor;
}) {
  const styles: Record<StatColor, string> = {
    navy:   'bg-brand-navy text-white',
    orange: 'bg-brand-orange text-white',
    green:  'bg-emerald-500 text-white',
    red:    'bg-red-500 text-white',
  };
  return (
    <div className={cn('rounded-xl p-3 text-center shadow-card', styles[color])}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-80 mb-0.5">{label}</p>
      <p className="text-lg font-extrabold leading-tight">{value}</p>
      <p className="text-[10px] opacity-75 mt-0.5">{sub}</p>
    </div>
  );
}
