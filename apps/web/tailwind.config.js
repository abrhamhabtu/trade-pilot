/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        // ─── TradePilot Surface System ────────────────────────────────────────
        // Change these values here to update the entire app's color palette.
        // All components reference these semantic tokens.
        tp: {
          base:    '#0D1628',  // Root app background
          panel:   '#111F35',  // Sidebar, drawers, overlays
          card:    '#172035',  // Cards, list items
          raised:  '#1C2A42',  // Elevated cards, modals, dropdowns
          border:  '#1E2F4A',  // Default borders (also use border-white/[0.07])
          green:   '#00D68F',  // Wins, bullish, CTA
          red:     '#FF4868',  // Losses, bearish
          blue:    '#4F9CF9',  // Accents, highlights, links
          yellow:  '#FFB800',  // Warnings, neutral bias
        },
      },
    }
  },
  plugins: []
};
