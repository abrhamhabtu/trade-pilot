# TradePilot Architecture

> How your trading data flows through the app and gets saved locally.

---

## What is Zustand?

**Zustand** (German for "state") is a lightweight state management library for React. Think of it as the app's "brain" that holds all your data while you're using TradePilot.

### Simple Explanation

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   Imagine your app is a restaurant:                                     │
│                                                                         │
│   🍽️  React Components = The waiters (show data to you)                │
│   🧠  Zustand Store    = The kitchen (holds & manages all the data)    │
│   💾  localStorage     = The freezer (saves data for tomorrow)         │
│                                                                         │
│   When you import trades:                                               │
│   1. Data goes to the kitchen (Zustand) for processing                 │
│   2. Kitchen tells waiters (React) "here's the new menu!"              │
│   3. Kitchen also puts a copy in the freezer (localStorage)            │
│   4. Next time you open the restaurant, check the freezer first        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Why Zustand?

| Feature | What it means |
|---------|---------------|
| **In-memory** | Data lives in your browser's RAM while the app is open |
| **Reactive** | When data changes, the UI updates automatically |
| **Simple** | No complex setup, just works |
| **Fast** | No unnecessary re-renders |

### Can You See Zustand Data?

**No, not directly.** Zustand only exists while the app is running—it's in your browser's memory (RAM). When you close the tab, Zustand data disappears.

**But!** We save a copy to localStorage, which *does* persist. That's what you can see and backup.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   App Running:                                                          │
│   ┌──────────────┐     ┌──────────────┐                                │
│   │   Zustand    │ ←──▶│ localStorage │   Both have your data          │
│   │  (in memory) │     │  (on disk)   │                                │
│   └──────────────┘     └──────────────┘                                │
│         ↑                     ↑                                        │
│    Disappears when       Stays forever                                 │
│    you close tab         (until cleared)                               │
│                                                                         │
│   App Closed:                                                           │
│   ┌──────────────┐     ┌──────────────┐                                │
│   │   Zustand    │     │ localStorage │   Only localStorage remains    │
│   │    (gone)    │     │  (on disk)   │                                │
│   └──────────────┘     └──────────────┘                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## The Big Picture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           YOUR BROWSER                                  │
│                                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────────┐ │
│  │  CSV File   │───▶│   Parser    │───▶│      Zustand Store          │ │
│  │ (your data) │    │ (PapaParse) │    │   (in-memory state)         │ │
│  └─────────────┘    └─────────────┘    └──────────────┬──────────────┘ │
│                                                       │                 │
│                                                       ▼                 │
│                                        ┌─────────────────────────────┐ │
│                                        │      localStorage           │ │
│                                        │   (persistent storage)      │ │
│                                        │                             │ │
│                                        │  Key: tradepilot_accounts   │ │
│                                        │  Key: tradepilot_settings   │ │
│                                        └─────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │   Your Computer's     │
                        │   Local Storage       │
                        │   (~5-10MB limit)     │
                        └───────────────────────┘
```

**Key Point:** Your data never leaves your computer. There's no server, no cloud, no account needed.

---

## Step-by-Step: What Happens When You Import a CSV

### 1. You Drop a CSV File

```
┌──────────────────────────────────────────────────────────────┐
│                     ImportModal.tsx                          │
│                                                              │
│   ┌────────────────────────────────────────────────────┐    │
│   │                                                    │    │
│   │     📁 Drop your CSV here or click to browse      │    │
│   │                                                    │    │
│   └────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│                    File object                               │
│              (trades_export.csv)                             │
└──────────────────────────────────────────────────────────────┘
```

### 2. CSV Gets Parsed

The app uses **PapaParse** library to read your CSV file:

```javascript
// What happens behind the scenes
Papa.parse(file, {
  header: true,           // First row = column names
  skipEmptyLines: true,   // Ignore blank rows
  complete: (results) => {
    // results.data = array of trade objects
  }
});
```

**Example transformation:**

```
CSV File (raw text):                    Parsed Result (JavaScript objects):
┌─────────────────────────────┐         ┌─────────────────────────────────┐
│ Date,Symbol,PnL,Side        │         │ [                               │
│ 2025-01-08,MES,122.50,Long  │   ───▶  │   { date: "2025-01-08",         │
│ 2025-01-08,MES,-62.50,Long  │         │     symbol: "MES",              │
│ 2025-01-07,MNQ,91.00,Long   │         │     netPL: 122.50,              │
└─────────────────────────────┘         │     side: "Long" },             │
                                        │   { ... },                      │
                                        │   { ... }                       │
                                        │ ]                               │
                                        └─────────────────────────────────┘
