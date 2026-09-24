// Server-only: free, keyless intraday bars. Both sources rate-limit, so every
// answer is cached in the server process and a failure is cached too — a
// refresh storm must not turn into a ban.
import type { Bar } from "./market";

type Cached<T> = { at: number; ttl: number; value: T };
const cache: Map<string, Cached<unknown>> = ((globalThis as Record<string, unknown>).__tpMarketCache ??= new Map()) as Map<
  string,
  Cached<unknown>
>;

export async function cached<T>(key: string, ttl: number, load: () => Promise<T>, failTtl = ttl) {
  const hit = cache.get(key) as Cached<T> | undefined;
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value;
  try {
    const value = await load();
    cache.set(key, { at: Date.now(), ttl, value });
    return value;
  } catch (error) {
    cache.set(key, { at: Date.now(), ttl: failTtl, value: null });
    throw error;
  }
}

export async function yahooBars(source: string, interval: string, range: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(source)}?interval=${interval}&range=${range}&includePrePost=true`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (TradePilot self-hosted)" },
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Quote source answered ${res.status}`);
  const json = await res.json();
  const r = json?.chart?.result?.[0];
  const q = r?.indicators?.quote?.[0];
  if (!r || !q || !Array.isArray(r.timestamp)) throw new Error("No bars");
  const bars: Bar[] = [];
  r.timestamp.forEach((t: number, i: number) => {
    const b = { t, o: q.open?.[i], h: q.high?.[i], l: q.low?.[i], c: q.close?.[i], v: q.volume?.[i] ?? 0 };
    if ([b.o, b.h, b.l, b.c].every((x) => typeof x === "number")) bars.push(b as Bar);
  });
  return { bars, meta: r.meta as { chartPreviousClose?: number; regularMarketPrice?: number } };
}
