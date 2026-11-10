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

## The chart (`src/components/vision/VisionChart.tsx`, `src/lib/vision/layout.ts`)

Every tag is placed by one layout engine, so nothing lands on another tag: `place()` tries each label's preferred sides at a few distances, slid along the edge, and takes the spot that overlaps candles and the volume pane least; a label that still collides tries a shorter form, then hides. `stack()` keeps the right-hand gutter in price order. Labels keep last frame's spot when it is nearly as good, so they don't jitter as bars tick. Every overlay element carries `data-ov`, so overlap can be checked in the browser.

One mark per fact: entry, target and stop are lines labelled on the price axis; the plan box carries only `+2.0R` and `−1R`. The story is numbered pins on the candles that made the setup, with a short title beside each while it's explained; hovering a pin shows the full note, and the banner carries the status and the record ("54% of 37 past matches reached target").

The layers button sets density per chart (Clean: pins, plan lines and prices; Standard adds boxes and notes; Full adds the projection and volume) and switches day levels, session shading, the story, the plan, the projection and other setups. Two charts side by side start Clean.

The gutter holds the day's levels from their own 5-minute history (`src/lib/vision/levels.ts`, `useLevels`): prior day high, low and close, overnight, Asia and London ranges, the opening range and the first hour. Each appears only once its window has closed, levels more than 3 ATR away are hidden, and crypto has none. Today's scheduled news (CPI, jobs, FOMC) is a dashed line at its bar. A strip above the chart shows structure on the higher timeframes and says when a setup runs against the 1-hour trend.

## Discover (`src/lib/vision/patterns.ts`, `discover.ts`)

Beyond the five readers, Vision has nine patterns built on the day's levels, each deciding on a closed bar with the readers' stop and target rules: Asia range sweep, overnight sweep and prior day sweep (run a level, close back inside), failed opening range break, initial balance break (a narrow first hour), VWAP band reversion (a poke past 2 standard deviations of a flat VWAP), fair value gap continuation, break of structure and retest, and compression breakout. Their thresholds live in `P` at the top of `patterns.ts`. The scout's research ideas join as well, never the coin flip.

The strategy menu reads a chart with Discover (every idea at once), any of your strategies, one of the five, or one found idea. Discover describes today in plain facts (session, trend or range day, quiet or volatile, the gap, the news) and ranks every idea by how it did lately, nudged by how it did on days like this, with thin samples pulled toward the overall result (30 trades of weight). Other reads still open show as numbered diamonds on the chart; a click makes one the setup explained.

Ideas are rated on deep history: the lab's Discover study (`/api/library/lab`, action `discover`) runs every idea on every year of the library at 5m and 15m, after fees and a tick of slippage, each trade tagged with its scenario, stored per year under `~/.tradepilot/library/lab/v1/discover-v2/`. Without library data, a worker rates them on about 60 days of recent bars, and nothing can be rated proven.

The badge follows the scout's tests in order, and adds one: **Proven** needs 200 trades, positive results on the older 70% and the newest 30%, a t-stat of 2 on the newest trades, 60% green years, and a t-stat above the bar for the number of ideas tested on that market (with 51 ideas, about 3.3). **Promising** is positive on both halves but short of a test; **Unproven** is too few trades or only recent history; **Losing** loses on the newest data. Scout ideas take the scout's own verdict, made stricter by the same bar. The panel's dials change what it shows; real orders always use these defaults.

Pinning a found idea adds it to your strategies and to "any of my strategies". Auto-execute takes only the five readers or a pinned idea Proven on that market, and `POST /api/vision/execute` checks the same against the server's own study, so nothing discovered places a real order until it has earned it.

On NQ and ES, sweeps are tagged when the other index didn't take out its matching level ("ES did not confirm the low"), and the study records how those trades did against the rest.

## Pass mode (`src/lib/vision/guard.ts`)

Under "Trading for" in the copilot, pick a Prop desk practice account. For the setup on screen, Vision works out the contracts your risk cap allows on the room left, then applies the daily loss limit, the firm's contract limit, your hours and days, news you skip (10 minutes before to 30 after), the consistency rule (no win that takes today past what it allows), no more size than finishing the target needs, and, on an intraday trailing drawdown, what a round trip from +1R back to the stop costs. The copilot shows the size, the dollars and share of room at risk, the reasons, and what a loss or a win does; the chart carries one line by the risk box. A "no" blocks real venues and auto-execute; on paper it reads "Take anyway (paper)". Closed trades are written to the account like Replay's hand trades. This is arithmetic on the firm's rules and your limits, not advice.

