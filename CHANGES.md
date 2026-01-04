# TradePilot Changes Log

> **For new developers**: This file explains what changes were made and *why*. Each section is kept simple. As we add more features, this file will grow.

---

## Phase 1: Code Quality & Features (January 2026)

### What We Did

#### 1. Split Up the Big App.tsx File
**Before:** One 650-line file doing everything
**After:** 102 lines - just handles routing between views

**Why?** Smaller files are:
- Easier to read and understand
- Easier to debug when something breaks
- Easier for multiple people to work on

**The pattern we used:** Extract related code into its own component.

```jsx
// BEFORE (everything in App.tsx)
function App() {
  // 200 lines of chart calculations...
  // 100 lines of coaching tip logic...
  // 300 lines of dashboard JSX...
  return <div>...</div>
}

// AFTER (App.tsx just routes to views)
function App() {
  switch (currentView) {
    case 'dashboard': return <Dashboard />
    case 'trades': return <TradeLog />
    case 'journal': return <Journal />
  }
}
```

**New files created:**
```
src/components/dashboard/
├── Dashboard.tsx       # Main dashboard view
├── DashboardHeader.tsx # Time filters and buttons
├── MetricsGrid.tsx     # The 6 metric cards at top
├── ChartsContainer.tsx # All the charts
├── CoachingTipCard.tsx # Trading tips display
└── index.ts            # Exports everything
```

---

#### 2. Created Custom Hooks
**What's a hook?** A reusable piece of logic. Think of it like a recipe you can use in different dishes.

```
src/hooks/
├── useChartData.ts    # Calculates all chart data
├── useCoachingTips.ts # Generates AI coaching tips
└── useLocalStorage.ts # Saves/loads data to browser
```

**Example - useChartData hook:**
```jsx
// WITHOUT a hook (repeat this in every component that needs chart data)
function Dashboard() {
  const radarData = [/* 20 lines of calculation */];
  const dailyPLData = [/* 15 lines of calculation */];
  // ... more calculations
}

// WITH a hook (one line!)
function Dashboard() {
  const { radarData, dailyPLData, calendarData } = useChartData(trades, metrics);
}
```

**Why hooks?**
- Write logic once, use it anywhere
- Easier to test
- Keeps components clean and focused on UI

---

#### 3. Added Data Persistence (localStorage)
**Before:** Data disappeared when you refreshed the page
**After:** Your trades and journal entries are saved in your browser

**How it works:**
```
User adds a trade
    ↓
Trade saved to Zustand store (for immediate UI update)
    ↓
Trade also saved to localStorage (for persistence)
    ↓
User refreshes page
    ↓
App loads trades from localStorage on startup
```

**Key functions in useLocalStorage.ts:**
| Function | What it does |
|----------|--------------|
| `saveTradesToStorage()` | Saves trades array to browser |
| `loadTradesFromStorage()` | Loads trades when app starts |
| `saveSettingsToStorage()` | Saves user preferences |

---

#### 4. Add/Edit/Delete Trades (CRUD Operations)
**CRUD** = Create, Read, Update, Delete - the 4 basic operations for any data.

**Before:** The "Add Trade" button did nothing
**After:** Full working form with validation

**How the flow works:**
```
User clicks "Add Trade" button
    ↓
TradeFormModal opens (shows form)
    ↓
User fills in: symbol, entry price, exit price, quantity
    ↓
Form validates the data (checks for errors)
    ↓
On submit: addTrade() function runs in store
    ↓
Trade appears in table + saved to localStorage
```

**Files involved:**
| File | Role |
|------|------|
| `TradeLog.tsx` | Has the table and buttons |
| `TradeFormModal.tsx` | The popup form |
| `tradingStore.ts` | Contains addTrade, updateTrade, deleteTrade functions |

**New store functions added:**
```typescript
addTrade(trade)      // Create a new trade
updateTrade(id, data) // Edit an existing trade
deleteTrade(id)       // Remove one trade
deleteTrades(ids)     // Remove multiple trades
```

---

#### 5. Built the Journal Feature
**Before:** Just showed "Coming soon..."
**After:** Full journal with mood tracking

**Features:**
- Create/edit/delete journal entries
- Track your mood for each trading day
- Add tags (like #scalping, #breakout)
- Record lessons learned
- Search and filter entries

**How data is stored:**
```javascript
// Each journal entry looks like this:
{
  id: "journal-123",
  date: "2026-01-03",
  title: "Great trading day",
  content: "Made 3 winning trades...",
  mood: "great",           // great/good/neutral/bad/terrible
  lessonsLearned: "Wait for confirmation",
  tags: ["momentum", "AAPL"],
  createdAt: 1704307200000
}
```

---

## Quick Reference

### File Structure Now
```
src/
├── App.tsx              # Routing only (102 lines)
├── components/
│   ├── dashboard/       # Dashboard pieces (5 files)
│   ├── journal/         # Journal feature (2 files)
│   ├── common/          # Shared components (TradeFormModal)
│   ├── charts/          # Chart components
│   └── ...              # TradeLog, Calendar, etc.
├── hooks/               # Reusable logic (3 files)
└── store/
    └── tradingStore.ts  # All app state + actions
```

### Key Concepts

| Concept | What It Means | Example |
|---------|---------------|---------|
| **Component** | Reusable UI piece | `<MetricCard />` |
| **Hook** | Reusable logic (starts with `use`) | `useChartData()` |
| **State** | Data that changes and updates UI | `trades`, `metrics` |
| **Props** | Data passed to a component | `<Dashboard trades={trades} />` |
| **Store** | Central place for app data | `tradingStore.ts` |
| **CRUD** | Create, Read, Update, Delete | `addTrade`, `deleteTrade` |
| **localStorage** | Browser storage (persists) | Saves your trades |

### Common Patterns Used

**1. Destructuring** - Pull out what you need:
```javascript
// Instead of: props.trades, props.metrics
const { trades, metrics } = props;
```

**2. Conditional Rendering** - Show different things:
```jsx
{trade.netPL >= 0 ? <GreenText /> : <RedText />}
```

**3. Array Methods** - Transform data:
```javascript
trades.filter(t => t.outcome === 'win')  // Only winners
trades.map(t => t.netPL)                 // Just the P&L values
trades.reduce((sum, t) => sum + t.netPL, 0)  // Total P&L
```

---

## What's Next?

Phase 2 will focus on UI/UX improvements:
- Theme toggle (dark/light mode)
- Keyboard shortcuts
- Better animations
- Chart improvements

---

*Last updated: January 2026*
