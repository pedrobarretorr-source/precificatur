import { Calculator, Map, TrendingUp, FileText, ArrowRight } from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (page: string) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome header */}
      <div className="relative overflow-hidden rounded-3xl gradient-brand p-5 sm:p-8 text-white">
        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl font-extrabold mb-2">
            Bem-vindo ao Precifica<span className="text-brand-orange-300">Tur</span>
          </h1>
          <p className="text-white/70 max-w-lg text-sm leading-relaxed">
            Precifique seus roteiros turísticos com precisão, simule cenários
            e descubra o ponto de equilíbrio ideal para cada operação.
          </p>
          <button
            onClick={() => onNavigate('calculator')}
            className="mt-6 btn bg-brand-orange text-white px-6 py-3 rounded-xl
                       font-bold hover:bg-brand-orange-500 transition-all
                       flex items-center gap-2"
          >
            <Calculator size={18} />
            Nova precificação
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

      {/* Stats placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card text-center py-8">
          <p className="text-4xl font-extrabold text-brand-navy">0</p>
          <p className="text-sm text-surface-500 mt-1">Roteiros criados</p>
        </div>
        <div className="card text-center py-8">
          <p className="text-4xl font-extrabold text-brand-orange">—</p>
          <p className="text-sm text-surface-500 mt-1">Preço médio por pax</p>
        </div>
        <div className="card text-center py-8">
          <p className="text-4xl font-extrabold text-emerald-600">—</p>
          <p className="text-sm text-surface-500 mt-1">Margem média</p>
        </div>
      </div>
    </div>
  );
}
