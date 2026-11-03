// What Vision can chart, and where each market's bars come from.
//
// Crypto: Coinbase Exchange's public API (candles over REST, ticks over its
// WebSocket), real time and keyless. Futures: the trader's own broker feed
// (Tradovate or TopstepX) when one is connected in Proving Ground → Live,
// otherwise Yahoo's delayed bars, labelled as delayed.

export type MarketKind = "crypto" | "futures";
export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h";
export type VisionSymbolId = "BTC" | "ETH" | "SOL" | "XRP" | "NQ" | "ES" | "GC" | "CL";

export interface VisionSymbol {
  id: VisionSymbolId;
  kind: MarketKind;
  label: string;
  name: string;
  /** Coinbase product, or Yahoo continuous contract. */
  source: string;
  /** Broker contract roots, full size and micro. */
  roots?: { full: string; micro: string };
  /** Dollars per 1.0 price move per contract: full size and micro. */
  pointValue?: { full: number; micro: number };
  tick: number;
  decimals: number;
  color: string;
}

export const SYMBOLS: Record<VisionSymbolId, VisionSymbol> = {
  BTC: { id: "BTC", kind: "crypto", label: "BTC/USD", name: "Bitcoin", source: "BTC-USD", tick: 0.01, decimals: 2, color: "#F7931A" },
  ETH: { id: "ETH", kind: "crypto", label: "ETH/USD", name: "Ethereum", source: "ETH-USD", tick: 0.01, decimals: 2, color: "#8C8CFF" },
  SOL: { id: "SOL", kind: "crypto", label: "SOL/USD", name: "Solana", source: "SOL-USD", tick: 0.01, decimals: 2, color: "#14F195" },
  XRP: { id: "XRP", kind: "crypto", label: "XRP/USD", name: "XRP", source: "XRP-USD", tick: 0.0001, decimals: 4, color: "#9AA4B2" },
  NQ: { id: "NQ", kind: "futures", label: "NQ", name: "Nasdaq 100", source: "NQ=F", roots: { full: "NQ", micro: "MNQ" }, pointValue: { full: 20, micro: 2 }, tick: 0.25, decimals: 2, color: "#3B82F6" },
  ES: { id: "ES", kind: "futures", label: "ES", name: "S&P 500", source: "ES=F", roots: { full: "ES", micro: "MES" }, pointValue: { full: 50, micro: 5 }, tick: 0.25, decimals: 2, color: "#EF4444" },
  GC: { id: "GC", kind: "futures", label: "GC", name: "Gold", source: "GC=F", roots: { full: "GC", micro: "MGC" }, pointValue: { full: 100, micro: 10 }, tick: 0.1, decimals: 1, color: "#EAB308" },
  CL: { id: "CL", kind: "futures", label: "CL", name: "Crude oil", source: "CL=F", roots: { full: "CL", micro: "MCL" }, pointValue: { full: 1000, micro: 100 }, tick: 0.01, decimals: 2, color: "#A3A3A3" },
};

export const BY_KIND: Record<MarketKind, VisionSymbolId[]> = {
  crypto: ["BTC", "ETH", "SOL", "XRP"],
  futures: ["NQ", "ES", "GC", "CL"],
};

export const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "4h"];
export const TF_SECONDS: Record<Timeframe, number> = { "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400 };

export const isSymbol = (s: string): s is VisionSymbolId => Object.hasOwn(SYMBOLS, s);
export const isTimeframe = (s: string): s is Timeframe => (TIMEFRAMES as string[]).includes(s);

export function formatPrice(sym: VisionSymbol, n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: sym.decimals, maximumFractionDigits: sym.decimals });
}

/** Merge bars into a longer timeframe, aligned to UTC boundaries. */
export function aggregate<T extends { t: number; o: number; h: number; l: number; c: number; v: number }>(bars: T[], seconds: number) {
  const out: { t: number; o: number; h: number; l: number; c: number; v: number }[] = [];
  for (const b of bars) {
    const t = Math.floor(b.t / seconds) * seconds;
    const last = out[out.length - 1];
    if (last && last.t === t) {
      last.h = Math.max(last.h, b.h);
      last.l = Math.min(last.l, b.l);
      last.c = b.c;
      last.v += b.v;
    } else out.push({ t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v });
  }
  return out;
}
