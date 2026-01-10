# TradePilot

A powerful trading analytics dashboard for prop firm traders and active traders. Track your performance across multiple accounts, analyze your trades, and improve your trading with data-driven insights.

![TradePilot Dashboard](https://img.shields.io/badge/Status-Active%20Development-brightgreen)
![License](https://img.shields.io/badge/License-MIT-blue)
![React](https://img.shields.io/badge/React-18.3-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178c6)

## Features

### 📊 Multi-Account Management
- **Track multiple prop firm accounts** - Topstep, Apex, FTMO, and more
- **Per-account analytics** - See performance metrics for each account
- **Combined view** - Analyze all accounts together or individually
- **Quick account switching** - Dropdown selector always accessible

### 📈 Comprehensive Analytics
- **Key Metrics**: Net P&L, Profit Factor, Win Rate, Expectancy
- **Advanced Stats**: Sharpe Ratio, Max Drawdown, Recovery Factor
- **Consistency Score**: AI-powered trading score based on multiple factors
- **Streak Tracking**: Current and max consecutive wins/losses

### 📅 Performance Visualization
- **Interactive Charts**: Cumulative P&L, Daily P&L, Performance Radar
- **Calendar View**: Daily P&L heatmap for pattern recognition
- **Time Analysis**: Identify your most profitable trading hours
- **Duration Analysis**: Optimize your trade holding times

### 📋 Trade Management
- **Complete Trade Log**: Filterable, sortable trade history
- **Import Support**: TradingView, ProjectX (Topstep, TopOne Futures)
- **Time Filtering**: View trades by day, week, month, or all time
- **Notes & Tags**: Add context to your trades

### 🎯 Trading Playbooks
- **Strategy Tracking**: Create and monitor different trading strategies
- **Per-Strategy Metrics**: Compare performance across playbooks
- **Rule Documentation**: Define your trading rules

### 📓 Trading Journal
- **Daily Reflections**: Document your trading mindset
- **Trade Reviews**: Link journal entries to specific trades
- **Pattern Recognition**: Track recurring themes in your trading

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Charts**: Recharts
- **File Processing**: Papa Parse, XLSX
- **Build Tool**: Vite

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/abrhamhabtu/trade-pilot.git

# Navigate to project directory
cd trade-pilot

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Building for Production

```bash
npm run build
npm run preview
```

## Usage

### Adding Accounts
1. Click **Accounts** in the sidebar
2. Click **Add new account**
3. Enter account name and select broker
4. Start importing trades

### Importing Trades
1. Export trades from your platform (CSV format)
2. Click the **+** button on an account or use **Import Trades**
3. Drag & drop or select your file
4. Trades are automatically parsed and added

### Supported Import Formats
- **TradingView**: Account History export
- **ProjectX Platforms**: Topstep, TopOne Futures, etc.
- **Generic CSV**: With standard column headers

## Project Structure

```
src/
├── components/
│   ├── accounts/       # Account management
│   ├── charts/         # Chart components
│   ├── common/         # Shared components
│   ├── dashboard/      # Dashboard views
│   └── journal/        # Journal feature
├── hooks/              # Custom React hooks
├── store/              # Zustand stores
├── types/              # TypeScript types
└── utils/              # Utility functions
```

## Roadmap

- [ ] Real-time broker integrations
- [ ] Advanced AI coaching insights
- [ ] Mobile app (React Native)
- [ ] Cloud sync & backup
- [ ] Social features & leaderboards
- [ ] API for third-party integrations

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

**Abrham Habtu**

- GitHub: [@abrhamhabtu](https://github.com/abrhamhabtu)

---

*TradePilot - Trade smarter, not harder.*
