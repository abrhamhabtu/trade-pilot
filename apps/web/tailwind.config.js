/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        // ─── TradePilot Surface System — "Anthropic warm" edition ───────────
        // Warm charcoal surfaces + terracotta brand accent (Claude vibe),
        // with green/red reserved strictly for P&L semantics.
        // Change these values here to update the entire app's palette.
        tp: {
          base:    '#1B1A17',  // Root app background — warm near-black
          panel:   '#201F1B',  // Sidebar, drawers, overlays
          card:    '#262420',  // Cards, list items
          raised:  '#2E2B25',  // Elevated cards, modals, dropdowns
          border:  '#3A362C',  // Default borders (also use border-white/[0.07])
          accent:  '#D97757',  // Brand terracotta — identity, nav, focus
          green:   '#30B886',  // Wins, bullish — warm emerald
          red:     '#E5564F',  // Losses, bearish — warm coral red
          blue:    '#6E9BD1',  // Info, links — muted denim
          yellow:  '#D9A03F',  // Warnings — warm amber
        },
      },
      fontFamily: {
        sans: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
    }
  },
  plugins: []
};
