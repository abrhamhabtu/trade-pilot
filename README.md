# 🎯 TradePilot

> A free, open-source trading journal for prop firm traders and futures traders. All the analytics you need — without the $60/month price tag.

<p align="center">
  <img src="./assets/demo.gif" alt="TradePilot Dashboard Demo" width="700">
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-features">Features</a> •
  <a href="#-importing-trades">Import Trades</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Open%20Source-Free-brightgreen" alt="Open Source">
  <img src="https://img.shields.io/badge/React-18.3-61dafb?logo=react&logoColor=white" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.5-3178c6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css&logoColor=white" alt="Tailwind">
  <img src="https://img.shields.io/badge/License-AGPL%20v3-blue.svg" alt="License">
</p>

---

## 🚨 Why This Project Exists

I'm a part-time trader, still learning the ropes. Tools like trading journals have genuinely helped me improve — seeing patterns in my behavior, tracking what works, staying accountable. But paying $50+/month for a journal when I'm already paying for prop firm evaluations? That adds up fast.

**The Situation:** In late 2025, ProjectX announced they're discontinuing support for all third-party prop firms effective February 28, 2026. ProjectX will become exclusive to Topstep only.

This affects thousands of traders at prop firms including:
- Top One Futures
- Trading Lucid
- Tradify
- Blue Guardian Futures
- Tick Tick Trader
- Take Profit Trader
- FuturesElite
- And many others

So I built TradePilot. Actually, I started it a while back for a hackathon — just a side project to scratch my own itch. When the ProjectX news dropped, it felt like the perfect time to dust it off and keep building. The timing couldn't have been better.

I genuinely believe traders shouldn't have to choose between paying for overpriced tools or going without proper analytics. If I can build something useful and share it with the community, why not?

Is that a little selfish? Maybe. But here we are. 🤷‍♂️

These prop firms are now migrating to **Tradovate** and **NinjaTrader** for trade execution, while many traders are using **TradingView** for charting.

**The Gap:** TradingView is great for charts, but it has **no native trading journal**. You can export your trades, but there's no visual analytics, rule tracking, journey visualization, or performance roadmap.

