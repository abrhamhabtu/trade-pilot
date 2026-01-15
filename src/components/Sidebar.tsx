import React from 'react';
import {
  BarChart3,
  Calendar,
  TrendingUp,
  BookOpen,
  Search,
  Menu,
  Activity,
  Target,
  Sun,
  Moon,
  Users,
  ClipboardCheck,
  Compass
} from 'lucide-react';
import { useTradingStore } from '../store/tradingStore';
import { useThemeStore } from '../store/themeStore';
import clsx from 'clsx';

const navigation = [
  { name: 'Dashboard', icon: BarChart3, view: 'dashboard' as const },
  { name: 'Accounts', icon: Users, view: 'accounts' as const },
  { name: 'Journey', icon: Compass, view: 'journey' as const },
  { name: 'Routine', icon: ClipboardCheck, view: 'routine' as const },
  { name: 'Calendar', icon: Calendar, view: 'calendar' as const },
  { name: 'Trades', icon: TrendingUp, view: 'trades' as const },
  { name: 'Playbooks', icon: Target, view: 'playbooks' as const },
  { name: 'Journal', icon: BookOpen, view: 'journal' as const },
];

export const Sidebar: React.FC = () => {
  const { sidebarCollapsed, toggleSidebar, currentView, setCurrentView } = useTradingStore();
  const { theme, toggleTheme } = useThemeStore();

  return (
    <div 
      className={clsx(
        'fixed left-0 top-0 h-full bg-gradient-to-b from-[#111111] via-[#0F1419] to-[#111111] border-r border-[#1F2937] transition-all duration-300 z-50 flex flex-col',
        sidebarCollapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Header */}
      <div className={clsx(
        'flex items-center border-b border-[#1F2937] transition-all duration-300 flex-shrink-0',
        sidebarCollapsed ? 'justify-center p-4' : 'justify-between p-4'
      )}>
        {!sidebarCollapsed && (
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded bg-gradient-to-r from-[#3BF68A] to-[#A78BFA] flex items-center justify-center">
              <Activity className="h-4 w-4 text-black" />
            </div>
            <span className="text-[#E5E7EB] font-semibold text-lg bg-gradient-to-r from-[#3BF68A] to-[#A78BFA] bg-clip-text text-transparent">
              TradePilot
            </span>
          </div>
        )}
        
        {sidebarCollapsed && (
          <div className="w-8 h-8 rounded bg-gradient-to-r from-[#3BF68A] to-[#A78BFA] flex items-center justify-center">
            <Activity className="h-5 w-5 text-black" />
          </div>
        )}
        
        <button
          onClick={toggleSidebar}
          className={clsx(
            'text-[#94A3B8] hover:text-[#E5E7EB] transition-colors rounded hover:bg-gradient-to-r hover:from-[#3BF68A]/10 hover:to-[#A78BFA]/10',
            sidebarCollapsed ? 'p-2 mt-4' : 'p-1'
          )}
        >
          <Menu className={clsx(sidebarCollapsed ? 'h-6 w-6' : 'h-5 w-5')} />
        </button>
      </div>

      {/* Search */}
      {!sidebarCollapsed && (
        <div className="p-4 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#8B94A7]" />
            <input
              type="text"
              placeholder="Search"
              className="w-full bg-[#15181F] border border-[#1F2937] rounded-lg pl-10 pr-4 py-2 text-[#E5E7EB] placeholder-[#8B94A7] focus:outline-none focus:border-transparent focus:ring-2 focus:ring-gradient-to-r focus:from-[#3BF68A] focus:to-[#A78BFA] transition-all"
              style={{
                background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
              }}
            />
          </div>
        </div>
      )}

      {/* Navigation - This will grow to fill available space */}
      <nav className={clsx(
        'flex-1 transition-all duration-300 overflow-y-auto',
        sidebarCollapsed ? 'px-2 py-4 space-y-2' : 'px-4 py-2 space-y-1'
      )}>
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.view;
          
          return (
            <button
              key={item.name}
              onClick={() => setCurrentView(item.view)}
              className={clsx(
                'w-full flex items-center text-sm font-medium rounded-lg transition-all duration-200 group relative',
                sidebarCollapsed 
                  ? 'justify-center p-4 mb-3' 
                  : 'px-3 py-2',
                isActive
                  ? 'bg-gradient-to-r from-[#3BF68A]/20 to-[#A78BFA]/20 text-[#3BF68A]'
                  : 'text-[#94A3B8] hover:text-[#E5E7EB] hover:bg-gradient-to-r hover:from-[#3BF68A]/10 hover:to-[#A78BFA]/10'
              )}
              style={isActive ? {
                borderLeft: sidebarCollapsed ? 'none' : '2px solid',
                borderImage: sidebarCollapsed ? 'none' : 'linear-gradient(to bottom, #3BF68A, #A78BFA) 1',
                boxShadow: sidebarCollapsed && isActive ? '0 0 0 2px rgba(59, 246, 138, 0.3)' : 'none'
              } : {}}
            >
              <Icon className={clsx(
                sidebarCollapsed ? 'h-7 w-7' : 'h-5 w-5',
                sidebarCollapsed ? 'mx-auto' : 'mr-3'
              )} />
              {!sidebarCollapsed && (
                <span className="truncate">{item.name}</span>
              )}
              
              {/* Enhanced Tooltip for collapsed state */}
              {sidebarCollapsed && (
                <div className="absolute left-full ml-4 px-3 py-2 bg-gradient-to-r from-[#15181F] to-[#1A1D25] text-[#E5E7EB] text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap z-50 border border-[#3BF68A]/30 shadow-lg backdrop-blur-sm">
                  {item.name}
                  <div className="absolute right-full top-1/2 transform -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-[#15181F]"></div>
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer - Theme toggle and version */}
      <div className={clsx(
        'border-t border-[#1F2937] transition-all duration-300 flex-shrink-0',
        sidebarCollapsed ? 'p-3' : 'p-4'
      )}>
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className={clsx(
            'w-full flex items-center justify-center mb-3 rounded-lg transition-all duration-200 group relative',
            sidebarCollapsed ? 'p-3' : 'px-3 py-2',
            'text-[#94A3B8] hover:text-[#E5E7EB] hover:bg-gradient-to-r hover:from-[#3BF68A]/10 hover:to-[#A78BFA]/10'
          )}
        >
          {theme === 'dark' ? (
            <>
              <Sun className={clsx(sidebarCollapsed ? 'h-6 w-6' : 'h-5 w-5')} />
              {!sidebarCollapsed && <span className="ml-3 text-sm">Light Mode</span>}
            </>
          ) : (
            <>
              <Moon className={clsx(sidebarCollapsed ? 'h-6 w-6' : 'h-5 w-5')} />
              {!sidebarCollapsed && <span className="ml-3 text-sm">Dark Mode</span>}
            </>
          )}

          {/* Tooltip for collapsed state */}
          {sidebarCollapsed && (
            <div className="absolute left-full ml-4 px-3 py-2 bg-gradient-to-r from-[#15181F] to-[#1A1D25] text-[#E5E7EB] text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap z-50 border border-[#3BF68A]/30 shadow-lg">
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </div>
          )}
        </button>

        {/* Version */}
        {!sidebarCollapsed ? (
          <div className="text-xs text-[#8B94A7] text-center">
            <span className="bg-gradient-to-r from-[#3BF68A] to-[#A78BFA] bg-clip-text text-transparent font-medium">
              TradePilot v1.0
            </span>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-2 h-2 rounded-full bg-gradient-to-r from-[#3BF68A] to-[#A78BFA]"></div>
          </div>
        )}
      </div>
    </div>
  );
};