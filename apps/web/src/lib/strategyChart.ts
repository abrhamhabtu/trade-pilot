// Generates an annotated candlestick "screenshot" as an SVG data URL for the
// Playbook strategy pages — a horizontal level (S/R or VWAP), an entry marker,
// a stop, and a target, so each strategy gets a real chart instead of a stock photo.

interface Candle { o: number; h: number; l: number; c: number; }

function series(start: number, moves: number[]): Candle[] {
  let price = start;
  return moves.map((m) => {
    const o = price;
    const c = price + m;
    const h = Math.max(o, c) + Math.abs(m) * 0.5 + 1;
    const l = Math.min(o, c) - Math.abs(m) * 0.5 - 1;
    price = c;
    return { o, h, l, c };
  });
}

export interface StrategyChartOpts {
  symbol: string;
  subtitle: string;
  direction: 'Long' | 'Short';
  /** index into the candle series for entry. */
  variant?: number;
}

// A few reusable price paths keyed by variant so different strategies/examples
// look distinct.
const PATHS: number[][] = [
  [6, 4, -3, -8, -6, 2, -2, 3, 9, 7, 11, 8, -3, 7, 10, 6, -2, 8, 11, 6],   // dip then reclaim (long)
  [-4, -6, 5, 9, 7, -3, 8, 6, -10, -7, -5, 3, -9, -6, -8, 4, -7, -9, -6, -4], // pop then fade (short)
  [5, 7, 4, 8, 6, -3, 7, 9, 5, 8, 6, 4, 7, 9, 6, 8, 5, 7, 9, 6],           // clean trend (long)
];

export function buildStrategyChart(opts: StrategyChartOpts): string {
  const { symbol, subtitle, direction, variant = 0 } = opts;
  const candles = series(18250, PATHS[variant % PATHS.length]);

  const W = 720, H = 320, padL = 8, padR = 58, padT = 38, padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const highs = candles.map((c) => c.h);
  const lows = candles.map((c) => c.l);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const span = (max - min) * 1.12 || 1;
  const top = max + span * 0.05;
  const y = (p: number) => padT + ((top - p) / span) * innerH;
  const n = candles.length;
  const slot = innerW / n;
  const cw = slot * 0.58;

  const green = '#30B886';
  const red = '#E5564F';
  const blue = '#6E9BD1';
  const grid = 'rgba(255,255,255,0.05)';
  const textc = '#64748b';

  let bars = '';
  candles.forEach((c, i) => {
    const cx = padL + slot * i + slot / 2;
    const up = c.c >= c.o;
    const col = up ? green : red;
    const bodyTop = Math.min(y(c.o), y(c.c));
    const bodyH = Math.max(Math.abs(y(c.c) - y(c.o)), 1);
    bars += `<line x1="${cx}" y1="${y(c.h)}" x2="${cx}" y2="${y(c.l)}" stroke="${col}" stroke-width="1.2"/>`;
    bars += `<rect x="${cx - cw / 2}" y="${bodyTop}" width="${cw}" height="${bodyH}" fill="${col}" rx="1"/>`;
  });

  let gridLines = '';
  for (let g = 0; g <= 4; g++) {
    const py = padT + (innerH / 4) * g;
    const price = top - (span / 4) * g;
    gridLines += `<line x1="${padL}" y1="${py}" x2="${padL + innerW}" y2="${py}" stroke="${grid}"/>`;
    gridLines += `<text x="${padL + innerW + 6}" y="${py + 4}" fill="${textc}" font-size="11" font-family="ui-sans-serif,system-ui">${price.toFixed(0)}</text>`;
  }

  // Entry near a pivot; pick indices from the path shape.
  const entryIdx = Math.round(n * 0.45);
  const exitIdx = n - 2;
  const entryC = candles[entryIdx];
  const exitC = candles[exitIdx];
  const entryX = padL + slot * entryIdx + slot / 2;
  const exitX = padL + slot * exitIdx + slot / 2;
  const entryY = y(entryC.c);
  const exitY = y(exitC.c);

  // The "level" the strategy reacts off (drawn through the entry zone).
  const levelY = y(entryC.l - 1);
  const stopY = direction === 'Long' ? levelY + 14 : y(entryC.h + 1) - 14;

  const annotations = `
    <line x1="${padL}" y1="${levelY}" x2="${padL + innerW}" y2="${levelY}" stroke="${blue}" stroke-width="1.4" stroke-dasharray="6 4" opacity="0.8"/>
    <text x="${padL + 4}" y="${levelY - 5}" fill="${blue}" font-size="10" font-weight="600" font-family="ui-sans-serif,system-ui">KEY LEVEL</text>
    <line x1="${padL}" y1="${stopY}" x2="${padL + innerW}" y2="${stopY}" stroke="${red}" stroke-width="1" stroke-dasharray="3 3" opacity="0.6"/>
    <text x="${padL + 4}" y="${stopY + (direction === 'Long' ? 12 : -4)}" fill="${red}" font-size="10" font-weight="600" font-family="ui-sans-serif,system-ui">STOP</text>
    <line x1="${entryX}" y1="${entryY}" x2="${exitX}" y2="${exitY}" stroke="${green}" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.85"/>
    <circle cx="${entryX}" cy="${entryY}" r="5.5" fill="#1B1A17" stroke="${green}" stroke-width="2.2"/>
    <circle cx="${exitX}" cy="${exitY}" r="5.5" fill="#1B1A17" stroke="${green}" stroke-width="2.2"/>
    <text x="${entryX}" y="${padT + innerH + 20}" fill="${green}" font-size="10" font-weight="600" font-family="ui-sans-serif,system-ui" text-anchor="middle">ENTRY</text>
    <text x="${exitX}" y="${padT + innerH + 20}" fill="${green}" font-size="10" font-weight="600" font-family="ui-sans-serif,system-ui" text-anchor="middle">TARGET</text>
  `;

  const header = `
    <text x="${padL}" y="22" fill="#e2e8f0" font-size="15" font-weight="700" font-family="ui-sans-serif,system-ui">${symbol}</text>
    <text x="${padL + 56}" y="22" fill="${textc}" font-size="12" font-family="ui-sans-serif,system-ui">${subtitle}</text>
    <rect x="${W - padR - 78}" y="9" width="72" height="18" rx="9" fill="${direction === 'Long' ? 'rgba(48, 184, 134,0.15)' : 'rgba(229, 86, 79,0.15)'}"/>
    <text x="${W - padR - 42}" y="22" fill="${direction === 'Long' ? green : red}" font-size="10" font-weight="700" font-family="ui-sans-serif,system-ui" text-anchor="middle">${direction.toUpperCase()}</text>
  `;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#1B1A17"/>${gridLines}${bars}${annotations}${header}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
