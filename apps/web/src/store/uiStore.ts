'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type AppView =
  | 'dashboard'
  | 'accounts'
  | 'journey'
  | 'routine'
  | 'calendar'
  | 'trades'
  | 'playbooks'
  | 'journal';

interface UIState {
  sidebarCollapsed: boolean;
  currentView: AppView;
  toggleSidebar: () => void;
  setCurrentView: (view: AppView) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      currentView: 'dashboard',
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setCurrentView: (view) => set({ currentView: view })
    }),
    {
      name: 'tradepilot_ui',
      storage: createJSONStorage(() => localStorage)
    }
  )
);
