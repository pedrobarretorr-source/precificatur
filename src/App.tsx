import { useState, lazy, Suspense } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import type { Route } from '@/types';

const DashboardPage  = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const CalculatorPage = lazy(() => import('@/pages/CalculatorPage').then(m => ({ default: m.CalculatorPage })));
const RoutesPage     = lazy(() => import('@/pages/RoutesPage').then(m => ({ default: m.RoutesPage })));
const AiAssistantPage = lazy(() => import('@/pages/AiAssistantPage').then(m => ({ default: m.AiAssistantPage })));
const LoginPage      = lazy(() => import('@/pages/LoginPage').then(m => ({ default: m.LoginPage })));
const AdminPage      = lazy(() => import('@/pages/AdminPage').then(m => ({ default: m.AdminPage })));

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <div className="text-5xl mb-4">🚧</div>
        <h2 className="text-xl font-bold text-surface-700 mb-2">{title}</h2>
        <p className="text-sm text-surface-400">Módulo em desenvolvimento — Fase 2</p>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');
  const [calculatorRoute, setCalculatorRoute] = useState<Route | undefined>(undefined);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function navigateTo(page: string, route?: Route) {
    if (page === 'calculator') {
      setCalculatorRoute(route);
    }
    setActivePage(page);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-100">
        <div className="text-surface-400 text-sm">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-surface-100"><div className="text-surface-400 text-sm">Carregando...</div></div>}>
        <LoginPage />
      </Suspense>
    );
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage onNavigate={navigateTo} />;
      case 'calculator':
        return <CalculatorPage key={calculatorRoute?.id ?? 'new'} initialRoute={calculatorRoute} />;
      case 'routes':
        return <RoutesPage onNavigate={navigateTo} />;
      case 'reports':
        return <PlaceholderPage title="Relatórios" />;
      case 'ai-assistant':
        return <AiAssistantPage />;
      case 'admin':
        // Return DashboardPage directly for non-admins — do NOT call setActivePage here
        // (state updates during render cause React warnings)
        if (!profile?.is_admin) {
          return <DashboardPage onNavigate={setActivePage} />;
        }
        return <AdminPage />;
      default:
        return <DashboardPage onNavigate={setActivePage} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-surface-100">
      <Sidebar
        activePage={activePage}
        onNavigate={navigateTo}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Mobile header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 gradient-brand flex items-center justify-between px-4">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 -ml-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Menu size={24} />
        </button>
        <img src="/logo-precificatur.png" alt="PrecificaTur" className="h-7 object-contain" />
        <div className="w-8" />
      </header>

      <main className="flex-1 pt-[72px] md:pt-0 px-3 py-4 sm:px-6 sm:py-6 lg:p-8 max-w-6xl">
        <Suspense fallback={<div className="flex items-center justify-center h-64 text-surface-400 text-sm">Carregando...</div>}>
          {renderPage()}
        </Suspense>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
