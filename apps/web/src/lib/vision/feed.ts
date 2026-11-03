"use client";

// Bars and live prices for Vision, in the browser.
//
// Crypto comes straight from Coinbase Exchange: candles over REST (CORS-open,
// no key) and every trade over one shared WebSocket on the ticker channel.
// Futures come from /api/vision/bars, which prefers the trader's broker feed.

import { useEffect, useRef, useState } from "react";
import type { Bar } from "@/lib/pilot/market";
import { SYMBOLS, TF_SECONDS, aggregate, type VisionSymbolId, type Timeframe, type MarketKind, BY_KIND } from "./markets";

export type FeedSource = "coinbase" | "tradovate" | "projectx" | "yahoo";

export interface Feed {
  bars: Bar[];
  source: FeedSource | null;
  delayed: boolean;
  contract: string | null;
  loading: boolean;
  error: string;
  note: string;
  /** ms of the last price update. */
  lastTick: number;
}

const COINBASE = "https://api.exchange.coinbase.com";
const GRANULARITY: Record<Timeframe, number> = { "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 3600 };

async function coinbaseCandles(product: string, tf: Timeframe, pages = 4): Promise<Bar[]> {
  const g = GRANULARITY[tf];
  let end = Math.floor(Date.now() / 1000);
  const rows: number[][] = [];
  for (let p = 0; p < (tf === "4h" ? Math.max(5, pages) : pages); p++) {
    const start = end - g * 300;
    const res = await fetch(`${COINBASE}/products/${product}/candles?granularity=${g}&start=${new Date(start * 1000).toISOString()}&end=${new Date(end * 1000).toISOString()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Coinbase returned ${res.status}`);
    rows.push(...((await res.json()) as number[][]));
    end = start;
  }
  const bars = rows
    .map(([t, l, h, o, c, v]) => ({ t, o, h, l, c, v }))
    .sort((a, b) => a.t - b.t)
    .filter((b, i, a) => !i || a[i - 1].t !== b.t);
  return tf === "4h" ? aggregate(bars, TF_SECONDS["4h"]) : bars;
}

async function serverBars(symbol: VisionSymbolId, tf: Timeframe) {
  const res = await fetch(`/api/vision/bars?symbol=${symbol}&tf=${tf}`, { cache: "no-store" });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || "Bars unavailable");
  const bars: Bar[] = j.t.map((t: number, i: number) => ({ t, o: j.o[i], h: j.h[i], l: j.l[i], c: j.c[i], v: j.v[i] }));
  return { bars, source: j.source as FeedSource, delayed: !!j.delayed, contract: (j.contract as string) ?? null, note: (j.note as string) ?? "" };
}

/** As much history as the free feeds hold, for backtests: ~9,000 bars of crypto, Yahoo's limits for futures. */
export async function loadHistory(symbol: VisionSymbolId, tf: Timeframe): Promise<Bar[]> {
  const sym = SYMBOLS[symbol];
  if (sym.kind === "crypto") return coinbaseCandles(sym.source, tf, 30);
  const res = await fetch(`/api/vision/bars?symbol=${symbol}&tf=${tf}&long=1&max=30000`, { cache: "no-store" });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || "Bars unavailable");
  return j.t.map((t: number, i: number) => ({ t, o: j.o[i], h: j.h[i], l: j.l[i], c: j.c[i], v: j.v[i] }));
}

export async function loadBars(symbol: VisionSymbolId, tf: Timeframe, pages = 4) {
  const sym = SYMBOLS[symbol];
  if (sym.kind === "crypto") return { bars: await coinbaseCandles(sym.source, tf, pages), source: "coinbase" as FeedSource, delayed: false, contract: null, note: "" };
  return serverBars(symbol, tf);
}

// ─── Coinbase ticker socket ────────────────────────────────────────────────────

type Tick = { price: number; size: number; time: number; open24h?: number };
type Listener = (t: Tick) => void;

class CoinbaseTicker {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<Listener>>();
  private retry = 1000;
  private timer: ReturnType<typeof setTimeout> | null = null;

  subscribe(product: string, fn: Listener) {
    const set = this.listeners.get(product) ?? new Set();
    set.add(fn);
    this.listeners.set(product, set);
    if (this.ws?.readyState === 1 && set.size === 1) this.send([product]);
    this.ensure();
    return () => {
      set.delete(fn);
      if (!set.size) {
        this.listeners.delete(product);
        if (this.ws?.readyState === 1) this.ws.send(JSON.stringify({ type: "unsubscribe", product_ids: [product], channels: ["ticker"] }));
      }
    };
  }

  private send(products: string[]) {
    if (products.length) this.ws?.send(JSON.stringify({ type: "subscribe", product_ids: products, channels: ["ticker"] }));
  }

  private ensure() {
    if (this.ws || typeof WebSocket === "undefined") return;
    const ws = new WebSocket("wss://ws-feed.exchange.coinbase.com");
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 1000;
      this.send([...this.listeners.keys()]);
    };
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(String(ev.data));
        if (m.type !== "ticker") return;
        const tick = { price: Number(m.price), size: Number(m.last_size) || 0, time: Date.parse(m.time) || Date.now(), open24h: Number(m.open_24h) || undefined };
        this.listeners.get(m.product_id)?.forEach((fn) => fn(tick));
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onclose = () => {
      this.ws = null;
      if (!this.listeners.size) return;
      this.timer = setTimeout(() => this.ensure(), this.retry);
      this.retry = Math.min(this.retry * 2, 15_000);
    };
    ws.onerror = () => ws.close();
  }
}

