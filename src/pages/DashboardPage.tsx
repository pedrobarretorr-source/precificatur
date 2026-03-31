import { useMemo } from 'react';
import {
  Calculator, Map, TrendingUp, FileText, ArrowRight,
  DollarSign, Users, Percent, BarChart3, Sparkles,
  ClipboardList, SlidersHorizontal, PieChart, Lock,
  Clock, ChevronRight,
} from 'lucide-react';
import { runSimulation, formatBRL, formatPercent } from '@/lib/pricing-engine';
import { ROUTE_TYPE_LABELS, type Route } from '@/types';
import { cn } from '@/lib/utils';

interface DashboardPageProps {
  onNavigate: (page: string) => void;
  routes: Route[];
  loading: boolean;
}

export function DashboardPage({ onNavigate, routes, loading }: DashboardPageProps) {

  const stats = useMemo(() => {
    if (routes.length === 0) return { count: 0, avgPrice: null, avgMargin: null, bestRoute: null as Route | null };
    const prices = routes.map(r => r.estimatedPrice).filter(p => p > 0);
    const routeMargins = routes
      .map(r => {
        const sim = runSimulation(r.fixedCosts, r.variableCosts, r.estimatedPrice, 10);
        const margin = sim.rows.length >= 10 ? sim.rows[9].margin : null;
        return { route: r, margin };
      })
      .filter((rm): rm is { route: Route; margin: number } => rm.margin !== null && isFinite(rm.margin));
    const margins = routeMargins.map(rm => rm.margin);
    const best = routeMargins.sort((a, b) => b.margin - a.margin)[0] ?? null;
    return {
      count: routes.length,
      avgPrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
      avgMargin: margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : null,
      bestRoute: best?.route ?? null,
    };
  }, [routes]);

  const recentRoutes = useMemo(() => {
    return [...routes]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 3);
  }, [routes]);

  const hasRoutes = routes.length > 0;

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">

      {/* ── Hero banner ── */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl gradient-brand p-5 sm:p-8 text-white">
        <div className="relative z-10">
          <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-2">
            Precificador de Roteiros
          </p>
          <h1 className="text-xl sm:text-3xl font-extrabold mb-2 leading-tight">
            Quanto cobrar pelo seu<br />
            <span className="text-brand-orange-300">próximo roteiro?</span>
          </h1>
          <p className="text-white/60 max-w-md text-sm leading-relaxed">
            Informe seus custos, defina sua margem e descubra
            quantos passageiros precisa para lucrar.
          </p>
          <button
            onClick={() => onNavigate('calculator')}
            className="mt-5 btn bg-brand-orange text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl
                       font-bold hover:bg-brand-orange-500 transition-all
                       flex items-center gap-2 text-sm sm:text-base shadow-button"
          >
            <Calculator size={18} />
            Calcular agora
            <ArrowRight size={16} />
          </button>
        </div>
        {/* Decorative */}
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/5" />
        <div className="absolute -right-8 top-8 w-48 h-48 rounded-full bg-white/5" />
        <div className="absolute right-24 -bottom-8 w-32 h-32 rounded-full bg-brand-orange/20" />
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          icon={<ClipboardList size={18} />}
          value={loading ? '...' : String(stats.count)}
          sub="criados"
          iconBg="bg-brand-navy-50 text-brand-navy"
        />
        <StatCard
          icon={<DollarSign size={18} />}
          value={loading ? '...' : stats.avgPrice !== null ? formatBRL(stats.avgPrice) : '—'}
          sub="por passageiro"
          iconBg="bg-brand-orange-50 text-brand-orange"
        />
        <StatCard
          icon={<Percent size={18} />}
          value={loading ? '...' : stats.avgMargin !== null ? formatPercent(stats.avgMargin) : '—'}
          sub="de lucro"
          iconBg="bg-emerald-50 text-emerald-600"
        />
      </div>

      {/* ── Quick actions ── */}
      <section>
        <h2 className="text-sm font-extrabold text-surface-600 uppercase tracking-wide mb-3">
          Acesso rápido
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <ActionCard
            icon={<Calculator size={22} />}
            title="Calculadora"
            desc="Precifique um novo roteiro do zero"
            color="bg-brand-orange"
            onClick={() => onNavigate('calculator')}
          />
          <ActionCard
            icon={<Map size={22} />}
            title="Meus roteiros"
            desc="Veja, edite e duplique roteiros salvos"
            color="bg-brand-navy"
            onClick={() => onNavigate('routes')}
            badge={hasRoutes ? String(routes.length) : undefined}
          />
          <ActionCard
            icon={<BarChart3 size={22} />}
            title="Cenários"
            desc="Compare preços e margens lado a lado"
            color="bg-brand-blue"
            locked
          />
          <ActionCard
            icon={<FileText size={22} />}
            title="Relatórios"
            desc="Gere propostas profissionais em PDF"
            color="bg-brand-tangerine"
            locked
          />
        </div>
      </section>

      {/* ── How it works (shown for everyone, especially useful for new users) ── */}
      {!hasRoutes && (
        <section className="card bg-gradient-to-br from-brand-navy-50/60 to-white border-brand-navy-100">
          <h2 className="text-base font-extrabold text-brand-navy mb-4 flex items-center gap-2">
            <Sparkles size={18} className="text-brand-orange" />
            Como funciona?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <StepItem
              step={1}
              icon={<ClipboardList size={20} />}
              title="Informe os custos"
              desc="Adicione os custos fixos (van, guia, ingresso) e variáveis (taxas, comissões) do roteiro."
            />
            <StepItem
              step={2}
              icon={<SlidersHorizontal size={20} />}
              title="Defina o preço"
              desc="Escolha o preço por passageiro ou defina a margem desejada — a calculadora faz o resto."
            />
            <StepItem
              step={3}
              icon={<PieChart size={20} />}
              title="Veja o resultado"
              desc="Descubra o ponto de equilíbrio, a margem real e simule cenários com diferentes quantidades."
            />
          </div>
          <button
            onClick={() => onNavigate('calculator')}
            className="mt-5 btn-primary text-sm w-full sm:w-auto"
          >
            <Calculator size={16} />
            Criar meu primeiro roteiro
            <ArrowRight size={14} />
          </button>
        </section>
      )}

      {/* ── Recent routes (only if user has routes) ── */}
      {hasRoutes && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-extrabold text-surface-600 uppercase tracking-wide">
              Roteiros recentes
            </h2>
            <button
              onClick={() => onNavigate('routes')}
              className="text-xs font-bold text-brand-blue flex items-center gap-1 hover:text-brand-navy transition-colors"
            >
              Ver todos <ChevronRight size={14} />
            </button>
          </div>
          <div className="space-y-2.5">
            {recentRoutes.map((route, i) => (
              <RecentRouteRow
                key={route.id}
                route={route}
                index={i}
                onClick={() => onNavigate('calculator')}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Best route highlight ── */}
      {stats.bestRoute && stats.avgMargin !== null && (
        <div className="card bg-emerald-50 border-emerald-200 flex items-start gap-3 sm:gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-extrabold text-emerald-800">
              Melhor desempenho
            </p>
            <p className="text-xs text-emerald-700 mt-0.5">
              <span className="font-bold">{stats.bestRoute.name}</span> é o roteiro com
              a maior margem entre os seus roteiros cadastrados.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, value, sub, iconBg }: {
  icon: React.ReactNode;
  value: string;
  sub: string;
  iconBg: string;
}) {
  return (
    <div className="card flex flex-col items-center text-center py-4 sm:py-6 gap-1.5">
      <div className={cn('w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center', iconBg)}>
        {icon}
      </div>
      <p className="text-lg sm:text-2xl font-extrabold text-surface-800 leading-tight">{value}</p>
      <div>
        <p className="text-[10px] sm:text-xs font-bold text-surface-500 uppercase tracking-wide">{sub}</p>
      </div>
    </div>
  );
}

function ActionCard({ icon, title, desc, color, onClick, badge, locked }: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: string;
  onClick?: () => void;
  badge?: string;
  locked?: boolean;
}) {
  return (
    <button
      onClick={locked ? undefined : onClick}
      disabled={locked}
      className={cn(
        'card-hover text-left group animate-slide-up relative',
        locked && 'opacity-55 cursor-not-allowed hover:shadow-card hover:border-surface-300/50'
      )}
    >
      <div className="flex items-start justify-between mb-2.5">
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center',
          locked ? 'bg-surface-300' : color,
          !locked && 'group-hover:scale-110 transition-transform',
        )}>
          <span className="text-white">{locked ? <Lock size={20} /> : icon}</span>
        </div>
        {badge && (
          <span className="badge bg-brand-navy-50 text-brand-navy text-[10px] px-2 py-0.5">
            {badge}
          </span>
        )}
        {locked && (
          <span className="badge bg-surface-200 text-surface-500 text-[10px] px-2 py-0.5">
            Em breve
          </span>
        )}
      </div>
      <h3 className="font-extrabold text-surface-800 text-sm mb-0.5">{title}</h3>
      <p className="text-xs text-surface-500 leading-relaxed">{desc}</p>
    </button>
  );
}

function StepItem({ step, icon, title, desc }: {
  step: number;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col items-center text-center sm:items-start sm:text-left gap-2">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-brand-orange text-white text-xs font-extrabold flex items-center justify-center">
          {step}
        </span>
        <span className="text-brand-navy">{icon}</span>
      </div>
      <h3 className="font-extrabold text-surface-800 text-sm">{title}</h3>
      <p className="text-xs text-surface-600 leading-relaxed">{desc}</p>
    </div>
  );
}

function RecentRouteRow({ route, index, onClick }: {
  route: Route;
  index: number;
  onClick: () => void;
}) {
  const sim = runSimulation(route.fixedCosts, route.variableCosts, route.estimatedPrice, 10);
  const margin = sim.rows.length >= 10 ? sim.rows[9].margin : null;
  const updatedDate = new Date(route.updatedAt).toLocaleDateString('pt-BR');
  const isPositive = margin !== null && margin > 0;

  return (
    <button
      onClick={onClick}
      className="card-hover w-full text-left flex items-center gap-3 sm:gap-4 py-3 sm:py-4 animate-slide-up group"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Icon */}
      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-brand-navy-50 flex items-center justify-center flex-shrink-0">
        <Map size={18} className="text-brand-navy" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-extrabold text-surface-800 truncate">{route.name}</p>
          <span className="badge bg-surface-200 text-surface-600 text-[9px] hidden sm:inline-flex">
            {ROUTE_TYPE_LABELS[route.type]}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-surface-500">
          <span className="flex items-center gap-1">
            <DollarSign size={10} />
            {formatBRL(route.estimatedPrice)}
          </span>
          {route.client && (
            <span className="flex items-center gap-1">
              <Users size={10} />
              {route.client}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {updatedDate}
          </span>
        </div>
      </div>

      {/* Margin pill */}
      <div className={cn(
        'text-xs font-extrabold px-2.5 py-1 rounded-lg flex-shrink-0',
        isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
      )}>
        {margin !== null ? formatPercent(margin) : '—'}
      </div>

      <ChevronRight size={16} className="text-surface-400 group-hover:text-brand-navy transition-colors flex-shrink-0 hidden sm:block" />
    </button>
  );
}
