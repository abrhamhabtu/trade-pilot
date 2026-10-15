# Proving Ground: accounts, tournament, alerts and live bots

Proving Ground lives at `/app/proving` and has three views.

## Your tests

Each test is its own prop account for life. It buys the eval, pays monthly renewals, buys a new eval when one blows, moves to the funded account after a pass and takes payouts at the firm's split (`src/lib/proving/career.ts`). The leaderboard ranks tests by the chance of more paid out than spent over three months, from 300 account lives dealt from the test's own finished sessions.

The payout model is deliberately plain: once the firm's minimum days are traded, everything above one drawdown of cushion is withdrawn. Activation fees, payout caps and payout calendars are not modelled.

Each session draws on TradingView's Lightweight Charts with VWAP, the levels known at the open, and every trade's entry, exit, stop and target.

## Tournament

Every built-in strategy against every firm program at one account size, on MNQ or MES (`src/lib/proving/tournament.ts`, run in a web worker).

- **Tuned, scored on unseen days** (default): rules (target, break-even, trades per day, direction) and contract size are chosen on the first half of the window and money is scored only on the second half.
- **Starting rules**: every strategy on its defaults over the whole window.

Pairs are ranked by the chance of coming out ahead, then the typical result. The mean is ignored on purpose, because cheap resets at maximum size produce a long right tail that looks like an edge.

## Live & alerts

The server starts background loops on boot (`src/instrumentation.ts`). Set `TRADEPILOT_DAEMONS=0` to turn them off.

- **Always-on runner.** The browser mirrors its tests to the server, which replays them every minute and sends alerts with no browser open. Tests on "My TradingView signals" still run only in the browser.
- **Alerts.** A Telegram bot (token from @BotFather, then *Find my chat*) and/or a Discord webhook. Telegram answers `/status`, `/live`, `/flatten` and `/help`, from the saved chat only.
- **Brokers.** Tradovate covers Lucid, Top One Futures, Futures Elite, Tradeify, FundedNext and Take Profit Trader: connect with your Tradovate username, password and an API key (app ID, CID, secret; needs Tradovate's API add-on and your firm's permission). Most prop accounts are on the demo environment. TopstepX (ProjectX) connects with a username and API key; other firms on ProjectX use their own gateway address. Tradovate bars stream from its market-data WebSocket, which needs Node 22 or newer (the Docker image uses Node 22).
- **Live bots.** A bot runs a test's rules on the broker's own real-time bars for the front-month contract.
  - Shadow is the default: every order it would send is logged and alerted, and nothing reaches the broker.
  - Arming needs a typed `ARM`, your confirmation that the firm allows automated trading on that account, and lasts for one session.
  - Armed orders are market entries on fresh signals only, with broker-side OCO brackets (Tradovate: an OCO stop and target attached to the entry, flagged as automated; ProjectX: the account must be set to **Auto OCO Brackets** in its risk settings), a contract cap, a daily loss stop that halts and flattens, and the strategy's flat-by time.
  - Any rejected order disarms the bot. The kill switch (in the app, or `/flatten` on Telegram) closes every armed bot's position, cancels its orders and disarms all bots.

Several prop firms restrict or ban automated trading. Check your firm's rules before arming.

## Data and security

Server state is plain JSON in `.tradepilot/` (or `TRADEPILOT_DATA_DIR`), git-ignored. Alert tokens and the ProjectX key are owner-readable only and never sent to a browser. The alert, runner and live routes answer only same-origin requests to a loopback address. A production (Docker) build also needs `TRADEPILOT_LOCAL_CONTROL=1`; keep that port off the public internet.

## Not verified

No Tradovate or ProjectX credentials, Telegram bot or Discord webhook were available during development, so order placement, broker bars and message delivery have been checked against the published API documentation only (Tradovate: docs.ninjatrader.com/api). Run a bot in shadow for a session, and send a test alert, before relying on either.