```

### 3. Format Auto-Detection

The parser checks which platform your CSV came from:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Format Detection                             │
│                                                                     │
│   CSV Columns                          Detected Platform            │
│   ─────────────────────────────────────────────────────────────    │
│   ContractName, EnteredAt, PnL    ───▶  ProjectX (Topstep, etc.)   │
│   Time, Action, Realized P&L      ───▶  TradingView                │
│   Date, Symbol, Side, Qty, P&L    ───▶  Tradovate                  │
│   Instrument, Entry price, Profit ───▶  NinjaTrader                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4. Trades Go Into the Store

```
┌─────────────────────────────────────────────────────────────────────┐
│                     accountStore.ts (Zustand)                       │
│                                                                     │
│   accounts: [                                                       │
│     {                                                               │
│       id: "account-123",                                            │
│       name: "Topstep 50K",                                          │
│       broker: "Topstep",                                            │
│       balance: 1,247.50,                                            │
│       trades: [          ◀─── Your imported trades go here         │
│         { id: "t1", date: "2025-01-08", symbol: "MES", ... },      │
│         { id: "t2", date: "2025-01-08", symbol: "MES", ... },      │
│         { id: "t3", date: "2025-01-07", symbol: "MNQ", ... }       │
│       ],                                                            │
│       importHistory: [   ◀─── Record of what files you imported    │
│         { fileName: "trades.csv", tradesImported: 3, ... }         │
│       ]                                                             │
│     }                                                               │
│   ]                                                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 5. Saved to localStorage

Every time the store changes, it automatically saves to `localStorage`:

```javascript
// This happens automatically after any change
localStorage.setItem('tradepilot_accounts', JSON.stringify(accounts));
```

