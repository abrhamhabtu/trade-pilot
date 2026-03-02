# TradePilot — Architecture Overview

> A reference guide for contributors and developers. Covers how the app is structured, how data flows, and where things live.

---

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [State Management (Zustand)](#4-state-management-zustand)
5. [Data Persistence (localStorage)](#5-data-persistence-localstorage)
6. [Data Flow — CSV Import](#6-data-flow--csv-import)
7. [App Startup Sequence](#7-app-startup-sequence)
8. [Routing & Rendering](#8-routing--rendering)
9. [Component Map](#9-component-map)
10. [Storage Limits & Backup](#10-storage-limits--backup)
11. [Privacy & Security](#11-privacy--security)
12. [Deployment](#12-deployment)

---

## 1. High-Level Overview

TradePilot is a **fully local, browser-based** trading journal. There is no backend, no database, and no cloud sync. All data lives in the user's browser.

```
┌──────────────────────────────────────────────────────────────┐
│                        BROWSER ONLY                          │
│                                                              │
│   CSV / Manual  ──▶  Parser  ──▶  Zustand Store             │
│                                        │                     │
│                                        ▼                     │
│                                  localStorage                │
│                              (survives page reload)          │
│                                        │                     │
│                                        ▼                     │
│                              React UI (Next.js)              │
└──────────────────────────────────────────────────────────────┘
         ✗ No server  ✗ No cloud  ✗ No account required
```

**Key properties:**
- Data never leaves the user's machine
- Works offline after initial load
- ~5–10 MB storage capacity via localStorage (IndexedDB upgrade planned)

---

## 2. Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | **Next.js 14** (App Router) | Routing, rendering, build system |
| Language | **TypeScript** | Type safety across the entire codebase |
| Styling | **Tailwind CSS** | Utility-first styling, dark mode via `class` strategy |
| State | **Zustand** | In-memory app state — accounts, trades, UI |
| Persistence | **localStorage** | Survives page reload; serialized JSON |
| CSV Parsing | **PapaParse** | Parses broker export files in the browser |
| Charts | **Recharts** | All dashboard data visualizations |
| Icons | **Lucide React** | Icon library |

---

## 3. Project Structure

```
trade-pilot-nextjs/
├── apps/
│   └── web/                          # The Next.js web app
│       ├── src/
│       │   ├── app/                  # Next.js App Router
│       │   │   ├── layout.tsx        # Root layout (fonts, metadata, global CSS)
│       │   │   ├── page.tsx          # Route "/" — mounts <AppClient>
│       │   │   ├── AppClient.tsx     # Client shell — view routing & state
│       │   │   ├── RootShell.tsx     # Sidebar + main content layout
│       │   │   └── globals.css       # CSS variables (navy dark theme)
│       │   │
│       │   ├── components/           # All UI components (see §9)
│       │   ├── store/                # Zustand stores (see §4)
│       │   ├── hooks/                # Custom React hooks
│       │   └── utils/                # CSV parsers, calculations
│       │
│       ├── tailwind.config.js        # Tailwind config (darkMode: 'class')
│       └── package.json
│
├── Dockerfile                        # Docker image build
├── docker-compose.yml                # One-command local deployment
└── ARCHITECTURE.md                   # This file
```

---

## 4. State Management (Zustand)

Zustand is a lightweight React state management library. The app uses **6 separate stores**, each responsible for one domain.

### Store Map

| Store | File | Holds |
|-------|------|-------|
| `accountStore` | `store/accountStore.ts` | Accounts, trades, import history |
| `tradingStore` | `store/tradingStore.ts` | Time period filter, current view, UI flags |
| `themeStore` | `store/themeStore.ts` | Dark/light mode preference |
| `routineStore` | `store/routineStore.ts` | Trading rules, routine check-ins |
| `dailyNotesStore` | `store/dailyNotesStore.ts` | Journal entries |
| `toastStore` | `store/toastStore.ts` | Toast notification queue |
| `uiStore` | `store/uiStore.ts` | General UI state |

### How Zustand Works

```
┌─────────────────────────────────────────────────────────┐
│                      React Component                    │
│                                                         │
│   const { accounts } = useAccountStore();               │
│       │                                                 │
│       └──▶ reads from Zustand (in-memory, reactive)     │
│                                                         │
│   addTrade(newTrade)                                    │
│       │                                                 │
│       └──▶ updates Zustand store                        │
│               │                                         │
│               ├──▶ all subscribed components re-render  │
│               └──▶ middleware saves to localStorage     │
└─────────────────────────────────────────────────────────┘
```

> **Note:** Zustand data only lives while the tab is open. When the tab closes, Zustand is gone. localStorage is what keeps data alive between sessions.

---

## 5. Data Persistence (localStorage)

### localStorage Keys

| Key | Contents |
|-----|---------|
| `tradepilot_accounts` | All accounts, trades, balances, import history |
| `tradepilot_settings` | Import flags, last import time |
| `tradepilot_selected` | Currently selected account ID |
| `tradepilot_theme` | `"dark"` (light mode coming soon) |
| `tradepilot_rules` | User-defined trading rules |
| `tradepilot_daily_notes` | Journal entries |

### Data Lifecycle

```
App Closed:          App Open:                    Data Changes:
                     localStorage
                          │                       Zustand
                          ▼                          │
                       Zustand  ◀────────────────────┤
                          │                          │
                          ▼                          ▼
                       React UI              localStorage sync
                                            (middleware auto-saves)
```

### How to Inspect in Browser

1. Open DevTools (`F12`)
2. Go to **Application → Local Storage → localhost:3001**
3. Find `tradepilot_accounts` — this is your entire dataset as JSON

---

## 6. Data Flow — CSV Import

### Step-by-Step

```
1. User drops CSV file into ImportModal
            │
            ▼
2. PapaParse reads file in browser (no upload)
   → Produces: array of raw row objects
            │
            ▼
3. Format detection (which broker?)
   ContractName, EnteredAt, PnL  → ProjectX / Topstep
   Time, Action, Realized P&L    → TradingView
   Date, Symbol, Side, Qty, P&L  → Tradovate
   Instrument, Entry, Profit      → NinjaTrader
            │
            ▼
4. Normalization — maps broker fields → Trade type
   { id, date, symbol, side, netPL, outcome, ... }
            │
            ▼
5. accountStore.addTradesToAccount(accountId, trades)
            │
            ▼
6. Zustand store updated → React re-renders
            │
            ▼
7. localStorage auto-saved (persist middleware)
```

### Trade Object Shape

```typescript
interface Trade {
  id: string;          // UUID
  date: string;        // ISO date string
  symbol: string;      // e.g. "MES", "NQ"
  side: 'Long' | 'Short';
  quantity: number;
  netPL: number;       // profit/loss in USD
  outcome: 'win' | 'loss' | 'breakeven';
  broker?: string;
}
```

---

## 7. App Startup Sequence

```
Browser opens localhost:3001
         │
         ▼
Next.js serves HTML shell (server render)
         │
         ▼
AppClient.tsx hydrates ("use client")
         │
         ▼
accountStore initializes
         │
         ├── localStorage has data? ──▶ Load saved accounts & trades
         │                                       │
         └── No data? ──▶ Create demo account    │
                          with sample trades     │
                                                 ▼
                               Zustand stores initialized
                                                 │
                                                 ▼
                               React components render dashboard
```

---

## 8. Routing & Rendering

TradePilot uses **Next.js App Router** but renders everything client-side because the app depends on browser-only APIs (`localStorage`, Zustand).

```
page.tsx              ← Server Component (thin shell only)
  └── <AppClient>     ← "use client" — all logic lives here
        └── <RootShell>
              ├── <Sidebar>         ← Navigation
              └── {currentView}     ← Switched by tradingStore
                    ├── <Dashboard>
                    ├── <TradeLog>
                    ├── <Calendar>
                    ├── <Journal>
                    ├── <Playbooks>
                    ├── <RoutinePage>
                    ├── <JourneyPage>
                    └── <AccountsPage>
```

### View Switching

`currentView` in `tradingStore` controls which panel is rendered. The sidebar calls `setCurrentView(viewName)` — no URL changes, no page reloads.

---

## 9. Component Map

### Dashboard

| Component | File | Role |
|-----------|------|------|
| `Dashboard` | `dashboard/Dashboard.tsx` | Top-level dashboard container |
| `DashboardHeader` | `dashboard/DashboardHeader.tsx` | Time filter, import button |
| `MetricsGrid` | `dashboard/MetricsGrid.tsx` | Six KPI cards (Net P&L, Win %, etc.) |
| `ChartsContainer` | `dashboard/ChartsContainer.tsx` | Lays out all chart panels |
| `CoachingTipCard` | `dashboard/CoachingTipCard.tsx` | AI coaching tip strip |

### Charts

| Component | File | Role |
|-----------|------|------|
| `BarChart` | `charts/BarChart.tsx` | Net daily P&L bar chart |
| `PLChart` | `charts/PLChart.tsx` | Cumulative P&L area chart |
| `RadarChart` | `charts/RadarChart.tsx` | Trading score radar |
| `ProgressTracker` | `charts/ProgressTracker.tsx` | Consistency heatmap (GitHub-style) |
| `TimePerformanceChart` | `charts/TimePerformanceChart.tsx` | P&L by time of day |
| `DurationPerformanceChart` | `charts/DurationPerformanceChart.tsx` | P&L by trade duration |
| `ScatterChart` | `charts/ScatterChart.tsx` | Risk/reward scatter plot |

### Core UI

| Component | File | Role |
|-----------|------|------|
| `Sidebar` | `Sidebar.tsx` | Navigation + collapse + theme toggle |
| `TradesTable` | `TradesTable.tsx` | Compact recent trades table |
| `TradeLog` | `TradeLog.tsx` | Full trade log with filters |
| `MetricCard` | `MetricCard.tsx` | Single KPI card |
| `ImportModal` | `ImportModal.tsx` | CSV drop zone + parse UI |
| `Calendar` | `Calendar.tsx` | Monthly trade calendar |
| `Playbooks` | `Playbooks.tsx` | Strategy playbook browser |
| `Journal` | `journal/Journal.tsx` | Daily trading journal |

### Routine / Journey

| Component | File | Role |
|-----------|------|------|
| `RoutinePage` | `routine/RoutinePage.tsx` | Pre/post-market checklist |
| `JourneyPage` | `routine/JourneyPage.tsx` | Long-term goal tracker |
| `ConsistencyGuardian` | `routine/ConsistencyGuardian.tsx` | Streak & discipline metrics |

---

## 10. Storage Limits & Backup

| Storage | Limit | Notes |
|---------|-------|-------|
| localStorage | ~5–10 MB | Per browser; shared across all keys |
| Single key | ~5 MB | `tradepilot_accounts` can hold ~10,000 trades |
| IndexedDB (planned) | 50 MB+ | Will support 100,000+ trades |

### Built-in Backup (Recommended)

1. Go to **Accounts → Data Management**
2. Click **Export Backup** → saves `tradepilot_backup_YYYY-MM-DD.json`
3. To restore: click **Restore from Backup** and select your file

### Manual Backup via Console

```javascript
// Export — copies data to clipboard
copy(localStorage.getItem('tradepilot_accounts'));

// Import — paste your backup JSON
localStorage.setItem('tradepilot_accounts', '<paste JSON here>');
location.reload();
```

> ⚠️ Clearing browser data (cache, cookies, site data) **will delete your trades**. Export regularly.

---

## 11. Privacy & Security

| Question | Answer |
|----------|--------|
| Does data go to a server? | **No.** 100% local — no outbound requests. |
| Can TradePilot see my trades? | **No.** No backend, no analytics, no telemetry. |
| Is data encrypted? | **No.** localStorage is plain text. Avoid shared computers. |
| What if I clear browser data? | **Trades deleted.** Export backups regularly. |
| Can I self-host? | **Yes.** Docker or Node.js — see Deployment below. |

---

## 12. Deployment

### Docker (Recommended)

```bash
docker-compose up -d
# → http://localhost:3001
```

No Node.js required. Runs as a containerized Next.js server.

### Development Mode

```bash
npm run install:web
npm run dev
# → http://localhost:3001
```

Requires Node.js 20+. Enables hot reload.

### Production Build

```bash
npm run build
npm run start
# → http://localhost:3001
```

Optimized Next.js production build, served locally.

---

*Last updated: March 2026 · Branch: `ui`*