**The Solution:** TradePilot fills this gap. It provides the visual trade journaling and analytics that traders loved about ProjectX — completely free and open source. And honestly? It might be even better. (We're a little biased.)

> **Topstep traders:** You're still covered! Topstep will keep ProjectX exclusively, but if you want a dedicated journal with more features, TradePilot imports your Topstep/ProjectX CSVs perfectly. Best of both worlds.

---

## 💡 Why TradePilot?

Most trading journals charge **$30-60/month** for features that should be accessible to everyone. TradePilot gives you:

- ✅ **Multi-account tracking** — Free (self-hosted)
- ✅ **Advanced analytics** — Free (self-hosted)
- ✅ **Unlimited trade imports** — Free (self-hosted)
- ✅ **Journey visualization** — Free (self-hosted)
- ✅ **Rule compliance tracking** — Free (self-hosted)
- ✅ **All features unlocked** — Free (self-hosted)

> **Note:** TradePilot is free when you run it yourself on your own computer or server. Clone the repo, run `npm run install:web && npm run dev`, and you're up. Default local port is `3001` to avoid common conflicts on `3000`. No account needed, no data leaves your machine.

Whether you're grinding prop firm evaluations or trading a funded account, you deserve proper analytics without breaking the bank.

---

## ✨ Features

- **Multi-Account Tracking** — Manage all your prop firm accounts in one place
- **Performance Analytics** — Net P&L, win rate, profit factor, Sharpe ratio, and 15+ metrics
- **Journey Visualization** — Track your progress to profit targets with pacing strategies
- **Dual-Condition Payout Qualification** — Track both balance target AND consistency rule simultaneously. Payout status only shows "Ready" when both conditions are met
- **Consistency Guardian** — Dedicated tab with arc gauge, daily guardrails (safe zone, warning zone, danger zone), what-if scenario simulator, and path-to-payout projections
- **What-If Scenario Tool** — See a Now vs After comparison of how a hypothetical trade would affect your consistency %, required target, payout readiness, and both qualification conditions
- **Dual Progress Ring** — Concentric rings showing balance progress (outer) and consistency progress (inner) at a glance
- **Visual Calendar** — See your daily P&L at a glance with goal projections that account for both payout conditions
- **Balance Adjustments** — Record payouts, deposits, and adjustments to keep your account balance accurate (matches prop firm dashboards like TopOne Futures)
- **Consistency Reset After Payout** — Automatically resets consistency tracking after a payout, so your metrics reflect your current trading period
- **Trading Rules & Compliance** — Track how well you follow your trading plan
- **Smart Import** — Auto-detect CSV from TradingView, Tradovate, NinjaTrader, and ProjectX platforms
- **One-Click Backup** — Export and restore your data with built-in backup tools (with smart reminders)
- **Docker Support** — Run with a single command, no coding required
- **100% Free & Open Source** — No paywalls, no premium tiers, no subscriptions

---

## 🚀 Quick Start

### Option A: Docker (Easiest — No coding required)

```bash
# Clone the repo
git clone https://github.com/abrhamhabtu/trade-pilot.git
cd trade-pilot

# Start with Docker
docker-compose up -d
```

Open [http://localhost:3001](http://localhost:3001) 🎉

### Option B: Manual Setup (For developers)

```bash
# Clone the repo
git clone https://github.com/abrhamhabtu/trade-pilot.git
cd trade-pilot

# Install dependencies
npm run install:web

# Start development server
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) 🎉

> **New to this?** Check out [GETTING_STARTED.md](GETTING_STARTED.md) for a beginner-friendly guide with screenshots and troubleshooting tips.

---

## 📦 Importing Trades

TradePilot auto-detects your file format. Just drag & drop!

| Platform | Export Location | Format |
|----------|-----------------|--------|
| **Topstep (ProjectX)** | Trade History → Download | CSV |
| **TradingView** | Account → History → Export | CSV |
| **Tradovate** | Reports → Trade Activity | CSV |
| **NinjaTrader** | Control Center → Account Data → Export | CSV |
| **Other ProjectX Firms** | TopOne, Blue Guardian, etc. | CSV |
| **Apex Trader** | Dashboard → Export | CSV |

<details>
<summary>📋 Supported CSV Columns</summary>

**ProjectX Format (Topstep, TopOne, Blue Guardian, etc.):**
```
ContractName, EnteredAt, ExitedAt, EntryPrice, ExitPrice, PnL, Size, Type, Fees
```

**TradingView Format:**
```
Time, Action, Realized P&L (value), Balance Before, Balance After
```

**Tradovate Format:**
```
Date, Time, Symbol, Side, Qty, Entry Price, Exit Price, P&L, Commission
```

**NinjaTrader Format:**
```
Instrument, Market pos., Qty, Entry price, Exit price, Profit, Commission, Entry time, Exit time
```

</details>

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | React 18 |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS |
| **State** | Zustand |
| **Charts** | Recharts + Custom SVG |
| **Build** | Next.js (App Router) |
| **File Parsing** | Papa Parse, XLSX |

---

## ⌨️ Commands

| Command | Description |
|---------|-------------|
| `npm run setup` | One-time project setup (installs app dependencies) |
| `npm run install:web` | Install app dependencies |
| `npm run dev` | Start development server on port 3001 |
| `npm run dev:3000` | Start development server on port 3000 |
| `npm run build` | Build for production |
| `npm run start` | Start production server on port 3001 |
| `npm run lint` | Run ESLint |

---

<details>
<summary>📁 Project Structure</summary>

```
apps/web/src/
├── components/
│   ├── accounts/       # Multi-account management & balance adjustments
│   ├── charts/         # Chart components (equity curves, P&L charts)
│   ├── common/         # Shared UI components (Toast, etc.)
│   ├── dashboard/      # Dashboard views & analytics
│   ├── journal/        # Trading journal with daily notes
│   └── routine/        # Journey page, Consistency Guardian, What-If tool
├── hooks/              # Custom React hooks (localStorage, chart data)
├── store/              # Zustand state stores (accounts, trades, theme)
└── utils/              # Utility functions (CSV parsing, calculations)
```

</details>

<details>
<summary>📊 Metrics Calculated</summary>

| Metric | Description |
|--------|-------------|
| Net P&L | Total profit/loss |
| Win Rate | Percentage of winning trades |
| Profit Factor | Gross profit ÷ Gross loss |
| Expectancy | Average P&L per trade |
| Sharpe Ratio | Risk-adjusted return |
| Max Drawdown | Largest peak-to-trough decline |
| Avg Win/Loss | Average winning/losing trade |
| Consistency Score | Trading discipline score |

</details>

---

## 💰 Balance Adjustments (Payouts & Deposits)

When you take a payout from your prop firm, your account balance changes but your trading P&L doesn't reflect it. TradePilot lets you record these adjustments so your balance stays accurate and matches your prop firm dashboard.

### How to Record a Payout or Deposit:

1. Go to **Accounts** page
2. Click the **three-dot menu** (⋮) on your account
3. Select **"Adjust Balance"**
4. Add a new adjustment:
   - **Payout** — Money withdrawn (e.g., -$2,500)
   - **Deposit** — Money added (e.g., +$1,000)
   - **Adjustment** — Other corrections

### What Happens After Recording:

- **Dashboard** — Net P&L includes adjustments to match your actual balance
- **Calendar** — Daily and weekly totals include adjustments (just like TopOne Futures shows)
- **Journey** — Consistency tracking automatically resets after a payout, and the dual-condition payout qualification (balance target + consistency rule) recalculates from the new starting point
- **Consistency Guardian** — What-if scenarios and daily guardrails update to reflect your post-payout trading period
- **Accounts** — Balance reflects trading P&L + all adjustments

> **Pro Tip:** This is especially useful for prop firms like TopOne Futures where payouts reset your consistency requirements. TradePilot detects your most recent payout and only calculates consistency from trades after that date.

---

## 🗺️ Roadmap

- [x] Multi-account support
- [x] Journey/profit target visualization
- [x] Trading rule compliance tracking
- [x] ProjectX CSV import
- [x] TradingView CSV import
- [x] Tradovate CSV import
- [x] NinjaTrader CSV import
- [x] One-click data backup & restore
- [x] Docker deployment support
- [x] Balance adjustments (payouts, deposits) with auto-sync across all pages
- [x] Consistency reset after payout (for prop firms like TopOne Futures)
- [x] Consistency Guardian with what-if simulator, daily guardrails, and path-to-payout
- [x] Dual-condition payout qualification (balance target + consistency rule)
- [x] Smart backup reminders with persistent dismissal
- [ ] **Hosted version** — Simple login, no code required (small fee to cover hosting)
- [ ] Cloud sync
- [ ] Real-time broker integrations
- [ ] Mobile app (React Native)
- [ ] Advanced AI coaching

*The self-hosted open source version will always remain 100% free.*

---

## 🤝 Contributing

Contributions are welcome! This project exists to help traders who are losing access to ProjectX analytics.

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for setup, standards, and the pull request checklist.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Priority Contributions Needed:
- **Mobile responsiveness** — Make the dashboard mobile-friendly
- **Export to CSV** — Let users export trades back to CSV format
- **Broker integrations** — Direct connections to Tradovate, NinjaTrader APIs
- **Dark/Light theme polish** — Refine the light mode experience

---

## 📄 License

**AGPL v3** © [Abrham Habtu](https://github.com/abrhamhabtu)

This project is open source under the [GNU Affero General Public License v3.0](LICENSE).

**What this means:**
- ✅ Free to use, modify, and self-host
- ✅ Free for personal and commercial self-hosted use
- ⚠️ If you host this as a service for others, you must open source your modifications

---

<p align="center">
  <strong>TradePilot</strong> — Professional trading analytics, accessible to everyone.
  <br><br>
  <em>Built for traders who shouldn't have to pay $60/month for a journal — self-host it free, forever.</em>
</p>