Before the New York open, a morning brief sums up the day so far, where price sits against yesterday and the night, what has held up on days like this, the account's room and the news.

## Trading

Trades are on paper by default: crypto sizes to a dollar risk per trade, futures to a contract count (micro or full). Auto-execute takes only fresh setups whose history meets the minimum hit rate and, by default, a positive edge.

Real futures orders go through `POST /api/vision/execute` after arming a venue for the day: a typed `ARM`, confirmation that the firm allows automated trading, an account, and a contract cap. Orders are market entries with a broker-held stop and target. Venues implement `ExecutionVenue` in `src/lib/server/vision/venues.ts`; Tradovate and TopstepX are there now, and a crypto exchange plugs in the same way.

## Extras

- **Pine Script**: the same reader as a TradingView Pine v6 indicator, with numbered steps, the plan and alerts whose JSON the TradePilot webhook accepts.
- **Second read**: with a model connected in Pilot AI settings, the Copilot can ask it for a short take using only the computed facts.

## Alerts

The Alerts button opens a step-by-step guide, alert rules, Pine scripts and a history. Alerts only tell the trader to look at a chart: nothing here places a trade.

- **Phone**: calls and texts through the trader's own Twilio account (`src/lib/server/alerts.ts`). Credentials stay in `~/.tradepilot/alerts.json`, owner-readable, and are never sent back to a browser.
- **Rules** (`src/lib/vision/alerts.ts`): words to match, channels, hours in the trader's time zone, days and a quiet period. Named rules beat the catch-all. A wake-up call before the open reads the day's CPI, jobs and FOMC dates and skips holidays.
- **TradingView**: `POST /api/alerts/tradingview?key=` is the only route meant for the internet. The key lives in the address, not the script. It can only send an alert. Through a Cloudflare tunnel, `src/middleware.ts` answers 404 for everything else unless `TRADEPILOT_PUBLIC_APP=1`.
- **Watcher**: each minute during chosen hours, the Vision readers, a VWAP touch and any pinned idea run on closed bars from the free feed, so alerts can be about 10 minutes late.
- **Pine scripts** (`src/lib/vision/pineTools.ts`, `/api/pine`): paste or drop files, keep versions, notes and favorites. The app reads what a script is and can alert on, warns about common traps, and adds alert code. TradingView runs Pine: this app can't chart or backtest it, and the ready-made scripts haven't been compiled in TradingView.

## AI

Claude Code and Codex connect with one click where they're installed and logged in (`src/lib/server/sessionModel.ts`). The app runs the official command as the trader, in an empty temp folder, with API key variables removed. It never reads login files. This works only when the app runs on the trader's own computer; other providers take a key.

**Read this chart** sends a real screenshot of the chart. The high and low of the visible chart are held back from the facts it's given, and it's asked to read them from the picture. `gradeRead` compares its answers with the real bars, and an answer that misreads them is marked as untrustworthy. The picture, prompt and checks are all shown.

## Backtest mode

The Live | Backtest switch in Vision's header turns the page cyan and swaps the live charts for three sections. Nothing in backtest mode touches the paper book, the trade history or a broker.

### Strategy test

Set up in three steps on the right:

1. **Market**: symbol, data source, timeframe, period, start balance (5K–150K) and the entry session (Entire day, Asia 7 pm–2 am, London 3–8 am, New York 9:30–4, NY open 9:30–11:30, all New York time; Asia wraps past midnight).
2. **Strategy**: one of the Vision readers, or **your words**. Plain English is parsed by `src/lib/vision/custom.ts` into named rules (entry, stop, target, trend filter, session, trades a day, break-even) that are read back on cards and can be edited in place. The parser is deterministic and lists sentences it could not use. Entries: break and retest of the prior day's high/low, a sweep of it, opening range breakout, VWAP cross, EMA cross, fair value gap retest, RSI reversal, break of structure (CHoCH/BOS), or any Vision reader with its own or your stop and target.
3. **Risk & rules**: direction, fixed contracts or whole contracts sized to a % of the balance, costs, max hold, break-even, trades a day, FOMC/early-close/VIX filters, and **prop firm mode**.

