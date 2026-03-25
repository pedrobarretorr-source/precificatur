import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Calculator, LayoutDashboard, Map, FileText,
  ChevronLeft, ChevronRight, Bot
} from 'lucide-react';

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'calculator', label: 'Calculadora', icon: Calculator },
  { id: 'routes', label: 'Meus roteiros', icon: Map },
  { id: 'reports', label: 'Relatórios', icon: FileText },
  { id: 'ai-assistant', label: 'Assistente de IA', icon: Bot },
];

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'h-screen sticky top-0 flex flex-col gradient-brand text-white transition-all duration-300',
        collapsed ? 'w-[72px]' : 'w-[260px]'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-white/10">
        <div className="w-9 h-9 rounded-xl bg-brand-orange flex items-center justify-center flex-shrink-0">
          <span className="text-white font-extrabold text-sm">P</span>
        </div>
        {!collapsed && (
          <div className="animate-fade-in">
            <span className="font-extrabold text-lg tracking-tight">
              Precifica<span className="text-brand-orange-300">Tur</span>
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold',
                'transition-all duration-200',
                isActive
                  ? 'bg-white/15 text-white shadow-lg shadow-black/10'
                  : 'text-white/70 hover:bg-white/8 hover:text-white'
              )}
            >
              <Icon size={20} className="flex-shrink-0" />
              {!collapsed && <span className="animate-fade-in">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="px-3 pb-4">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl
                     text-white/50 hover:text-white hover:bg-white/8 transition-all text-xs"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!collapsed && <span>Recolher</span>}
        </button>
      </div>
    </aside>
  );
}
