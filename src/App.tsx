import { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { DashboardPage } from '@/pages/DashboardPage';
import { CalculatorPage } from '@/pages/CalculatorPage';
import { AiAssistantPage } from '@/pages/AiAssistantPage';

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

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage onNavigate={setActivePage} />;
      case 'calculator':
        return <CalculatorPage />;
      case 'routes':
        return <PlaceholderPage title="Meus roteiros" />;
      case 'reports':
        return <PlaceholderPage title="Relatórios" />;
      case 'ai-assistant':
        return <AiAssistantPage />;
      default:
        return <DashboardPage onNavigate={setActivePage} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-surface-100">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <main className="flex-1 p-6 lg:p-8 max-w-6xl">
        {renderPage()}
      </main>
    </div>
  );
}