**What's actually stored in your browser:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Browser DevTools > Application                   │
│                                                                     │
│   localStorage                                                      │
│   ├── tradepilot_accounts     │ {"accounts":[{"id":"account-123",  │
│   │                           │   "name":"Topstep 50K","trades":   │
│   │                           │   [{"id":"t1","date":"2025-01...   │
│   │                           │                                     │
│   ├── tradepilot_settings     │ {"hasImportedData":true,           │
│   │                           │  "lastImportTime":1736892345}      │
│   │                           │                                     │
│   └── tradepilot_selected     │ "account-123"                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Where Is My Data Actually Stored?

Your data lives in your browser's **localStorage**. Here's how to see it:

### Chrome / Edge / Brave:
1. Right-click anywhere on TradePilot
2. Click **Inspect** (or press `F12`)
3. Go to **Application** tab
4. Click **Local Storage** → `localhost:3001`
5. You'll see `tradepilot_accounts` with all your data

```
┌─────────────────────────────────────────────────────────────────────┐
│  🔍 DevTools                                                   _ □ X│
├─────────────────────────────────────────────────────────────────────┤
│  Elements  Console  Sources  Network  [Application]  ...           │
├─────────────────────────────────────────────────────────────────────┤
│  ▼ Storage                                                          │
│    ▼ Local Storage                                                  │
│      ● http://localhost:3001     ◀─── Click here                   │
│                                                                     │
│  Key                      │ Value                                   │
│  ─────────────────────────┼─────────────────────────────────────── │
│  tradepilot_accounts      │ [{"id":"account-123","name":"Top...    │
│  tradepilot_settings      │ {"hasImportedData":true,"lastIm...     │
│  tradepilot_selected      │ "account-123"                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│    USER ACTION                    STORE UPDATE                  PERSIST     │
│                                                                             │
│    ┌─────────┐                   ┌─────────────┐              ┌──────────┐ │
│    │ Import  │                   │             │              │          │ │
│    │  CSV    │──────────────────▶│  Zustand    │─────────────▶│ local    │ │
│    └─────────┘                   │   Store     │              │ Storage  │ │
│                                  │             │              │          │ │
│    ┌─────────┐                   │ accountStore│              │          │ │
│    │  Add    │──────────────────▶│ tradingStore│─────────────▶│          │ │
│    │ Trade   │                   │             │              │          │ │
│    └─────────┘                   └──────┬──────┘              └──────────┘ │
│                                         │                                   │
│    ┌─────────┐                          │                                   │
│    │ Delete  │──────────────────────────┘                                   │
│    │ Trade   │                                                              │
│    └─────────┘                                                              │
│                                         │                                   │
│                                         ▼                                   │
│                              ┌─────────────────────┐                        │
│                              │    React Components │                        │
│                              │    re-render with   │                        │
│                              │    new data         │                        │
│                              └─────────────────────┘                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## On App Load

When you open TradePilot, here's what happens:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         App Startup                                 │
│                                                                     │
│   1. Browser loads TradePilot                                       │
│                    │                                                │
│                    ▼                                                │
│   2. accountStore.ts runs loadAccountsFromStorage()                 │
│                    │                                                │
│                    ▼                                                │
│   3. Check localStorage for 'tradepilot_accounts'                   │
│                    │                                                │
│          ┌────────┴────────┐                                        │
│          │                 │                                        │
│          ▼                 ▼                                        │
│   Data exists?         No data?                                     │
│          │                 │                                        │
│          ▼                 ▼                                        │
│   Load your saved      Create demo                                  │
│   accounts & trades    account with                                 │
│                        sample trades                                │
│          │                 │                                        │
│          └────────┬────────┘                                        │
│                   ▼                                                 │
│   4. Zustand store initialized with data                            │
│                   │                                                 │
│                   ▼                                                 │
│   5. React components render with your trades                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Storage Limits & What Happens When It's Full

| Storage Type | Limit | TradePilot Usage |
|--------------|-------|------------------|
| localStorage | ~5-10 MB | Accounts, trades, settings |
| Per-key limit | ~5 MB | Each storage key |

**Rough capacity:**
- ~5,000-10,000 trades before hitting limits
- Average trade = ~500 bytes of JSON data

**What happens when it's full?**
- The browser will throw an error when trying to save
- Your existing data stays safe, but new imports will fail
- Solution: Export/backup your data, then clear old trades you don't need

**Future improvement:** We plan to add IndexedDB support which allows ~50MB+ storage (enough for 100,000+ trades).

---

## How to Backup Your Data

Since your data is stored locally, **you are responsible for backups**. 

### Method 1: Built-in Export (Recommended) ✅

TradePilot now has a built-in backup feature!

1. Go to the **Accounts** page
2. Scroll down to **Data Management**
3. Click **Export Backup**
4. Save the `tradepilot_backup_YYYY-MM-DD.json` file somewhere safe

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Data Management                                 │
│                                                                     │
│   Storage Used: 45.2 KB / 5 MB                                     │
│   ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│                                                                     │
│   [💾 Export Backup]    [📥 Restore from Backup]                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**To restore:**
1. Go to **Accounts** → **Data Management**
2. Click **Restore from Backup**
3. Select your backup file
4. Wait for the page to refresh

### Method 2: Browser DevTools (Manual)

1. Press `F12` to open DevTools
2. Go to **Application** → **Local Storage** → `localhost:3001`
3. Right-click on `tradepilot_accounts` → **Copy value**
4. Paste into a text file and save

### Method 3: Browser Console (For Developers)

**Export:**
```javascript
copy(localStorage.getItem('tradepilot_accounts'));
```

**Import:**
```javascript
localStorage.setItem('tradepilot_accounts', '{"your":"backup","data":"here"}');
location.reload();
```

---

## Privacy & Security

| Question | Answer |
|----------|--------|
| Does my data go to a server? | **No.** Everything stays in your browser. |
| Can TradePilot see my trades? | **No.** We have no backend, no analytics, no tracking. |
| What if I clear browser data? | **Your trades will be deleted.** Export first! |
| Is it encrypted? | **No.** localStorage is plain text. Don't use on shared computers. |
| Can I backup my data? | **Yes.** Use the Export Backup button in Accounts → Data Management. |

---

## Deployment Options

TradePilot can be run in two ways:

### Option 1: Docker (Recommended for most users)

```bash
docker-compose up -d
# Open http://localhost:3001
```

No Node.js required. Just install Docker Desktop and run the command above.

### Option 2: Development Mode

```bash
npm run install:web
npm run dev
# Open http://localhost:3001
```

Requires Node.js 18+.

---

## Key Files

| File | Purpose |
|------|---------|
| `apps/web/src/store/accountStore.ts` | Main data store for accounts & trades |
| `apps/web/src/store/tradingStore.ts` | Trading metrics, time filters, UI state |
| `apps/web/src/hooks/useLocalStorage.ts` | Helper functions for saving/loading/exporting |
| `apps/web/src/components/ImportModal.tsx` | CSV upload and parsing UI |
| `apps/web/src/components/accounts/AccountsPage.tsx` | Account management + Data Management UI |
| `Dockerfile` | Docker build configuration |
| `docker-compose.yml` | Easy Docker deployment |

---

*Last Updated: January 2026*
