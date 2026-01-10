import { create } from 'zustand';

type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const THEME_KEY = 'tradepilot_theme';

const getInitialTheme = (): Theme => {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch {}
  return 'dark'; // Default to dark theme
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getInitialTheme(),

  toggleTheme: () => {
    const newTheme = get().theme === 'dark' ? 'light' : 'dark';
    set({ theme: newTheme });
    localStorage.setItem(THEME_KEY, newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  },

  setTheme: (theme: Theme) => {
    set({ theme });
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.setAttribute('data-theme', theme);
  }
}));

// Initialize theme on load
if (typeof window !== 'undefined') {
  document.documentElement.setAttribute('data-theme', getInitialTheme());
}
