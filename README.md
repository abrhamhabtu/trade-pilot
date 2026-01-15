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

> **Note:** TradePilot is free when you run it yourself on your own computer or server. Clone the repo, run `npm install && npm run dev`, and you're up. No account needed, no data leaves your machine. A hosted version (for those who don't want to deal with code) is on the roadmap — that will have a small monthly fee to cover server costs.

Whether you're grinding prop firm evaluations or trading a funded account, you deserve proper analytics without breaking the bank.

---

## ✨ Features

- **Multi-Account Tracking** — Manage all your prop firm accounts in one place
- **Performance Analytics** — Net P&L, win rate, profit factor, Sharpe ratio, and 15+ metrics
- **Journey Visualization** — Track your progress to profit targets with pacing strategies
- **Visual Calendar** — See your daily P&L at a glance with projections
- **Trading Rules & Compliance** — Track how well you follow your trading plan
- **Smart Import** — Auto-detect CSV from TradingView, Tradovate, NinjaTrader, and ProjectX platforms
- **100% Free & Open Source** — No paywalls, no premium tiers, no subscriptions

---

## 🚀 Quick Start

```bash
# Clone the repo
git clone https://github.com/abrhamhabtu/trade-pilot.git

# Navigate to project
cd trade-pilot

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) 🎉

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
| **Build** | Vite |
| **File Parsing** | Papa Parse, XLSX |

---

## ⌨️ Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

---

<details>
<summary>📁 Project Structure</summary>

```
src/
├── components/
│   ├── accounts/       # Multi-account management
│   ├── charts/         # Chart components
│   ├── common/         # Shared UI components
│   ├── dashboard/      # Dashboard views
│   ├── journal/        # Trading journal
│   └── routine/        # Journey & routine tracking
├── hooks/              # Custom React hooks
├── store/              # Zustand state stores
├── types/              # TypeScript types
└── utils/              # Utility functions
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

## 🗺️ Roadmap

- [x] Multi-account support
- [x] Journey/profit target visualization
- [x] Trading rule compliance tracking
- [x] ProjectX CSV import
- [x] TradingView CSV import
- [x] Tradovate CSV import
- [x] NinjaTrader CSV import
- [ ] **Hosted version** — Simple login, no code required (small fee to cover hosting)
- [ ] Cloud sync & backup
- [ ] Real-time broker integrations
- [ ] Mobile app (React Native)
- [ ] Advanced AI coaching

*The self-hosted open source version will always remain 100% free.*

---

## 🤝 Contributing

Contributions are welcome! This project exists to help traders who are losing access to ProjectX analytics.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Priority Contributions Needed:
- **Tradovate CSV parser** — Many prop firms are migrating here
- **NinjaTrader CSV parser** — Another common migration target
- **Mobile responsiveness** — Make the dashboard mobile-friendly

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
