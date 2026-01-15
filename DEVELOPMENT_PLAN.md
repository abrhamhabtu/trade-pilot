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
- [ ] **Export to CSV** — Let users export trades back to familiar CSV format
- [ ] **Auto-backup reminder** — Prompt if no backup in 7+ days with new trades

### 1.5 Easy Deployment
- [x] **Docker support** — Run with `docker-compose up` (no Node.js needed)
- [ ] **One-click installer** — Desktop app wrapper (Electron or Tauri)

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

## Future (Hosted/Enterprise)

*Reserved for the hosted version with paid features.*

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
