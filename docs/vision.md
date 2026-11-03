# Vision

Vision lives at `/app/vision`. It reads a live chart, marks a liquidity sweep and reversal when one forms, and shows how that setup has done on the loaded history.

## Markets and data

- **Crypto** (BTC, ETH, SOL, XRP): Coinbase Exchange. Candles over REST and every trade over its WebSocket ticker, in real time, with no key.
- **Futures** (NQ, ES, gold, crude): the broker connected in Proving Ground → Live (Tradovate or TopstepX) gives real-time bars. Without one, Yahoo's continuous contracts are used and labelled as about 10 minutes delayed. Tradovate's feed holds a few days, so it is laid over Yahoo's older history.

Timeframes are 1m, 5m, 15m, 1h and 4h (4h is built from hourly bars). One or two charts can be shown side by side.

## The reader (`src/lib/vision/analyze.ts`)

Only closed bars are read. A long fires when a confirmed swing low is wicked through, price closes back above it, and confirms by closing above the 21 EMA or with momentum turning up on a green close. Shorts mirror this at swing highs. The stop sits under (over) the sweep, the target is the next opposite swing at 1.2R or more (else 2R, capped at 4R).

The market scan reports structure (higher highs and lows, or lower), the nearest unswept liquidity, buy versus sell volume over 20 bars, and RSI/EMA momentum including divergence.

**Historical matches** are the same detector run over every earlier bar in the loaded history, each replayed forward (up to 48 bars) to see whether the target or the stop came first. The stop wins a bar that touches both. The hit rate and the edge in R per trade are shown only with at least 8 decided matches; otherwise the setup is marked as too few to rate. The projection cone is the 25th–75th percentile path of those matches, scaled to the current setup's risk.

**Replay** walks the latest real setup forward bar by bar so the whole sequence can be watched. Nothing can be traded during a replay.

## Trading

Trades are on paper by default: crypto sizes to a dollar risk per trade, futures to a contract count (micro or full). Auto-execute takes only fresh setups whose history meets the minimum hit rate and, by default, a positive edge.

Real futures orders go through `POST /api/vision/execute` after arming a venue for the day: a typed `ARM`, confirmation that the firm allows automated trading, an account, and a contract cap. Orders are market entries with a broker-held stop and target. Venues implement `ExecutionVenue` in `src/lib/server/vision/venues.ts`; Tradovate and TopstepX are there now, and a crypto exchange plugs in the same way.

## Extras

- **Pine Script**: the same reader as a TradingView Pine v6 indicator, with numbered steps, the plan and alerts whose JSON the TradePilot webhook accepts.
- **Second read**: with a model connected in Pilot AI settings, the Copilot can ask it for a short take using only the computed facts.

## Not verified

The Pine Script has not been compiled in TradingView, and broker bars and orders have not been run against a live login. Test both before relying on them.
