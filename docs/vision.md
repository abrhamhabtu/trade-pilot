# Vision

Vision lives at `/app/vision`. It reads a live chart, marks a liquidity sweep and reversal when one forms, and shows how that setup has done on the loaded history.

## Markets and data

- **Crypto** (BTC, ETH, SOL, XRP): Coinbase Exchange. Candles over REST and every trade over its WebSocket ticker, in real time, with no key.
- **Futures** (NQ, ES, gold, crude): the broker connected in Proving Ground → Live (Tradovate or TopstepX) gives real-time bars. Without one, Yahoo's continuous contracts are used and labelled as about 10 minutes delayed. Tradovate's feed holds a few days, so it is laid over Yahoo's older history.

Timeframes are 1m, 5m, 15m, 1h and 4h (4h is built from hourly bars). One or two charts can be shown side by side.

## Strategies (`src/lib/vision/analyze.ts`)

Each chart picks a strategy, or "Any strategy" to run them all:

- **Double-break VWAP**: close through the session VWAP, pushed back, close through again; the second break is entry, the stop is the extreme between the breaks.
- **Supply & demand (Octavia)**: a one- or two-bar base that launched a 1.5 ATR impulse is the zone; the first return that closes back out of it is entry, the stop is beyond the zone.
- **Liquidity sweep**: a confirmed swing is wicked through, price closes back, then confirms by closing past the 21 EMA or turning momentum.
- **Opening range breakout**: the first close outside the session's first 15 minutes (15m bars or faster).
- **VWAP trend pullback**: after five closes on one side of a sloping VWAP, the first tag back into it that closes in trend.

Sessions are New York RTH for futures and the UTC day for crypto. Only closed bars are read. Targets are the next opposite swing at 1.2R or more, else 2R, capped at 4R.

The picker shows, for each strategy, how often it fired on the bars loaded and its edge in R and hit rate (target before stop), or "unrated" under 8 decided signals.

**Historical matches** are the chosen strategy run over every earlier bar in the loaded history, each replayed forward (up to 48 bars). The stop wins a bar that touches both. The projection cone is the 25th to 75th percentile path of those matches.

**Replay** walks the latest real setup forward bar by bar. **Demo** builds a clearly labelled simulated chart in which a chosen strategy forms and plays out to a win or a loss; every demo is checked by the real reader before it is shown, its odds come from the real chart's history, and demo trades are kept apart from paper results.

## Trading

Trades are on paper by default: crypto sizes to a dollar risk per trade, futures to a contract count (micro or full). Auto-execute takes only fresh setups whose history meets the minimum hit rate and, by default, a positive edge.

Real futures orders go through `POST /api/vision/execute` after arming a venue for the day: a typed `ARM`, confirmation that the firm allows automated trading, an account, and a contract cap. Orders are market entries with a broker-held stop and target. Venues implement `ExecutionVenue` in `src/lib/server/vision/venues.ts`; Tradovate and TopstepX are there now, and a crypto exchange plugs in the same way.

## Extras

- **Pine Script**: the same reader as a TradingView Pine v6 indicator, with numbered steps, the plan and alerts whose JSON the TradePilot webhook accepts.
- **Second read**: with a model connected in Pilot AI settings, the Copilot can ask it for a short take using only the computed facts.

## Backtest mode

The Live | Backtest switch in Vision's header turns the page cyan and swaps the live charts for three sections. Nothing in backtest mode touches the paper book, the trade history or a broker.

### Strategy test

Set up in three steps on the right:

1. **Market**: symbol, data source, timeframe, period, start balance (5K–150K) and the entry session (Entire day, Asia 7 pm–2 am, London 3–8 am, New York 9:30–4, NY open 9:30–11:30, all New York time; Asia wraps past midnight).
2. **Strategy**: one of the Vision readers, or **your words**. Plain English is parsed by `src/lib/vision/custom.ts` into named rules (entry, stop, target, trend filter, session, trades a day, break-even) that are read back on cards and can be edited in place. The parser is deterministic and lists sentences it could not use. Entries: break and retest of the prior day's high/low, a sweep of it, opening range breakout, VWAP cross, EMA cross, fair value gap retest, RSI reversal, break of structure (CHoCH/BOS), or any Vision reader with its own or your stop and target.
3. **Risk & rules**: direction, fixed contracts or whole contracts sized to a % of the balance, costs, max hold, break-even, trades a day, FOMC/early-close/VIX filters, and **prop firm mode**.

`src/lib/vision/backtest.ts` runs it in a worker, one position at a time. Entry at the signal bar's close plus slippage; stop and target on whole ticks; the stop wins a bar that touches both; break-even moves the stop from the bar after the trigger; a time exit after the max hold; commission per contract. Each trade records MAE/MFE in R and its duration.

The report: net P&L, profit factor, win rate and drawdown as a share of the balance; Sharpe, Sortino and Calmar from daily P&L; long and short; best entry time; a metrics table; equity and drawdown; monthly or yearly P&L; each Vision strategy on its own; breakdowns by 30-minute slot, hour, weekday, month, strategy, side, exit, VIX and FOMC. `src/lib/vision/verdict.ts` writes the **edge verdict** and a 0–100 edge score from the trades alone: the expectancy's t-stat, both halves of the period, green months and how much the best two carried, a 600-run bootstrap of final P&L and drawdown, and what to fix before sizing up.

