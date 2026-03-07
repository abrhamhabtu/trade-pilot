# Backtest Replay Foundation

## Goal
Build a futures-first replay workspace that moves TradePilot beyond manual trade logging and toward a TradeZella-style replay product.

## V1
- Futures only
- 1-minute candle replay
- Provider adapter with free/testing and paid-ready modes
- Three-panel replay workspace
- Manual executions synced to replay time
- Trade/day/notes journal side panel

## Architecture
- `src/lib/backtest/replay.ts`
  - replay types
  - symbol normalization
  - playback helpers
- `src/lib/backtest/providers.ts`
  - provider interface
  - mock free provider
  - Databento placeholder adapter
- `src/hooks/useReplaySession.ts`
  - candle loading
  - playback cursor
  - selection sync
- `src/components/backtest/ReplayChart.tsx`
  - v1 replay chart surface

## Deferred
- Tick replay
- Multi-chart layouts
- Risk/order widgets
- Event overlays
- Rich simulation orders
- Paid provider implementation

## Provider Strategy
- Start with deterministic mock candles for UX development.
- Preserve the adapter boundary so a paid futures provider can replace the mock path later.
- Keep cache keys stable by symbol/date/timeframe/provider.
