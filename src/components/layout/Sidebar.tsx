import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Calculator, LayoutDashboard, Map, FileText,
  ChevronLeft, ChevronRight, Bot, X, Shield
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const NAV_ITEMS = [
  { id: 'dashboard',    label: 'Dashboard',       icon: LayoutDashboard },
  { id: 'calculator',   label: 'Calculadora',      icon: Calculator },
  { id: 'routes',       label: 'Meus roteiros',    icon: Map },
  { id: 'reports',      label: 'Relatórios',       icon: FileText },
  { id: 'ai-assistant', label: 'Assistente de IA', icon: Bot },
];

const ADMIN_ITEM = { id: 'admin', label: 'Admin', icon: Shield };

function NavItems({
  activePage,
  onNavigate,
  showLabels,
  isAdmin,
}: {
  activePage: string;
  onNavigate: (page: string) => void;
  showLabels: boolean;
  isAdmin: boolean;
}) {
  const items = isAdmin ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS;

  return (
    <>
      {items.map(item => {
        const Icon = item.icon;
        const isActive = activePage === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold',
              'transition-all duration-200',
              isActive
                ? 'bg-white/15 text-white shadow-lg shadow-black/10'
                : 'text-white/70 hover:bg-white/8 hover:text-white'
            )}
          >
            <Icon size={20} className="flex-shrink-0" />
            {showLabels && <span className="animate-fade-in">{item.label}</span>}
          </button>
        );
      })}
    </>
  );
}

export function Sidebar({ activePage, onNavigate, mobileOpen = false, onCloseMobile }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { profile } = useAuth();
  const isAdmin = profile?.is_admin === true;

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  function handleNavigate(page: string) {
    onNavigate(page);
    onCloseMobile?.();
  }

  return (
    <>
      {/* ── Mobile drawer overlay ── */}
      <div
        className={cn(
          'fixed inset-0 z-50 md:hidden transition-opacity duration-300',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40"
          onClick={onCloseMobile}
        />

        {/* Drawer */}
        <aside
          className={cn(
            'absolute top-0 left-0 h-full w-[280px] flex flex-col gradient-brand text-white',
            'transition-transform duration-300 ease-out shadow-2xl',
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {/* Header with close button */}
          <div className="flex items-center justify-between px-4 h-14 border-b border-white/10">
            <img
              src="/logo-precificatur.png"
              alt="PrecificaTur"
              className="h-7 object-contain"
            />
            <button
              onClick={onCloseMobile}
              className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
            <NavItems activePage={activePage} onNavigate={handleNavigate} showLabels isAdmin={isAdmin} />
          </nav>
        </aside>
      </div>

      {/* ── Desktop sidebar ── */}
      <aside
        className={cn(
          'hidden md:flex h-screen sticky top-0 flex-col gradient-brand text-white transition-all duration-300',
          collapsed ? 'w-[72px]' : 'w-[260px]'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-center px-4 h-16 border-b border-white/10">
          {collapsed ? (
            <img
              src="/LOGO-MOB2.png"
              alt="PrecificaTur"
              className="h-9 w-9 object-contain"
            />
          ) : (
            <img
              src="/logo-precificatur.png"
              alt="PrecificaTur"
              className="h-9 object-contain animate-fade-in"
            />
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          <NavItems activePage={activePage} onNavigate={onNavigate} showLabels={!collapsed} isAdmin={isAdmin} />
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
    </>
  );
}