const ticker: CoinbaseTicker = ((globalThis as Record<string, unknown>).__tpCoinbaseTicker ??= new CoinbaseTicker()) as CoinbaseTicker;
export const subscribeTicks = (product: string, fn: Listener) => ticker.subscribe(product, fn);

/** Fold one trade into the bar series: extend the forming bar or start the next one. */
export function applyTick(bars: Bar[], tick: { price: number; size: number; time: number }, tfSeconds: number): Bar[] {
  if (!bars.length) return bars;
  const t = Math.floor(tick.time / 1000 / tfSeconds) * tfSeconds;
  const last = bars[bars.length - 1];
  if (t < last.t) return bars;
  if (t === last.t) {
    const next = { ...last, h: Math.max(last.h, tick.price), l: Math.min(last.l, tick.price), c: tick.price, v: last.v + tick.size };
    return [...bars.slice(0, -1), next];
  }
  return [...bars, { t, o: last.c, h: Math.max(last.c, tick.price), l: Math.min(last.c, tick.price), c: tick.price, v: tick.size }];
}

// ─── Hooks ─────────────────────────────────────────────────────────────────────

/** Bars for one chart, kept live: ticks for crypto, polling for futures. */
export function useFeed(symbol: VisionSymbolId, tf: Timeframe): Feed {
  const [feed, setFeed] = useState<Feed>({ bars: [], source: null, delayed: false, contract: null, loading: true, error: "", note: "", lastTick: 0 });
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    const sym = SYMBOLS[symbol];
    setFeed((f) => ({ ...f, bars: [], loading: true, error: "" }));
    const load = async (first: boolean) => {
      try {
        const r = await loadBars(symbol, tf);
        if (!live.current) return;
        setFeed((f) => {
          // Keep the forming bar the socket has been building if REST is behind it.
          const prevLast = f.bars[f.bars.length - 1];
          const bars = !first && prevLast && r.bars.length && prevLast.t > r.bars[r.bars.length - 1].t ? [...r.bars, prevLast] : r.bars;
          return { ...f, ...r, bars, loading: false, error: "", lastTick: first ? Date.now() : f.lastTick || Date.now() };
        });
      } catch (e) {
        if (live.current) setFeed((f) => ({ ...f, loading: false, error: e instanceof Error ? e.message : "Bars unavailable" }));
      }
    };
    load(true);
    let unsub = () => {};
    let poll: ReturnType<typeof setInterval>;
    if (sym.kind === "crypto") {
      unsub = subscribeTicks(sym.source, (tick) => setFeed((f) => ({ ...f, bars: applyTick(f.bars, tick, TF_SECONDS[tf]), lastTick: Date.now() })));
      poll = setInterval(() => load(false), 60_000);
    } else {
      poll = setInterval(() => load(false), 15_000);
    }
    return () => {
      live.current = false;
      unsub();
      clearInterval(poll);
    };
  }, [symbol, tf]);
  return feed;
}

export interface TickerRow {
  id: VisionSymbolId;
  price: number | null;
  changePct: number | null;
  spark: number[];
  delayed: boolean;
}

/** The strip of four markets at the top: price, 24h change and a sparkline. */
export function useTickers(kind: MarketKind): TickerRow[] {
  const ids = BY_KIND[kind];
  const [rows, setRows] = useState<Record<string, TickerRow>>({});
  useEffect(() => {
    let alive = true;
    const set = (id: VisionSymbolId, patch: Partial<TickerRow>) =>
      alive && setRows((r) => ({ ...r, [id]: { ...(r[id] ?? { id, price: null, changePct: null, spark: [], delayed: false }), ...patch } }));
    const load = () =>
      ids.forEach(async (id) => {
        try {
          const r = await loadBars(id, "1h", 1);
          const last = r.bars[r.bars.length - 1];
          const dayAgo = r.bars.find((b) => b.t >= last.t - 86_400) ?? r.bars[0];
          set(id, { price: last.c, changePct: ((last.c - dayAgo.o) / dayAgo.o) * 100, spark: r.bars.slice(-36).map((b) => b.c), delayed: r.delayed });
        } catch {
          /* leave the card as it was */
        }
      });
    load();
    const poll = setInterval(load, kind === "crypto" ? 120_000 : 30_000);
    const unsubs =
      kind === "crypto"
        ? ids.map((id) =>
            subscribeTicks(SYMBOLS[id].source, (t) =>
              set(id, { price: t.price, ...(t.open24h ? { changePct: ((t.price - t.open24h) / t.open24h) * 100 } : {}) }),
            ),
          )
        : [];
    return () => {
      alive = false;
      clearInterval(poll);
      unsubs.forEach((u) => u());
    };
    // ids is a constant per kind.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);
  return ids.map((id) => rows[id] ?? { id, price: null, changePct: null, spark: [], delayed: false });
}
