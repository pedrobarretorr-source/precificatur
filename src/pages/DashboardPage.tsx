import { useMemo } from 'react';
import { Calculator, Map, TrendingUp, FileText, ArrowRight } from 'lucide-react';
import { useRoutes } from '@/hooks/useRoutes';
import { runSimulation, formatBRL, formatPercent } from '@/lib/pricing-engine';

interface DashboardPageProps {
  onNavigate: (page: string) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { routes, loading } = useRoutes();

  const stats = useMemo(() => {
    if (routes.length === 0) return { count: 0, avgPrice: null, avgMargin: null };
    const prices = routes.map(r => r.estimatedPrice).filter(p => p > 0);
    const margins = routes
      .map(r => {
        const sim = runSimulation(r.fixedCosts, r.variableCosts, r.estimatedPrice, 10);
        return sim.rows.length >= 10 ? sim.rows[9].margin : null;
      })
      .filter((m): m is number => m !== null && isFinite(m));
    return {
      count: routes.length,
      avgPrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
      avgMargin: margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : null,
    };
  }, [routes]);
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome header */}
      <div className="relative overflow-hidden rounded-3xl gradient-brand p-5 sm:p-8 text-white">
        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl font-extrabold mb-2">
            Quanto cobrar pelo seu<br />
            <span className="text-brand-orange-300">próximo roteiro?</span>
          </h1>
          <p className="text-white/70 max-w-lg text-sm leading-relaxed">
            Calcule o preço ideal em minutos, informe seus custos,
            defina sua margem e descubra exatamente quantos passageiros
            você precisa para fechar no lucro!
          </p>
          <button
            onClick={() => onNavigate('calculator')}
            className="mt-6 btn bg-brand-orange text-white px-6 py-3 rounded-xl
                       font-bold hover:bg-brand-orange-500 transition-all
                       flex items-center gap-2"
          >
            <Calculator size={18} />
            Calcular agora
            <ArrowRight size={16} />
          </button>
        </div>
        {/* Decorative circles */}
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/5" />
        <div className="absolute -right-8 top-8 w-48 h-48 rounded-full bg-white/5" />
        <div className="absolute right-24 -bottom-8 w-32 h-32 rounded-full bg-brand-orange/20" />
      </div>

      {/* Quick actions grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            icon: Calculator,
            title: 'Calculadora',
            desc: 'Precifique um roteiro',
            page: 'calculator',
            color: 'bg-brand-orange',
          },
          {
            icon: TrendingUp,
            title: 'Cenários',
            desc: 'Compare preços lado a lado',
            page: 'scenarios',
            color: 'bg-brand-navy',
          },
          {
            icon: Map,
            title: 'Meus roteiros',
            desc: 'Gerencie seus roteiros',
            page: 'routes',
            color: 'bg-brand-blue',
          },
          {
            icon: FileText,
            title: 'Relatórios',
            desc: 'Gere propostas em PDF',
            page: 'reports',
            color: 'bg-brand-tangerine',
          },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              className="card-hover text-left group animate-slide-up"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center mb-3
                               group-hover:scale-110 transition-transform`}>
                <Icon size={20} className="text-white" />
              </div>
              <h3 className="font-bold text-surface-800 mb-0.5">{item.title}</h3>
              <p className="text-sm text-surface-500">{item.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card text-center py-8">
          <p className="text-4xl font-extrabold text-brand-navy">
            {loading ? '…' : stats.count}
          </p>
          <p className="text-sm text-surface-500 mt-1">Roteiros criados</p>
        </div>
        <div className="card text-center py-8">
          <p className="text-4xl font-extrabold text-brand-orange">
            {loading ? '…' : stats.avgPrice !== null ? formatBRL(stats.avgPrice) : '—'}
          </p>
          <p className="text-sm text-surface-500 mt-1">Preço médio por pax</p>
        </div>
        <div className="card text-center py-8">
          <p className="text-4xl font-extrabold text-emerald-600">
            {loading ? '…' : stats.avgMargin !== null ? formatPercent(stats.avgMargin) : '—'}
          </p>
          <p className="text-sm text-surface-500 mt-1">Margem média</p>
        </div>
      </div>
    </div>
  );
}
