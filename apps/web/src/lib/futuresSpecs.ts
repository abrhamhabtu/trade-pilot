// CME contract specs used by the position sizer and the TradingView toolkit.
// pointValue = tickValue / tick.

export interface FuturesSpec {
  symbol: string;
  name: string;
  tick: number; // minimum price increment
  tickValue: number; // $ per tick per contract
  micro: boolean;
}

export const FUTURES: FuturesSpec[] = [
  { symbol: 'MNQ', name: 'Micro Nasdaq-100', tick: 0.25, tickValue: 0.5, micro: true },
  { symbol: 'MES', name: 'Micro S&P 500', tick: 0.25, tickValue: 1.25, micro: true },
  { symbol: 'MYM', name: 'Micro Dow', tick: 1, tickValue: 0.5, micro: true },
  { symbol: 'M2K', name: 'Micro Russell 2000', tick: 0.1, tickValue: 0.5, micro: true },
  { symbol: 'MGC', name: 'Micro Gold', tick: 0.1, tickValue: 1, micro: true },
  { symbol: 'MCL', name: 'Micro Crude Oil', tick: 0.01, tickValue: 1, micro: true },
  { symbol: 'NQ', name: 'E-mini Nasdaq-100', tick: 0.25, tickValue: 5, micro: false },
  { symbol: 'ES', name: 'E-mini S&P 500', tick: 0.25, tickValue: 12.5, micro: false },
];

export const specFor = (symbol: string) =>
  FUTURES.find((f) => f.symbol === symbol) ?? FUTURES[0];

export const pointValue = (s: FuturesSpec) => s.tickValue / s.tick;

/** Round a price distance to the instrument's tick grid, in ticks. */
export const toTicks = (points: number, s: FuturesSpec) =>
  Math.round(points / s.tick);

export function sizePosition(opts: {
  spec: FuturesSpec;
  riskDollars: number;
  stopPoints: number;
  targetR: number;
}) {
  const { spec, riskDollars, stopPoints, targetR } = opts;
  const pv = pointValue(spec);
  const riskPerContract = stopPoints * pv;
  const contracts =
    riskPerContract > 0 ? Math.floor(riskDollars / riskPerContract) : 0;
  const targetPoints = stopPoints * targetR;
  return {
    pv,
    riskPerContract,
    contracts,
    actualRisk: contracts * riskPerContract,
    targetPoints,
    targetDollars: contracts * targetPoints * pv,
    stopTicks: toTicks(stopPoints, spec),
    targetTicks: toTicks(targetPoints, spec),
  };
}

/** Parse "1:2.5" → 2.5 */
export const parseR = (rr: string) => parseFloat(rr.split(':')[1] || '2') || 2;