`src/lib/vision/backtest.ts` runs it in a worker, one position at a time. Entry at the signal bar's close plus slippage; stop and target on whole ticks; the stop wins a bar that touches both; break-even moves the stop from the bar after the trigger; a time exit after the max hold; commission per contract. Each trade records MAE/MFE in R and its duration.

Each report opens with **Against a coin flip**: the same entries, stops, targets and costs with the side picked at random 1,000 times, and **How to improve it** (`src/lib/vision/doctor.ts`): changes that help on the older 70% of trades and also on the newer 30%, some applying with a click, with tips worked out from the run. The Coin flip strategy under Your words tests the coin alone.

The report: net P&L, profit factor, win rate and drawdown as a share of the balance; Sharpe, Sortino and Calmar from daily P&L; long and short; best entry time; a metrics table; equity and drawdown; monthly or yearly P&L; each Vision strategy on its own; breakdowns by 30-minute slot, hour, weekday, month, strategy, side, exit, VIX and FOMC. `src/lib/vision/verdict.ts` writes the **edge verdict** and a 0–100 edge score from the trades alone: the expectancy's t-stat, both halves of the period, green months and how much the best two carried, a 600-run bootstrap of final P&L and drawdown, and what to fix before sizing up.

Every trade is in the log with a running balance. Tapping one plots it: Vision's own marks on the run's timeframe, or the entry, exit, risk and reward boxes on 1m–1h (lower timeframes come from the library), the heat/run-up ruler, tags and notes (kept with the run when saved), ← / → to step, and "Replay from here".

**Prop firm mode** (`src/lib/vision/prop.ts`) grades the trades with Proving Ground's evaluator (`src/lib/proving/firms.ts`): from the first day, then started on every trading day (pass, blown and still going), median days to pass, evaluation cost per funded account, funded payout odds from `careerOdds`, pass odds for each contract count, and the same trades at every firm's account of that size.

### Prop firm desk

Named practice accounts at any firm, or your own money at a broker, tested by hand, by strategy or both. Each account has two clear modes, **I trade it** and **It trades for me**; every trade and day is labelled, and each side keeps its own record. Today's game plan shows the largest size, stop-for-the-day level, best-day limit and losses left from where the account stands. New accounts are set up in four steps (firm, account, market and start, name). Contracts and risk are chosen on the account, next to the buttons that trade it.

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

**Limits** (`src/lib/vision/limits.ts`): risk per trade as a share of the drawdown, by account type and market (funded 20%, evaluations 30% so risking more can be tested, gold 10% everywhere by default), live risk as a share of the balance, the consistency rule to assume on funded accounts, trading hours and days, and news days to sit out. Studies, Autopilot, strategy runs and replay all obey them, and changing them re-runs studies.

**Money** (`src/lib/vision/economics.ts`): `life` follows a year at a firm in dollars: fees, renewals, activation, failures, the funded stretch and payouts, from many start dates. It ranks firms by what reaches the trader and compares evaluation risk levels with straight-to-funded accounts. Activation fees and payout caps are in `firmExtras` where known; the source is shown, and unknowns count as $0 and say so.

**Proof**: the stress test re-deals the days, adds slippage, misses one winner in ten and randomises direction to measure luck. The health alarm compares the last 40 trades with the strategy's past stretches. News days uses CPI and jobs dates from the St. Louis Fed (`econ-calendar.ts`) with FOMC. One-second bars (NQ, Jul 24 to Oct 23, 2026) audit whether stop or target came first. These run on a study's current strategy.

**You vs. the machine** compares your hand trades with the plan on the same days and prices each habit: off-plan trades, skipped signals, early exits, oversizing and exits past the stop. **The prop game** states what the numbers say about the account's rules. **Several accounts** starts copies, or NQ, ES and gold together, on the same days. **Firm rule check** flags rules that are old, disputed or never confirmed.

**Strategy scout** (`src/lib/vision/scout.ts`): ideas from papers and books as rules, on NQ, ES and gold, judged on the newest 30% of trades. Recommended needs positive results on old and new data, a t-stat of 2 on the new, 60% of years green and a pass rate above no edge. Ideas you add join the variants. `npm run lab:scout` runs it; `library/lab/scout-candidates.json` holds additions, which a weekly task can append to.

**Live money**: `live:<balance>:<stop %>` programs have no target or firm rules, only your stop and common day margin. Its lab compounds a strategy from $1,000 to $50,000 at each risk level, shows what share of signals a small balance can't take, and compares a year with the best prop account on the same trades. No real orders are placed.

