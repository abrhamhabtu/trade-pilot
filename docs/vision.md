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

## Not verified

The Pine Script has not been compiled in TradingView, and broker bars and orders have not been run against a live login. Test both before relying on them.
