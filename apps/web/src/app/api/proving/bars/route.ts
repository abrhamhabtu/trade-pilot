import { NextResponse } from "next/server";
import { cached, yahooBars } from "@/lib/pilot/yahoo";
export const runtime = "nodejs";

// Bars for Proving Ground tests, returned as columns to keep 60 days of
// 5-minute data small on the wire.
const SOURCES = new Set(["NQ=F", "ES=F"]);
const RANGE: Record<string, string> = { "1m": "7d", "2m": "60d", "5m": "60d" };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const source = params.get("source") || "";
  const tf = params.get("tf") || "5m";
  if (!SOURCES.has(source) || !RANGE[tf])
    return NextResponse.json({ error: "Unknown symbol or timeframe." }, { status: 400 });
  // Everything since `from` (unix seconds), minus a little for the prior session's levels.
  const from = Number(params.get("from")) || 0;
  try {
    const bars = await cached(`bars:${source}:${tf}:${RANGE[tf]}`, 55_000, async () => (await yahooBars(source, tf, RANGE[tf])).bars, 20_000);
    if (!bars) throw new Error("No bars");
    const cut = bars.filter((b) => b.t >= from - 4 * 86400);
    return NextResponse.json(
      {
        source,
        tf,
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
  } catch {
    return NextResponse.json({ error: "The market data source is unavailable right now." }, { status: 502 });
  }
}
