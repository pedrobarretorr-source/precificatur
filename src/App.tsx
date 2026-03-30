import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import { DashboardPage } from '@/pages/DashboardPage';
import { CalculatorPage } from '@/pages/CalculatorPage';
import { RoutesPage } from '@/pages/RoutesPage';
import { AiAssistantPage } from '@/pages/AiAssistantPage';
import { AccessCodePage } from '@/pages/AccessCodePage';
import { AdminPage } from '@/pages/AdminPage';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-100">
        <div className="text-surface-400 text-sm">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <AccessCodePage />;
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage onNavigate={setActivePage} />;
      case 'calculator':
        return <CalculatorPage />;
      case 'routes':
        return <RoutesPage onNavigate={setActivePage} />;
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
        onNavigate={setActivePage}
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
        {renderPage()}
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
