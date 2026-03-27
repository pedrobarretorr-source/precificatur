import { Map, Calendar, User, Copy, Calculator, TrendingUp, TrendingDown, Loader2, Trash2 } from 'lucide-react';
import { useRoutes } from '@/hooks/useRoutes';
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

interface RoutesPageProps {
  onNavigate: (page: string) => void;
}

export function RoutesPage({ onNavigate }: RoutesPageProps) {
  const { routes, loading, saving, error, deleteRoute } = useRoutes();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center">
              <Map size={20} className="text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-brand-navy">Meus roteiros</h1>
          </div>
          <p className="text-sm text-surface-500 ml-[52px]">
            Roteiros salvos. Abra na calculadora para simular ou duplicar.
          </p>
        </div>
        {saving && (
          <span className="text-xs text-surface-400 flex items-center gap-1">
            <Loader2 size={12} className="animate-spin" /> Salvando...
          </span>
        )}
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {/* Route cards */}
      <div className="space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-surface-400">
            <Loader2 size={24} className="animate-spin mr-2" /> Carregando roteiros...
          </div>
        ) : routes.length === 0 ? (
          <div className="text-center py-12 text-surface-400 text-sm">
            Nenhum roteiro salvo ainda. Use a calculadora para criar e salvar um roteiro.
          </div>
        ) : (
          routes.map(route => (
            <RouteCard key={route.id} route={route} onNavigate={onNavigate} onDelete={deleteRoute} />
          ))
        )}
      </div>

      {/* Reuse explanation */}
      <div className="card bg-brand-navy-50 border-brand-navy-100">
        <h3 className="text-sm font-extrabold text-brand-navy mb-2">
          🔄 Como reaproveitar um roteiro
        </h3>
        <ol className="space-y-1.5 text-xs text-brand-navy-700 list-decimal list-inside leading-relaxed">
          <li>Clique em <strong>"Abrir na Calculadora"</strong> — todos os custos e preço são carregados automaticamente.</li>
          <li>Ajuste o que precisar: adicione custos novos, mude o preço ou a margem.</li>
          <li>Salve como um novo roteiro ou substitua o atual.</li>
          <li><strong>"Duplicar"</strong> cria uma cópia sem alterar o original — ideal para variações do mesmo passeio.</li>
        </ol>
      </div>
    </div>
  );
}

// ── Route Card ────────────────────────────────────────────────────────────────

function RouteCard({ route, onNavigate, onDelete }: {
  route: Route;
  onNavigate: (page: string) => void;
  onDelete: (id: string) => void;
}) {
  const totalFixed = calcTotalFixedCosts(route.fixedCosts);
  const totalVarPct = calcTotalVariablePercent(route.variableCosts);
  const simulation = runSimulation(route.fixedCosts, route.variableCosts, route.estimatedPrice, 30);
  const { breakEvenPax, rows } = simulation;
  const at10 = rows.length >= 10 ? rows[9] : null;

  const createdDate = new Date(route.createdAt).toLocaleDateString('pt-BR');

  return (
    <div className="card space-y-5">
      {/* Card header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="text-lg font-extrabold text-brand-navy truncate">
              {route.name}
            </h2>
            <span className="badge bg-brand-navy-50 text-brand-navy text-[10px] font-bold px-2 py-0.5 rounded-full">
              {ROUTE_TYPE_LABELS[route.type]}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-surface-500 flex-wrap">
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
            <span className="text-surface-400">Criado em {createdDate}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => onNavigate('calculator')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-orange text-white text-xs font-bold hover:bg-brand-orange-500 transition-all"
          >
            <Calculator size={13} /> Abrir na Calculadora
          </button>
          <button
            onClick={() => alert('Duplicar roteiro — em breve')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-surface-300 text-surface-600 text-xs font-bold hover:border-surface-400 transition-all"
          >
            <Copy size={13} /> Duplicar
          </button>
          <button
            onClick={() => onDelete(route.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-red-200 text-red-500 text-xs font-bold hover:border-red-300 transition-all"
          >
            <Trash2 size={13} /> Excluir
          </button>
        </div>
      </div>

      {/* Simulation stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Custos fixos"
          value={formatBRL(totalFixed)}
          sub="do roteiro"
          color="navy"
        />
        <StatCard
          label="Variáveis"
          value={formatPercent(totalVarPct)}
          sub="sobre o preço"
          color="orange"
        />
        <StatCard
          label="Preço por pax"
          value={formatBRL(route.estimatedPrice)}
          sub="por passageiro"
          color="navy"
        />
        <StatCard
          label="Ponto de equilíbrio"
          value={breakEvenPax ? `${breakEvenPax} pax` : '—'}
          sub="mínimo sem prejuízo"
          color={breakEvenPax ? 'green' : 'red'}
        />
      </div>

      {/* Margin preview at 10 pax */}
      {at10 && (
        <div className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-xl border text-sm',
          at10.finalResult >= 0
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-red-50 border-red-200'
        )}>
          {at10.finalResult >= 0
            ? <TrendingUp size={16} className="text-emerald-600 flex-shrink-0" />
            : <TrendingDown size={16} className="text-red-500 flex-shrink-0" />}
          <span className="text-surface-700">
            Com <strong>10 passageiros</strong>:{' '}
            <span className={cn('font-extrabold', at10.finalResult >= 0 ? 'text-emerald-600' : 'text-red-500')}>
              {formatBRL(at10.finalResult)}
            </span>
            {' '}de resultado —{' '}
            <span className="font-semibold">{formatPercent(at10.margin)} de margem</span>
          </span>
        </div>
      )}

      {/* Costs breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Fixed costs list */}
        <div>
          <p className="text-xs font-bold text-surface-500 uppercase tracking-wide mb-2">Custos fixos</p>
          <div className="space-y-1.5">
            {route.fixedCosts.map(c => (
              <div key={c.id} className="flex items-center gap-2 text-sm">
                <span>{CATEGORY_EMOJI[c.category] ?? '📦'}</span>
                <span className="flex-1 text-surface-700 truncate">
                  {COST_CATEGORY_LABELS[c.category]}{c.label ? ` — ${c.label}` : ''}
                </span>
                <span className="font-semibold text-brand-navy whitespace-nowrap">
                  {formatBRL(c.value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Variable costs list */}
        <div>
          <p className="text-xs font-bold text-surface-500 uppercase tracking-wide mb-2">Custos variáveis</p>
          <div className="space-y-1.5">
            {route.variableCosts.map(v => (
              <div key={v.id} className="flex items-center justify-between text-sm">
                <span className="text-surface-700">{v.label}</span>
                <span className="font-semibold text-brand-navy">
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
          <p>{route.notes}</p>
        </div>
      )}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

type StatColor = 'navy' | 'orange' | 'green' | 'red';

function StatCard({ label, value, sub, color }: {
  label: string; value: string; sub: string; color: StatColor;
}) {
  const styles: Record<StatColor, string> = {
    navy:   'bg-brand-navy-50  border-brand-navy-100  text-brand-navy',
    orange: 'bg-brand-orange-50 border-brand-orange-100 text-brand-orange',
    green:  'bg-emerald-50 border-emerald-200 text-emerald-600',
    red:    'bg-red-50 border-red-200 text-red-500',
  };
  return (
    <div className={cn('rounded-xl border p-3 text-center', styles[color])}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-70 mb-0.5">{label}</p>
      <p className="text-lg font-extrabold leading-tight">{value}</p>
      <p className="text-[10px] opacity-60 mt-0.5">{sub}</p>
    </div>
  );
}
