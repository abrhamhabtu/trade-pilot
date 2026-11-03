import { NextResponse } from "next/server";
import type { Bar } from "@/lib/pilot/market";
import { cached, yahooBars } from "@/lib/pilot/yahoo";
import { SYMBOLS, TF_SECONDS, aggregate, isSymbol, isTimeframe, type Timeframe } from "@/lib/vision/markets";
import { localOnly } from "@/lib/server/guard";
import * as px from "@/lib/server/live/projectx";
import * as tv from "@/lib/server/live/tradovate";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Futures bars for Vision. A connected broker (Tradovate or TopstepX) gives
// real-time bars; without one, Yahoo's continuous contract is used and the
// response says it is delayed. Tradovate's feed only holds a few days, so its
// bars are laid over Yahoo's older history.

const YAHOO: Record<Timeframe, { interval: string; range: string }> = {
  "1m": { interval: "1m", range: "5d" },
  "5m": { interval: "5m", range: "10d" },
  "15m": { interval: "15m", range: "30d" },
  "1h": { interval: "60m", range: "90d" },
  "4h": { interval: "60m", range: "1y" },
};
const MAX_BARS = 1500;
const contracts = new Map<string, { at: number; id: string | number; name: string }>();

async function contract(broker: "projectx" | "tradovate", root: string) {
  const key = `${broker}:${root}`;
  const hit = contracts.get(key);
  if (hit && Date.now() - hit.at < 3600_000) return hit;
  const c = broker === "tradovate" ? await tv.frontContract(root) : await px.frontContract(root);
  const out = { at: Date.now(), id: c.id, name: c.name };
  contracts.set(key, out);
  return out;
}

async function yahoo(source: string, tf: Timeframe): Promise<Bar[]> {
  const { interval, range } = YAHOO[tf];
  const bars = await cached(`vision:${source}:${interval}:${range}`, 20_000, async () => (await yahooBars(source, interval, range)).bars, 10_000);
  if (!bars) throw new Error("No bars");
  return tf === "4h" ? aggregate(bars, TF_SECONDS["4h"]) : bars;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const symbol = params.get("symbol") ?? "";
  const tf = params.get("tf") ?? "15m";
  if (!isSymbol(symbol) || SYMBOLS[symbol].kind !== "futures" || !isTimeframe(tf)) return NextResponse.json({ error: "Unknown symbol or timeframe." }, { status: 400 });
  const sym = SYMBOLS[symbol];
  const minutes = TF_SECONDS[tf] / 60;
  // Broker feeds use the trader's own credentials, so only for the local app.
  const local = localOnly(request) === null;
  let source: "tradovate" | "projectx" | "yahoo" = "yahoo";
  let contractName: string | null = null;
  let bars: Bar[] = [];
  let note = "";
  try {
    if (local && (await tv.getSecrets()).sec) {
      const c = await contract("tradovate", sym.roots!.full);
      const live = await tv.minuteBars(c.name, minutes);
      const older = await yahoo(sym.source, tf).catch(() => [] as Bar[]);
      const first = live[0]?.t ?? Infinity;
      bars = [...older.filter((b) => b.t < first), ...live];
      source = "tradovate";
      contractName = c.name;
    } else if (local && (await px.getSecrets()).apiKey) {
      const c = await contract("projectx", sym.roots!.full);
      bars = await px.minuteBars(String(c.id), minutes, Date.now() - Math.min(60, Math.ceil((MAX_BARS * minutes) / 1440) + 3) * 86_400_000);
      source = "projectx";
      contractName = c.name;
    }
  } catch (e) {
    note = `Broker feed unavailable (${e instanceof Error ? e.message : "error"}); showing delayed bars.`;
    bars = [];
    source = "yahoo";
  }
  try {
    if (source === "yahoo") bars = await yahoo(sym.source, tf);
  } catch {
    return NextResponse.json({ error: "The market data source is unavailable right now." }, { status: 502 });
  }
  const cut = bars.slice(-MAX_BARS);
  return NextResponse.json(
    {
      symbol,
      tf,
      source,
      contract: contractName,
      delayed: source === "yahoo",
      note,
      t: cut.map((b) => b.t),
      o: cut.map((b) => b.o),
      h: cut.map((b) => b.h),
      l: cut.map((b) => b.l),
      c: cut.map((b) => b.c),
      v: cut.map((b) => b.v),
      asOf: Date.now(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
