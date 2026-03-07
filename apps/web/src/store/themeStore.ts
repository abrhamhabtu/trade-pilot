'use client';

import { create } from 'zustand';
import { persistence } from '@/lib/persistence';

type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const getInitialTheme = (): Theme => {
  const stored = persistence.loadTheme();
  const theme = stored === 'light' ? 'light' : 'dark';
  persistence.saveTheme(theme);
  return theme;
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getInitialTheme(),

  toggleTheme: () => {
    const newTheme = get().theme === 'dark' ? 'light' : 'dark';
    set({ theme: newTheme });
    if (typeof window !== 'undefined') {
      persistence.saveTheme(newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);
    }
  },

  setTheme: (theme: Theme) => {
    set({ theme });
    if (typeof window !== 'undefined') {
      persistence.saveTheme(theme);
      document.documentElement.setAttribute('data-theme', theme);
    }
  }
}));

// Initialize theme on load
if (typeof window !== 'undefined') {
  document.documentElement.setAttribute('data-theme', 'dark');
}
