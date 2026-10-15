// The always-on Proving Ground. The browser mirrors its tests here; every
// minute the server replays them on fresh bars with the same deterministic
// engine the page uses, so it reaches the same trades, and it sends an alert
// for each new trade, account event and the end-of-day recap even while no
// browser is open. Results stay in the browser's own copy; this loop only
// watches and tells.

import { RTH_CLOSE, RTH_OPEN, nyClock } from "@/lib/pilot/market";
import { cached, yahooBars } from "@/lib/pilot/yahoo";
import { INSTRUMENTS, STRATEGIES, runSession, toSessions, type DaySim, type StrategyConfig } from "@/lib/proving/engine";
import { programByKey } from "@/lib/proving/firms";
import { career, type CareerEvent } from "@/lib/proving/career";
import { notify } from "./notify";
import { readJson, updateJson, writeJson } from "./store";

export interface ServerTest {
  id: string;
  name: string;
  cfg: StrategyConfig;
  programKey: string;
  startDate: string;
  state: "running" | "paused";
  createdAt: number;
}

export interface TestSummary {
  id: string;
  name: string;
  line: string;
  todayPnl: number;
  net: number;
  status: string;
}

/** Per test: today's trades by exit state, and how many account events were already announced. */
type Seen = Record<string, { trades: Record<string, string>; events: number; date?: string }>;
type Meta = { recap?: string };

export const TESTS_FILE = "proving-tests.json";
const SEEN_FILE = "proving-seen.json";
const META_FILE = "proving-meta.json";
const RANGE: Record<string, string> = { "1m": "7d", "2m": "60d", "5m": "60d" };

export const daemonState: { started: number; lastTick: number; lastError: string; summaries: TestSummary[] } = ((globalThis as Record<string, unknown>).__tpProvingState ??= {
  started: 0,
  lastTick: 0,
  lastError: "",
  summaries: [],
}) as never;

const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const signed = (n: number) => `${n >= 0 ? "+" : "-"}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

const EVENT_TEXT: Partial<Record<CareerEvent["kind"], (e: CareerEvent) => string>> = {
  passed: () => "✅ PASSED the eval. Funded account starts next session.",
  "eval-failed": () => "❌ Eval failed: drawdown hit. A new eval is bought next session.",
  blown: () => "💥 Funded account blown. Back to a new eval.",
  payout: (e) => `💰 PAYOUT: ${money(e.amount)} to you after the split.`,
};

async function bars(source: string, tf: string) {
  return cached(`daemon:${source}:${tf}`, 55_000, async () => (await yahooBars(source, tf, RANGE[tf] ?? "60d")).bars, 20_000);
}

export async function tick(now = Date.now()) {
  const { tests } = await readJson<{ tests: ServerTest[] }>(TESTS_FILE, { tests: [] });
  const seen = await readJson<Seen>(SEEN_FILE, {});
  const meta = await readJson<Meta>(META_FILE, {});
  const clock = nyClock(now);
  const summaries: TestSummary[] = [];
  const recapDue = clock.weekday > 0 && clock.weekday < 6 && clock.minute >= RTH_CLOSE + 10 && meta.recap !== clock.date;

  for (const t of tests) {
    const program = programByKey(t.programKey);
    // TradingView-signal tests need the browser's signal inbox; they run there.
    if (!program || t.state !== "running" || t.cfg.strategy === "tv-signals") continue;
    const spec = INSTRUMENTS[t.cfg.instrument];
    let days: DaySim[];
    try {
      const sessions = toSessions(await bars(spec.source, t.cfg.timeframe)).filter((s) => s.date >= t.startDate && s.rth.length);
      days = sessions.map((s) => runSession(s, t.cfg, { partial: s.date === clock.date && clock.minute < RTH_CLOSE + 5 }));
    } catch (e) {
      daemonState.lastError = e instanceof Error ? e.message : "Bars unavailable";
      continue;
    }
    const life = career(days, program, { contracts: t.cfg.contracts, micro: spec.micro });
    const today = days.find((d) => d.date === clock.date);
    const label = `${t.name} (${STRATEGIES[t.cfg.strategy].short}, ${program.firm} ${program.sizeLabel})`;
    summaries.push({
      id: t.id,
      name: t.name,
      todayPnl: today?.pnl ?? 0,
      net: life.net,
      status: life.status,
      line: `${t.name}: today ${signed(today?.pnl ?? 0)} · life ${signed(life.net)} (${money(life.paidOut)} paid, ${money(life.spent)} spent) · ${life.status === "funded" ? "funded" : life.status === "reset" ? "blown, next queued" : "in eval"}`,
    });

    const prev = seen[t.id];
    const trades = Object.fromEntries((today?.trades ?? []).map((x) => [x.id, x.exit]));
    // The first sighting is a baseline: a test synced mid-life should not
    // replay its whole history as alerts.
    if (prev) {
      for (const x of today?.trades ?? []) {
        const was = prev.trades[x.id];
        if (was === undefined)
          await notify("trades", `📈 ${label}\n${x.side === "long" ? "LONG" : "SHORT"} ${x.qty} ${t.cfg.instrument} @ ${x.entryPx}\nStop ${x.stopPx} · Target ${x.targetPx}\n${x.why}`);
        if ((was === undefined || was === "open") && x.exit !== "open")
          await notify("trades", `${x.pnl >= 0 ? "🟢" : "🔴"} ${label}\nClosed ${signed(x.pnl)} (${x.exit}, ${x.r >= 0 ? "+" : ""}${x.r}R)`);
      }
      for (const ev of life.events.slice(prev.events)) {
        const text = EVENT_TEXT[ev.kind]?.(ev);
        if (text) await notify("accounts", `${label}\n${text}`);
      }
    }
    seen[t.id] = { trades: { ...(prev?.date === clock.date ? prev.trades : {}), ...trades }, events: life.events.length, date: clock.date };
  }

  await writeJson(SEEN_FILE, seen);
  daemonState.summaries = summaries;
  daemonState.lastTick = now;

  if (recapDue && summaries.length) {
    const total = summaries.reduce((a, s) => a + s.todayPnl, 0);
    await notify("recap", `🧾 Proving Ground recap, ${clock.date}\nAll tests today: ${signed(total)}\n\n${summaries.map((s) => `• ${s.line}`).join("\n")}`);
    await updateJson<Meta>(META_FILE, {}, (m) => {
      m.recap = clock.date;
    });
  }
}

/** Run every minute; quicker around the open, when entries happen. */
export function startProvingDaemon() {
  if (daemonState.started) return;
  daemonState.started = Date.now();
  const loop = async () => {
    try {
      await tick();
      daemonState.lastError = "";
    } catch (e) {
      daemonState.lastError = e instanceof Error ? e.message : "Proving loop failed";
    }
    const m = nyClock(Date.now()).minute;
    setTimeout(loop, m >= RTH_OPEN - 5 && m < RTH_CLOSE + 15 ? 60_000 : 5 * 60_000);
  };
  setTimeout(loop, 5_000);
}
