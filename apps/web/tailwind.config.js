const path = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  // Anchored to this file, not the working directory. A relative glob resolves
  // against wherever the dev server was started; start it anywhere but apps/web
  // and Tailwind scans nothing, emits CSS with no utilities, and webpack caches
  // that empty sheet in .next — the app then loads unstyled until .next is
  // cleared. tests/tailwind-content.test.mjs guards this.
  content: [path.join(__dirname, 'src/**/*.{js,ts,jsx,tsx,mdx}')],
  theme: {
    extend: {
      // System type first: SF Pro on Apple hardware, Segoe/Roboto elsewhere.
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"', '"Segoe UI"', 'Roboto', 'system-ui', 'sans-serif'],
        rounded: ['ui-rounded', '"SF Pro Rounded"', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        mono: ['"SF Mono"', 'ui-monospace', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      // Softer, continuous-feeling corners across the whole app.
      borderRadius: {
        md: '8px',
        lg: '10px',
        xl: '14px',
        '2xl': '20px',
        '3xl': '28px',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      boxShadow: {
        lift: '0 1px 0 0 rgba(255,255,255,0.05) inset, 0 20px 40px -24px rgba(0,0,0,0.8)',
        sheet: '0 0 0 0.5px rgba(255,255,255,0.1), 0 30px 80px -20px rgba(0,0,0,0.85)',
      },
      colors: {
        // ─── TradePilot Surface System ────────────────────────────────────────
        // Change these values here to update the entire app's color palette.
        // All components reference these semantic tokens.
        // Every token reads a CSS variable, so a palette swap in globals.css
        // (html[data-palette]) recolours the whole app at once.
        tp: {
          base:    'rgb(var(--tp-base) / <alpha-value>)',    // Root app background
          panel:   'rgb(var(--tp-panel) / <alpha-value>)',   // Sidebar, drawers, overlays
          card:    'rgb(var(--tp-card) / <alpha-value>)',    // Cards, list items
          raised:  'rgb(var(--tp-raised) / <alpha-value>)',  // Elevated cards, modals, dropdowns
          border:  'rgb(var(--tp-border) / <alpha-value>)',  // Default borders (also use border-white/[0.07])
          green:   'rgb(var(--tp-green) / <alpha-value>)',   // Wins, bullish
          red:     'rgb(var(--tp-red) / <alpha-value>)',     // Losses, bearish
          blue:    'rgb(var(--tp-blue) / <alpha-value>)',    // Highlights, links
          yellow:  'rgb(var(--tp-yellow) / <alpha-value>)',  // Warnings, neutral bias
          accent:  'rgb(var(--tp-accent) / <alpha-value>)',  // Brand accent: active nav, primary buttons
          ink:     'rgb(var(--tp-ink) / <alpha-value>)',     // Text that sits on the accent
          orange:  '#FF9F0A',  // Medals, caution
          fill:    'rgba(120,128,150,0.16)', // Quiet control fills (search, chips, segmented tracks)
        },
      },
    }
  },
  plugins: []
};
