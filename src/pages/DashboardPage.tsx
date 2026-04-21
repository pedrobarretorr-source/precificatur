import { useMemo } from 'react';
import {
  Calculator, Map, TrendingUp, FileText, ArrowRight,
  DollarSign, Users, Percent, BarChart3,
  ClipboardList, SlidersHorizontal, PieChart, Lock,
  Clock, ChevronRight,
} from 'lucide-react';
import { runSimulation, formatBRL, formatPercent } from '@/lib/pricing-engine';
import { ROUTE_TYPE_LABELS, type Route } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface DashboardPageProps {
  onNavigate: (page: string) => void;
  routes: Route[];
  loading: boolean;
}

function marginForRoute(route: Route): number | null {
  const simPax = route.simulationPax || 1;
  const maxPax = Math.max(simPax, route.maxPax || simPax, 1);
  const sim = runSimulation(route.fixedCosts, route.variableCosts, route.estimatedPrice, maxPax);
  const row = sim.rows.find(r => r.pax === simPax) ?? sim.rows[sim.rows.length - 1];
  const m = row?.margin;
  return m !== undefined && isFinite(m) ? m : null;
}

export function DashboardPage({ onNavigate, routes, loading }: DashboardPageProps) {
  const { user } = useAuth();

  const firstName = ((user?.user_metadata?.full_name as string | undefined)
    ?.split(' ')[0])
    ?? user?.email?.split('@')[0]
    ?? 'Operador';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  const stats = useMemo(() => {
    if (routes.length === 0) return { count: 0, avgPrice: null, avgMargin: null, bestRoute: null as Route | null, bestMargin: null as number | null };
    const prices = routes.map(r => r.estimatedPrice).filter(p => p > 0);
    const routeMargins = routes
      .map(r => ({ route: r, margin: marginForRoute(r) }))
      .filter((rm): rm is { route: Route; margin: number } => rm.margin !== null);
    const margins = routeMargins.map(rm => rm.margin);
    const best = routeMargins.sort((a, b) => b.margin - a.margin)[0] ?? null;
    return {
      count: routes.length,
      avgPrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
      avgMargin: margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : null,
      bestRoute: best?.route ?? null,
      bestMargin: best?.margin ?? null,
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
      <div className="rounded-2xl sm:rounded-3xl gradient-brand p-5 sm:p-7 text-white">
        <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-2">
          {greeting}, {firstName}
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

      {/* ── Stats row ── */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          icon={<ClipboardList size={14} />}
          label="Roteiros"
          value={loading ? '...' : String(stats.count)}
          sub="Roteiros salvos"
        />
        <StatCard
          icon={<DollarSign size={14} />}
          label="Preço médio"
          value={loading ? '...' : stats.avgPrice !== null ? formatBRL(stats.avgPrice) : '—'}
          sub="Preço médio / pax"
        />
        <StatCard
          icon={<Percent size={14} />}
          label="Margem"
          value={loading ? '...' : stats.avgMargin !== null ? formatPercent(stats.avgMargin) : '—'}
          sub="Margem média"
        />
      </div>

      {/* ── Best route highlight (discreet) ── */}
      {stats.bestRoute && stats.bestMargin !== null && (
        <div className="rounded-xl bg-surface-100 border border-surface-300/60 px-3 sm:px-4 py-2.5 flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={14} className="text-emerald-600" />
          </div>
          <p className="text-xs text-surface-700 flex-1 min-w-0 truncate">
            <span className="font-bold text-surface-500 uppercase tracking-wide text-[10px] mr-2">Maior margem</span>
            <span className="font-extrabold text-surface-800">{stats.bestRoute.name}</span>
            <span className="text-surface-500"> — {formatPercent(stats.bestMargin)} de margem</span>
          </p>
        </div>
      )}

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

      {/* ── 3-step onboarding (new users) ── */}
      {!hasRoutes && (
        <section className="card">
          <h2 className="text-base font-extrabold text-brand-navy mb-4">
            Comece em 3 passos
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

      {/* ── Recent routes ── */}
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
            {recentRoutes.map(route => (
              <RecentRouteRow
                key={route.id}
                route={route}
                onClick={() => onNavigate('calculator')}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="card py-4 sm:py-5">
      <div className="flex items-center gap-1.5 text-surface-500 mb-1.5">
        {icon}
        <p className="text-[10px] font-bold uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-lg sm:text-2xl font-extrabold text-surface-800 leading-tight mb-1">
        {value}
      </p>
      <p className="text-[11px] text-surface-500 leading-snug">{sub}</p>
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
        'text-left relative card transition-all',
        locked
          ? 'opacity-55 cursor-not-allowed'
          : 'hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center',
          locked ? 'bg-surface-300' : color,
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
      <h3 className="font-extrabold text-surface-800 text-sm mb-1">{title}</h3>
      <p className="text-xs text-surface-500 leading-relaxed line-clamp-2">{desc}</p>
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
        <span className="w-6 h-6 rounded-full bg-brand-navy-50 text-brand-navy text-xs font-extrabold flex items-center justify-center">
          {step}
        </span>
        <span className="text-brand-navy">{icon}</span>
      </div>
      <h3 className="font-extrabold text-surface-800 text-sm">{title}</h3>
      <p className="text-xs text-surface-600 leading-relaxed">{desc}</p>
    </div>
  );
}

function RecentRouteRow({ route, onClick }: {
  route: Route;
  onClick: () => void;
}) {
  const margin = marginForRoute(route);
  const updatedDate = new Date(route.updatedAt).toLocaleDateString('pt-BR');
  const isPositive = margin !== null && margin > 0;

  return (
    <button
      onClick={onClick}
      className="card-hover w-full text-left flex items-center gap-3 sm:gap-4 py-3 sm:py-4 group"
    >
      {/* Icon */}
      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-surface-200 flex items-center justify-center flex-shrink-0">
        <Map size={18} className="text-surface-600" />
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