Not modelled: news bans, firm-specific payout calendars, taxes and fills in fast markets. Fees are $1.04 a micro and $3.64 a full contract round trip; stops and entries lose a tick.

### Faster testing

- **Quick bar** (⌘K) on Strategy test: one line such as `nq 5m orb ny open 1y 50k lucid 2 micros` (`src/lib/vision/quick.ts`). What it understood shows as chips; words it didn't use are listed; anything left is read as your rules.
- **Run everywhere**: the current strategy on NQ, ES and GC × 5m, 15m × Asia, London, NY open and New York, one after another, cancellable. With 24 tests the best cell is partly luck, so a cell is outlined only when it holds on both halves and clears the bar for 24 tests.
- **Setup gallery**: every trade as a small chart, filtered by outcome, side, session, month and grade. Arrows move, 1 2 3 grade A, B, C into the trade journal, Enter opens the trade; a strip compares each grade's results with all trades.
- **Presets** save settings by name; "Re-run all" runs each on the current data and says what changed since last time.
- **Backtest this** from the copilot, any Discover row or the strategy menu opens Strategy test with that idea and runs it; "See examples" opens the gallery and "Practise" the drill. The copilot can also test an idea on the bars loaded, labelled with how few they are.

### Replay

Bar-by-bar playback with the future hidden, from any date, up to 25×: market, limit and stop orders filled against each new bar, take profit in R, stop in points, fixed or %-risk sizing, auto break-even at +1R, a synced higher-timeframe chart, Vision's marks as setups form, and "Where it formed", the sessions where the strategy fired. In prop firm mode the drawdown (trailing intraday, end of day or static), daily loss limit and target run live. Guided scenarios pick a setup, market and session and offer months to practise. Every fill can be tagged; sessions save to the Library. **Random day** (R) jumps to a session where the strategy formed. **Drill** shows twenty setups up to the bar they triggered on with the plan drawn: take (T) or skip (K), see the outcome, and at the end your picks against taking all of them and the calls that cost most.

### Library

`src/lib/server/library/`, `/api/library/*`. Files dropped in the browser or added by a path or a whole folder in the home folder, kept on this machine under `~/.tradepilot/library/` (`TRADEPILOT_DATA_DIR` moves it). It sits outside the checkout so a fresh clone or worktree keeps it. The prices are not in this repository: Databento's licence covers the account holder's own use and this repository is public. `data/library-manifest.json` records what should be there (ranges, bar counts, checksums); restore with `npm run data:import -- <folder>` on Node 22 or newer.

A full-size contract is joined with its micro (NQ with MNQ, ES with MES, GC with MGC) wherever its own file has no bars. Back-month series (`.v.1`) are ignored. Originals download unchanged. OHLCV CSVs (Databento `ts_event` or `ts_utc` with `continuous`, or plain time/open/high/low/close/volume) become 1-minute series per symbol, stored per year; 1-second bars fold into minutes. Split zips (`.part00`/`.part01` onward) join once they read as a whole zip, and a zip of parts or zips (a Google Drive download) is unpacked first. The free-data pack supplies FOMC days, CME early closes and holidays, and VIX. Saved runs and sessions download as CSV or JSON. A run loads at most 400,000 bars (about five years of 5-minute bars); longer periods keep the latest.

Databento's continuous contracts are front month by volume and not back-adjusted, so a trade over a roll can see the roll's price step. Without library data, history comes from the free feeds: Yahoo for futures (about 60 days of 5-minute bars) and Coinbase for crypto.

## What the deep studies found (November 2026)

Run on the library (NQ, ES and gold, 2010 to 2026, 5m and 15m, micro fees and a tick of slippage): nothing is Proven on any market. The best newest-data t-stats were just under 2 (the narrow day breakout on ES 15m at 2.0, the one-hour range with trend on NQ 15m at 1.9), against a bar near 3.3 for 51 ideas. The five readers are negative after costs on micros; ideas with tight stops suffer most, since a fixed fee is a large share of a small risk. On NQ and ES, sweeps the other index did not confirm did no better than the rest (NQ 5m: −0.31R a trade over 12,347 against −0.21R over 18,524 when ES confirmed). Re-run the study as data is added; the badges will say if anything changes.

## Not verified

The Pine Script has not been compiled in TradingView, and broker bars and orders have not been run against a live login. Test both before relying on them.
