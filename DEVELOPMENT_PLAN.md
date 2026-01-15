# TradePilot Development Plan

> Focused roadmap for launching a polished, functional trading journal.

---

## What's Done ✅

- [x] Multi-account support for prop firms
- [x] CSV import (ProjectX, TradingView, Tradovate, NinjaTrader)
- [x] Dashboard with core metrics (P&L, win rate, profit factor, etc.)
- [x] Calendar view with daily P&L
- [x] Journey page with profit target visualization
- [x] localStorage persistence
- [x] Toast notifications
- [x] Dark/light theme toggle
- [x] Enterprise Edition structure (`/ee` folder)

---

## Phase 1: Launch Ready (Current Focus)

### 1.1 Fix Broken/Incomplete Features
- [ ] Make sidebar search functional
- [ ] Implement "Date Range" filter
- [ ] Implement "More Filters" dropdown
- [ ] Complete Journal view (currently placeholder)

### 1.2 Polish & Performance
- [ ] Add React.memo() to chart components
- [ ] Add confirmation dialogs for destructive actions (delete trades)
- [ ] Improve mobile responsiveness
- [ ] Add empty state illustrations

### 1.3 Error Handling
- [ ] Add React Error Boundaries
- [ ] Improve CSV import error messages
- [ ] Validate corrupted/malformed trade data

### 1.4 Data Backup & Safety
- [x] **One-click Export** — Download all data as JSON file
- [x] **Import from Backup** — Drag-and-drop restore from backup file
- [x] **Storage usage indicator** — Show how much space is used
- [x] **Export to CSV** — Let users export trades back to familiar CSV format
- [x] **Auto-backup reminder** — Prompt if no backup in 7+ days with new trades

### 1.5 Easy Deployment
- [x] **Docker support** — Run with `docker-compose up` (no Node.js needed)
- [ ] **One-click installer** — Desktop app wrapper (Electron or Tauri)

### 1.6 Storage Upgrade (On Standby)
- [ ] **Migrate screenshots to IndexedDB** — Move from localStorage (5MB) to IndexedDB (50MB+)
  - Utility already created: `src/utils/indexedDB.ts`
  - Requires updating `src/store/dailyNotesStore.ts` to use IndexedDB for images
  - Keep accounts/settings in localStorage for simplicity
  - Update storage display to show new capacity
  - **Note:** Current 5MB is fine for most users who don't upload many screenshots. For heavy screenshot users, TradePilot Cloud (coming soon) will offer more storage with sync across devices.

---

## Phase 2: Enhanced Features

### 2.1 Journal Improvements
- [ ] Rich text editor for journal entries
- [ ] Trade tagging system
- [ ] Screenshot attachment (local blob storage)

### 2.2 Analytics Additions
- [ ] Drawdown analysis with recovery tracking
- [ ] Position sizing calculator

### 2.3 UX Improvements
- [ ] Keyboard shortcuts (Cmd+I for import)
- [ ] Chart export (PNG/SVG)

### 2.4 Storage Upgrade
- [ ] **Migrate to IndexedDB** — Increase storage from 5MB to 50MB+ (100,000+ trades)
- [ ] **Storage usage indicator** — Show how much space is used in Settings

---

## Phase 3: Marketing & Landing Page

### 3.1 Branding & Name Research
- [ ] **Research product name** — "TradePilot" already exists, need unique name
  - Check trademark availability
  - Check domain availability (.com, .io, .app)
  
  **❌ TAKEN names (do not use):**
  - TradeLog (tradelog.com - tax software)
  - TradeVault (tradevault.app - journal competitor)
  - TradeDeck (The Trade Desk - advertising)
  - TradeForge (tradeforge.app - social trading)
  - TradeNest (tradesnest.com - B2B platform)
  - TradeLab (tradelab.org - legal org)
  - PropEdge (propedgetrading.com - DOM trading)
  - TradeStack (Keysight software)
  - TradeHawk (Tradier platform)
  - TradeCompass (Deloitte tool)
  - Edgewonk (edgewonk.com - journal competitor)
  
  **✅ POTENTIALLY AVAILABLE (needs domain check):**
  - TickerLog / TickLog
  - ContractBook / ContractLog (futures-focused)
  - PropBook / PropLog
  - FuturesBook / FuturesLog  
  - DayLedger / TradeLedger
  - PilotLog (flight metaphor)
  - TradeAtlas / AtlasTrade
  - TradeCanvas
  - EdgeBook / EdgeLog

### 3.2 Journaling Features Inspiration
- [ ] **Enhance journaling based on best practices**
  - Reference: [Metrinote Trading Journal Guide](https://www.metrinote.com/blog/trading-journal-guide)
  - Key features to consider adding:
    - Pre-trade planning templates
    - Post-trade review prompts
    - Emotion/psychology tracking
    - Setup/pattern tagging
    - Trade replay/review workflow

### 3.3 Landing Page
- [ ] **Create marketing landing page** — Showcase product features
  - Design inspiration:
    - [Tradezilla](https://tradezilla.com)
    - [SuperTrader](https://www.supertrader.me)
    - [Edgewonk](https://edgewonk.com/)
    - [Metrinote](https://www.metrinote.com/#features)
  - Hero section with product screenshots
  - Feature highlights with icons
  - Pricing comparison (Free vs Cloud)
  - Testimonials section
  - CTA buttons for download/signup

---

## Future (Hosted/Enterprise)

**Business Model:** Open source is our competitive edge — free, transparent, and community-driven. Cloud version is optional and pays for development time & server resources (not a paywall for core features).

**Why we win:**
- Competitors (Tradezilla, Edgewonk, TraderSync, etc.) charge $20-50+/month
- We're **free and open source** — no subscriptions, no vendor lock-in
- Simple CSV import from TradingView, Tradovate, NinjaTrader, ProjectX works great for most traders
- API connections are nice-to-have, not essential — keep it simple for now
- Future: Could add broker APIs later (Tradovate has a REST API, others too) but not a priority

| Feature | Core (Free) | Enterprise (Paid) |
|---------|-------------|-------------------|
| Local trade import | ✅ | - |
| Multi-account support | ✅ | - |
| Calendar & charts | ✅ | - |
| Playbooks & journal | ✅ | - |
| Cloud sync | - | 💰 |
| Team/firm accounts | - | 💰 |
| Broker API connections | - | 💰 |
| AI pattern detection | - | 💰 |

---

## Code Standards

- TypeScript strict mode (no `any` without justification)
- Conventional commits: `feat:`, `fix:`, `refactor:`
- React.memo for expensive renders

---

*Last Updated: January 2026*
*Version: 0.9.0 (Pre-release)*
