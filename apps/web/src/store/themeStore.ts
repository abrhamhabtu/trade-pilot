'use client';

import { create } from 'zustand';

type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const THEME_KEY = 'tradepilot_theme';

const getInitialTheme = (): Theme => {
  // Light mode is coming soon — always use dark theme for now
  if (typeof window !== 'undefined') {
    localStorage.setItem(THEME_KEY, 'dark');
  }
  return 'dark';
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getInitialTheme(),

  toggleTheme: () => {
    const newTheme = get().theme === 'dark' ? 'light' : 'dark';
    set({ theme: newTheme });
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_KEY, newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);
    }
  },

  setTheme: (theme: Theme) => {
    set({ theme });
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_KEY, theme);
      document.documentElement.setAttribute('data-theme', theme);
    }
  }
}));

// Initialize theme on load
if (typeof window !== 'undefined') {
  document.documentElement.setAttribute('data-theme', 'dark');
}

