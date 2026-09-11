// Per-strategy chart setup and default micro sizing, used by the strategy guide.

export interface TvSetup {
  timeframe: string;
  tools: { name: string; how: string }[];
  alerts: string;
}

export interface SizingDefault {
  symbol: string;
  stopPoints: number; // on the default symbol
  note: string;
}

const VWAP_TOOLS = [
  { name: 'VWAP (built-in)', how: 'Indicators → search “VWAP”. In settings set Anchor Period to Session. Turn on Bands #1 if you want stretch targets.' },
  { name: 'Session breaks', how: 'Chart settings (gear) → tick “Session breaks” so each day’s VWAP reset is obvious.' },
];

const LEVEL_TOOLS = [
  { name: 'Horizontal lines', how: 'Alt/Option + H drops a line at your cursor. Mark prior-day high/low and the overnight high/low before the open.' },
  { name: 'Price labels', how: 'Right-click a line → Settings → Text to name it (e.g. “PDH”) so you know what each level is at a glance.' },
];

export const TV_SETUP: Record<string, TvSetup> = {
  vwap: { timeframe: '5m for trend · 1m–3m to time entries', tools: VWAP_TOOLS, alerts: 'Create an alert on “Crossing VWAP” so you don’t have to stare at the chart.' },
  'vwap-pullback': { timeframe: '5m for trend · 1m–3m to time the bounce', tools: VWAP_TOOLS, alerts: 'Alert on price “Crossing” VWAP — that is your cue to start watching for the bounce candle.' },
  'vwap-reclaim': { timeframe: '5m context · 1m entries', tools: VWAP_TOOLS, alerts: 'Alert on “Crossing Up” VWAP. When it fires, wait for the retest before acting.' },
  'failed-auction': {
    timeframe: '1m–5m (the source uses 1m for the trigger)',
    tools: [
      { name: 'Fixed Range Volume Profile', how: 'Search “Fixed Range” in the drawing tools. Click the session open candle, then the latest candle. Keep Value Area at 70%; show the POC and Value Area lines.' },
      { name: 'Label the three lines', how: 'Drop Alt/Option + H lines on VAH, POC and VAL and name them. The profile updates as volume comes in — re-drag it every 30–60 min.' },
      { name: 'Imbalances (optional)', how: 'Use the rectangle tool to box the last fair value gap near VAL/VAH so the inversion candle is easy to spot.' },
    ],
    alerts: 'Put price alerts on your VAH and VAL lines. No alert = no need to look at the chart.',
  },
  orb: {
    timeframe: '5m (15m range) or 1m for tighter entries',
    tools: [
      { name: 'Opening range box', how: 'Rectangle tool over the first 15 or 30 minutes after 9:30 ET. Extend it right so the high and low stay visible.' },
      ...LEVEL_TOOLS.slice(0, 1),
    ],
    alerts: 'Alerts on the range high and range low. Only act when a candle closes outside.',
  },
  breakout: {
    timeframe: '5m–15m',
    tools: [
      { name: 'Volume', how: 'Indicators → “Volume”. A real breakout candle should be clearly bigger than the recent average.' },
      { name: 'Consolidation box', how: 'Rectangle tool around the range so the breakout level is exact.' },
    ],
    alerts: 'Alert on the box edge. Check volume when it fires.',
  },
  'support-resistance': { timeframe: '15m levels · 5m entries', tools: LEVEL_TOOLS, alerts: 'Alerts 2–3 points before each level so you are ready, not chasing.' },
  'failed-breakout': { timeframe: '5m', tools: LEVEL_TOOLS, alerts: 'Alert on the range high/low. When it fires, wait for a close back inside.' },
  'liquidity-sweep': {
    timeframe: '1m–5m',
    tools: [
      { name: 'Equal highs / lows', how: 'Mark obvious equal highs and lows with Alt/Option + H — that is where stops sit.' },
      ...LEVEL_TOOLS.slice(1),
    ],
    alerts: 'Alert just beyond the equal high/low so you see the sweep as it happens.',
  },
  'order-blocks': {
    timeframe: '15m zones · 1m–5m entries',
    tools: [{ name: 'Rectangle zones', how: 'Box the last opposite candle before the impulse. Extend right until price returns.' }],
    alerts: 'Alert on the top (or bottom) edge of the block.',
  },
  'ict-fvg': {
    timeframe: '5m gaps · 1m entries',
    tools: [{ name: 'Rectangle zones', how: 'Box the gap between candle 1’s wick and candle 3’s wick. Community “FVG” indicators can auto-draw these if you prefer.' }],
    alerts: 'Alert on the near edge of the gap.',
  },
  'mean-reversion': {
    timeframe: '1H–4H',
    tools: [
      { name: 'Bollinger Bands', how: 'Indicators → “Bollinger Bands”, length 20, StdDev 2.' },
      { name: 'RSI', how: 'Indicators → “Relative Strength Index”, length 14. Watch for below 30 / above 70.' },
    ],
    alerts: 'Alert on RSI crossing 30 or 70.',
  },
  'trend-following': {
    timeframe: '4H–Daily',
    tools: [
      { name: 'EMA 20 + EMA 50', how: 'Add “Moving Average Exponential” twice — lengths 20 and 50, different colours.' },
      { name: 'MACD', how: 'Indicators → “MACD” with default settings.' },
    ],
    alerts: 'Alert on EMA 20 crossing EMA 50.',
  },
};

export const SIZING_DEFAULT: Record<string, SizingDefault> = {
  'vwap-pullback': { symbol: 'MNQ', stopPoints: 6, note: 'Playbook: 4–8 NQ points below the VWAP touch.' },
  'vwap-reclaim': { symbol: 'MNQ', stopPoints: 6, note: 'Playbook: 4–8 NQ points beyond the reclaim swing.' },
  vwap: { symbol: 'MNQ', stopPoints: 10, note: 'Stop beyond VWAP — widen on high-volatility days.' },
  'failed-auction': { symbol: 'MNQ', stopPoints: 20, note: 'Pick ONE static stop from your backtest and use it every trade.' },
  'liquidity-sweep': { symbol: 'MNQ', stopPoints: 8, note: 'Playbook: just beyond the sweep wick, often 5–10 pts.' },
  orb: { symbol: 'MNQ', stopPoints: 15, note: 'Stop on the other side of the opening range.' },
};
