# 🎯 TradePilot

> A free, open-source trading journal for prop firm traders and TradingView paper traders. All the analytics you need — without the $60/month price tag.

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

## 💡 Why TradePilot?

Most trading journals charge **$30-60/month** for features that should be accessible to everyone. TradePilot gives you:

- ✅ **Multi-account tracking** — Free
- ✅ **Advanced analytics** — Free  
- ✅ **Unlimited trade imports** — Free
- ✅ **All features unlocked** — Free

Whether you're practicing on TradingView paper trading or grinding prop firm evaluations, you deserve proper analytics without breaking the bank.

---

## ✨ Features

- **Multi-Account Tracking** — Manage all your prop firm accounts and TradingView paper trading in one place
- **Performance Analytics** — Net P&L, win rate, profit factor, Sharpe ratio, and 15+ metrics calculated automatically
- **Visual Insights** — Interactive charts, P&L calendar, and trading hour analysis to find your edge
- **Smart Import** — Drag & drop CSV/Excel from TradingView, Topstep, Apex, and other platforms
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
| **TradingView** | Account → History → Export | CSV |
| **Topstep** | Reports → Trade History | CSV/XLSX |
| **Apex Trader** | Dashboard → Export | CSV |
| **TopOne Futures** | Trade History → Download | CSV |
| **Other Platforms** | Use generic CSV format | CSV |

<details>
<summary>📋 Supported CSV Columns</summary>

**ProjectX Format (Topstep, TopOne, etc.):**
```
ContractName, EnteredAt, ExitedAt, EntryPrice, ExitPrice, PnL, Size, Type, Fees
```

**TradingView Format:**
```
Time, Action, Realized P&L (value), Balance Before, Balance After
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
| **Charts** | Recharts |
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
│   └── journal/        # Trading journal
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
| Consistency Score | AI-powered trading score |

</details>

---

## 🗺️ Roadmap

- [ ] **Hosted version** — Simple login for non-technical users (small fee to cover hosting)
- [ ] Cloud sync & backup
- [ ] Real-time broker integrations
- [ ] Mobile app (React Native)
- [ ] Advanced AI coaching
- [ ] Social features & leaderboards

*The self-hosted open source version will always remain free.*

---

## 🤝 Contributing

Contributions are welcome! 

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

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
  <em>Built by a trader, for traders who shouldn't have to pay $60/month for a journal.</em>
</p>