Every trade is in the log with a running balance. Tapping one plots it: Vision's own marks on the run's timeframe, or the entry, exit, risk and reward boxes on 1m–1h (lower timeframes come from the library), the heat/run-up ruler, tags and notes (kept with the run when saved), ← / → to step, and "Replay from here".

**Prop firm mode** (`src/lib/vision/prop.ts`) grades the trades with Proving Ground's evaluator (`src/lib/proving/firms.ts`): from the first day, then started on every trading day (pass, blown and still going), median days to pass, evaluation cost per funded account, funded payout odds from `careerOdds`, pass odds for each contract count, and the same trades at every firm's account of that size.

### Prop firm desk

Named practice accounts at any firm, tested by hand, by strategy or both. New accounts are set up in four steps (firm, account, market and start, name). Contracts and risk are chosen on the account, next to the buttons that trade it.

The lab (`src/lib/vision/lab.ts`, `src/lib/server/library/lab.ts`, `/api/library/lab`) works on each account:

- **No-edge odds**: `coinFlipOdds` grades coin-flip trades (1:1, a tenth of the drawdown each, three a day, no fees) with the firm evaluator. The number a strategy has to beat.
- **Traps**: `firmTraps` turns each program's rules into what they cost in dollars and the counter to them.
- **Variants**: each Vision reader × New York, NY open, London × 5m, 15m × break-even at 1R or none, also limited to two trades a day. Run per contract, a year at a time, and stored under `library/lab/`, so new data only costs the newest year.
- **Sizing plans**: flat sizes, risk as a share of the room above the floor, a day stop at 40% of the room, a stop near the best-day limit, and one contract once at the target. `simulate` is tested to agree with the firm evaluator to the cent. Plans are ranked on the older 70% of days and shown on the newer 30%.
- **Ranges**: overlapping starts count as roughly independent attempts (days available over days per attempt), so a pass rate comes with a wide range when there are few real tries.
- **Walk-forward**: attempts in date order. Before each, the shortlist (best expectancy t-stat over the prior three years) and plan are chosen from earlier data only. Its pass rate is the number to believe; the plan held still is shown beside it.
- **Best firm**: the current strategy at every firm's account of this size, each with its best sizing, ranked by points over a no-edge trader at that firm. Beside it, attempts split by one rule set beforehand: start only when the cautious estimate beats no edge.
- **Autopsy**: names what ended an attempt (trailing floor, size, one day, a streak, giving back profit, stuck over the target) and replays the same trades under other plans to show which change would have saved it. Also runs on an account's own trades, by hand or automated.
- **Autopilot**: from the account's start date, chooses, trades, reads the result, pays for a reset and goes again until it passes or reaches 10 attempts. Each attempt goes in the account's history.
- **Studying again**: runs by itself when the library has newer data than the study, and the study log records whether the plan changed. An account's own trades don't feed the choice of plan.

Day by day (`DayLedger`), on accounts and Strategy test: each traded day's trades, wins, P&L, R, balance, intraday range, and with a firm the floor, room left, tightest room, daily limit used, best-day share and progress to target, flagged and downloadable.

Not modelled: activation fees, news bans, payout caps and fills in fast markets. Fees are $1.04 a micro and $3.64 a full contract round trip; stops and entries lose a tick.

### Replay

Bar-by-bar playback with the future hidden, from any date, up to 25×: market, limit and stop orders filled against each new bar, take profit in R, stop in points, fixed or %-risk sizing, auto break-even at +1R, a synced higher-timeframe chart, Vision's marks as setups form, and "Where it formed", the sessions where the strategy fired. In prop firm mode the drawdown (trailing intraday, end of day or static), daily loss limit and target run live. Guided scenarios pick a setup, market and session and offer months to practise. Every fill can be tagged; sessions save to the Library.

### Library

`src/lib/server/library/`, `/api/library/*`. Files dropped in the browser or added by a path or a whole folder in the home folder, kept on this machine under `~/.tradepilot/library/` (`TRADEPILOT_DATA_DIR` moves it). It sits outside the checkout so a fresh clone or worktree keeps it. The prices are not in this repository: Databento's licence covers the account holder's own use and this repository is public. `data/library-manifest.json` records what should be there (ranges, bar counts, checksums); restore with `npm run data:import -- <folder>` on Node 22 or newer.

A full-size contract is joined with its micro (NQ with MNQ, ES with MES, GC with MGC) wherever its own file has no bars. Back-month series (`.v.1`) are ignored. Originals download unchanged. OHLCV CSVs (Databento `ts_event` or `ts_utc` with `continuous`, or plain time/open/high/low/close/volume) become 1-minute series per symbol, stored per year; 1-second bars fold into minutes. Split zips (`.part00`/`.part01` onward) join once they read as a whole zip, and a zip of parts or zips (a Google Drive download) is unpacked first. The free-data pack supplies FOMC days, CME early closes and holidays, and VIX. Saved runs and sessions download as CSV or JSON. A run loads at most 400,000 bars (about five years of 5-minute bars); longer periods keep the latest.

Databento's continuous contracts are front month by volume and not back-adjusted, so a trade over a roll can see the roll's price step. Without library data, history comes from the free feeds: Yahoo for futures (about 60 days of 5-minute bars) and Coinbase for crypto.

## Not verified

The Pine Script has not been compiled in TradingView, and broker bars and orders have not been run against a live login. Test both before relying on them.
