import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/dashboard';
import { TradeLog } from './components/TradeLog';
import { Playbooks } from './components/Playbooks';
import { Calendar } from './components/Calendar';
import { Journal } from './components/journal';
import { ImportModal } from './components/ImportModal';
import { BuiltOnBoltBadge } from './components/BuiltOnBoltBadge';
import { useTradingStore } from './store/tradingStore';
import { useChartData } from './hooks/useChartData';

function App() {
  const {
    trades,
    metrics,
    sidebarCollapsed,
    refreshData,
    isLoading,
    currentView,
    selectedTimePeriod,
    setTimePeriod,
    getFilteredTrades
  } = useTradingStore();

  const [showImportModal, setShowImportModal] = useState(false);

  const displayTrades = getFilteredTrades();
  const { calendarData } = useChartData(displayTrades, metrics);

  const renderCurrentView = () => {
    switch (currentView) {
      case 'trades':
        return (
          <div className="p-6">
            <TradeLog trades={displayTrades} />
          </div>
        );

      case 'playbooks':
        return (
          <div className="p-6">
            <Playbooks />
          </div>
        );

      case 'calendar':
        return (
          <div className="p-6">
            <Calendar data={calendarData} />
          </div>
        );

      case 'journal':
        return (
          <div className="p-6">
            <Journal />
          </div>
        );

      default:
        return (
          <Dashboard
            trades={displayTrades}
            allTrades={trades}
            metrics={metrics}
            selectedTimePeriod={selectedTimePeriod}
            onTimePeriodChange={setTimePeriod}
            isLoading={isLoading}
            onRefresh={refreshData}
            onImport={() => setShowImportModal(true)}
          />
        );
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'linear-gradient(135deg, #0B0D10 0%, #0F1419 50%, #0B0D10 100%)'
      }}
    >
      <Sidebar />

      <main className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        {renderCurrentView()}
      </main>

      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />

      <BuiltOnBoltBadge />
    </div>
  );
}

export default App;
