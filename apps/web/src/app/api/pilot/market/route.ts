import { NextResponse } from "next/server";
import {
  calendarEvents,
  nyClock,
  quoteSource,
  readMarket,
  rootSymbol,
  scheduledEvents,
  type MacroEvent,
  type MarketRead,
  type VixRead,
} from "@/lib/pilot/market";
import { cached, yahooBars } from "@/lib/pilot/yahoo";
export const runtime = "nodejs";

const QUOTE_TTL = 60_000;
const CALENDAR_TTL = 60 * 60_000;
const CALENDAR_FAIL_TTL = 10 * 60_000;
const CALENDAR_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

async function vixRead(): Promise<VixRead | null> {
  return cached("vix", QUOTE_TTL, async () => {
    const { bars, meta } = await yahooBars("^VIX", "1d", "5d");
    const level = meta.regularMarketPrice ?? bars[bars.length - 1]?.c;
    const prev = bars.length > 1 ? bars[bars.length - 2].c : meta.chartPreviousClose;
    if (!Number.isFinite(level)) throw new Error("No VIX");
    return {
      level: Math.round(level! * 100) / 100,
      changePct: prev ? Math.round(((level! - prev) / prev) * 1000) / 10 : null,
    };
  }).catch(() => null);
}

async function events(date: string): Promise<{ events: MacroEvent[]; live: boolean }> {
  try {
    const rows = await cached(
      "calendar",
      CALENDAR_TTL,
      async () => {
        const res = await fetch(CALENDAR_URL, {
          headers: { "User-Agent": "Mozilla/5.0 (TradePilot self-hosted)" },
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok || !res.headers.get("content-type")?.includes("json"))
          throw new Error("Calendar unavailable");
        return res.json();
      },
      CALENDAR_FAIL_TTL,
    );
    if (rows) return { events: calendarEvents(rows, date), live: true };
  } catch {
    /* fall through to the schedule */
  }
  return { events: scheduledEvents(date), live: false };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const roots = [
    ...new Set(
      (params.get("symbols") || "NQ")
        .split(",")
        .map((s) => rootSymbol(s))
        .filter((s) => quoteSource(s)),
    ),
  ].slice(0, 4);
  const today = nyClock(Date.now()).date;
  const [vix, calendar] = await Promise.all([vixRead(), events(today)]);
  const markets: MarketRead[] = [];
  const errors: string[] = [];
  await Promise.all(
    roots.map(async (root) => {
      const { source } = quoteSource(root)!;
      try {
        const bars = await cached(`bars:${source}`, QUOTE_TTL, async () => {
          const { bars } = await yahooBars(source, "5m", "5d");
          if (!bars.length) throw new Error("No bars");
          return bars;
        });
        const read = bars && readMarket(root, bars, vix);
        if (read) markets.push(read);
        else errors.push(`${root}: no recent bars`);
      } catch {
        errors.push(`${root}: quote source unavailable`);
      }
    }),
  );
  markets.sort((a, b) => roots.indexOf(a.symbol) - roots.indexOf(b.symbol));
  return NextResponse.json({
    today,
    markets,
    vix,
    events: calendar.events,
    eventsLive: calendar.live,
    errors,
    asOf: Date.now(),
  });
}
