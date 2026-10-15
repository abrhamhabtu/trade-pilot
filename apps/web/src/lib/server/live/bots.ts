// ─── Live bots ─────────────────────────────────────────────────────────────────
// A bot runs one Proving Ground strategy on the broker's own real-time bars.
//
//   • Shadow (the default): it decides exactly as it would live and reports
//     what it would have sent. Nothing reaches the broker.
//   • Armed: real orders. Arming lasts for one session only, needs a typed
//     confirmation, and needs the trader to confirm their firm allows
//     automated trading on that account.
//
// Guardrails on every armed order: entries only on a fresh signal (never a
// late chase), a contract cap, a daily loss stop that halts and flattens the
// bot, a flat-by time, a broker-side stop and target on every position, and a
// kill switch in the app and on Telegram. Any order the broker rejects
// disarms the bot.
// ───────────────────────────────────────────────────────────────────────────────

import { RTH_CLOSE, RTH_OPEN, hhmmToMinute, nyClock } from "@/lib/pilot/market";
import { INSTRUMENTS, STRATEGIES, TF_MINUTES, runSession, toSessions, type StrategyConfig } from "@/lib/proving/engine";
import { notify } from "../notify";
import { appendLine, readJson, tailLines, updateJson } from "../store";
import * as px from "./projectx";

export type BotMode = "off" | "shadow" | "armed";

export interface LiveBot {
  id: string;
  name: string;
  cfg: StrategyConfig;
  accountId: number;
  accountName: string;
  contractId?: string;
  contractName?: string;
  tickSize?: number;
  mode: BotMode;
  /** ET date the bot is armed for. Armed on any other day means shadow. */
  armedOn?: string;
  maxContracts: number;
  /** Halt and flatten once the day's P&L reaches -this. */
  dailyLossStop: number;
  firmAllowsAutomation: boolean;
  createdAt: number;
}

export interface Execution {
  tradeId: string;
  at: number;
  side: "long" | "short";
  qty: number;
  entryPx: number;
  live: boolean;
  orderId?: number;
  closed?: boolean;
  skipped?: string;
}

export interface BotRun {
  date: string;
  executions: Record<string, Execution>;
  dayPnl: number;
  halted?: string;
  lastCheck?: number;
  lastError?: string;
  /** Today's simulated trades, for the page. */
  trades: { id: string; side: string; qty: number; entryPx: number; exit: string; pnl: number; why: string }[];
}

export interface LogEntry {
  at: number;
  botId?: string;
  level: "info" | "order" | "warn" | "error";
  text: string;
}

const BOTS = "live-bots.json";
const RUNS = "live-runs.json";
const LOG = "live-log.jsonl";
const ROOT: Record<string, string> = { MNQ: "MNQ", MES: "MES", NQ: "NQ", ES: "ES" };

export const liveState: { started: number; lastTick: number; lastError: string } = ((globalThis as Record<string, unknown>).__tpLiveState ??= {
  started: 0,
  lastTick: 0,
  lastError: "",
}) as never;

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const money = (n: number) => `${n < 0 ? "-" : n > 0 ? "+" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

export const getBots = async () => (await readJson<{ bots: LiveBot[] }>(BOTS, { bots: [] })).bots;
export const getRuns = () => readJson<Record<string, BotRun>>(RUNS, {});
export const getLog = (n = 60) => tailLines<LogEntry>(LOG, n);

export async function saveBots(change: (bots: LiveBot[]) => LiveBot[]) {
  return (await updateJson<{ bots: LiveBot[] }>(BOTS, { bots: [] }, (s) => ({ bots: change(s.bots) }))).bots;
}

async function log(entry: Omit<LogEntry, "at">, alert = false) {
  await appendLine(LOG, { at: Date.now(), ...entry });
  if (alert) await notify("live", entry.text);
}

export const isArmed = (b: LiveBot, date = nyClock(Date.now()).date) => b.mode === "armed" && b.armedOn === date && b.firmAllowsAutomation;

export async function addBot(input: Pick<LiveBot, "name" | "cfg" | "accountId" | "accountName" | "maxContracts" | "dailyLossStop">) {
  const contract = await px.frontContract(ROOT[input.cfg.instrument]);
  const bot: LiveBot = {
    ...input,
    id: uid(),
    contractId: contract.id,
    contractName: contract.name,
    tickSize: contract.tickSize,
    mode: "shadow",
    firmAllowsAutomation: false,
    createdAt: Date.now(),
  };
  await saveBots((bots) => [...bots, bot]);
  await log({ botId: bot.id, level: "info", text: `${bot.name}: added in shadow mode on ${contract.name}, account ${bot.accountName}.` });
  return bot;
}

export async function arm(id: string) {
  const date = nyClock(Date.now()).date;
  let armed: LiveBot | undefined;
  await saveBots((bots) =>
    bots.map((b) => {
      if (b.id !== id) return b;
      if (!b.firmAllowsAutomation) throw new Error("Confirm your firm allows automated trading on this account first.");
      if (!b.contractId) throw new Error("This bot has no contract yet.");
      armed = { ...b, mode: "armed", armedOn: date };
      return armed;
    }),
  );
  if (armed) await log({ botId: id, level: "warn", text: `⚠️ ${armed.name} ARMED for ${date}: real orders on ${armed.accountName}, max ${armed.maxContracts} contracts, daily stop ${money(-armed.dailyLossStop)}.` }, true);
}

export async function setMode(id: string, mode: Exclude<BotMode, "armed">, reason = "") {
  const bots = await saveBots((bots) => bots.map((b) => (b.id === id ? { ...b, mode, armedOn: undefined } : b)));
  const b = bots.find((x) => x.id === id);
  if (b) await log({ botId: id, level: "info", text: `${b.name}: ${mode === "off" ? "turned off" : "back to shadow"}${reason ? ` (${reason})` : ""}.` });
}

/** Close the bot's position, cancel its leftover orders, and stop it for the day. */
async function flattenBot(b: LiveBot, reason: string) {
  if (!b.contractId) return;
  try {
    await px.closeContract(b.accountId, b.contractId);
  } catch (e) {
    // No position to close is fine; anything else is reported.
    if (!(e instanceof Error && /position/i.test(e.message))) await log({ botId: b.id, level: "error", text: `${b.name}: close failed: ${e instanceof Error ? e.message : e}` }, true);
  }
  await px.cancelOpenOrders(b.accountId, b.contractId).catch(() => undefined);
  await log({ botId: b.id, level: "order", text: `🛑 ${b.name}: flattened (${reason}).` }, true);
}

export async function flattenAll(reason: string) {
  const bots = await getBots();
  const live = bots.filter((b) => b.mode === "armed");
  for (const b of live) await flattenBot(b, reason);
  await saveBots((xs) => xs.map((b) => (b.mode === "armed" ? { ...b, mode: "shadow" as const, armedOn: undefined } : b)));
  await updateJson<Record<string, BotRun>>(RUNS, {}, (runs) => {
    for (const r of Object.values(runs)) r.halted = r.halted || `Kill switch: ${reason}`;
  });
  return live.length ? `Flattened and disarmed ${live.length} bot${live.length === 1 ? "" : "s"}.` : "No armed bots. Nothing to flatten.";
}

export async function liveSummary() {
  const bots = await getBots();
  const runs = await getRuns();
  const date = nyClock(Date.now()).date;
  if (!bots.length) return "No live bots yet.";
  return [
    "Live bots",
    ...bots.map((b) => {
      const r = runs[b.id]?.date === date ? runs[b.id] : null;
      const mode = isArmed(b, date) ? "ARMED" : b.mode === "off" ? "off" : "shadow";
      return `• ${b.name} [${mode}] ${b.cfg.instrument} · today ${money(r?.dayPnl ?? 0)} · ${r?.trades.length ?? 0} trades${r?.halted ? ` · halted: ${r.halted}` : ""}`;
    }),
  ].join("\n");
}

async function runBot(b: LiveBot, run: BotRun, now: number) {
  const clock = nyClock(now);
  if (!b.contractId || !b.tickSize) return;
  const tf = TF_MINUTES[b.cfg.timeframe];
  const bars = await px.minuteBars(b.contractId, tf, now - 4 * 86_400_000, now);
  const session = toSessions(bars).find((s) => s.date === clock.date);
  if (!session?.rth.length) return;
  const sim = runSession(session, b.cfg, { partial: clock.minute < RTH_CLOSE });
  const armed = isArmed(b, clock.date);
  const tag = armed ? "" : "[SHADOW] ";
  run.dayPnl = sim.pnl;
  run.trades = sim.trades.map((t) => ({ id: t.id, side: t.side, qty: t.qty, entryPx: t.entryPx, exit: t.exit, pnl: t.pnl, why: t.why }));

  // Daily loss stop: halt, and flatten if real money is on.
  if (!run.halted && b.dailyLossStop > 0 && sim.pnl <= -b.dailyLossStop) {
    run.halted = `daily loss stop ${money(-b.dailyLossStop)}`;
    if (armed) await flattenBot(b, run.halted);
    else await log({ botId: b.id, level: "warn", text: `${tag}${b.name}: daily loss stop reached (${money(sim.pnl)}). Halted for today.` }, true);
  }
  // Flat-by: nothing open after the strategy's own flat time.
  const flatBy = hhmmToMinute(b.cfg.flatBy) ?? RTH_CLOSE - 5;
  if (!run.halted && clock.minute >= flatBy) {
    run.halted = "flat-by time";
    if (armed && Object.values(run.executions).some((x) => x.live && !x.closed && !x.skipped)) await flattenBot(b, "flat-by time");
  }

  const step = tf * 60;
  for (const t of sim.trades) {
    const done = run.executions[t.id];
    if (!done) {
      const fresh = t.exit === "open" && now / 1000 - t.entryT <= 2 * step;
      if (!fresh || run.halted) {
        run.executions[t.id] = { tradeId: t.id, at: now, side: t.side, qty: 0, entryPx: t.entryPx, live: false, skipped: run.halted ? `halted: ${run.halted}` : "signal already old" };
        continue;
      }
      const qty = Math.min(t.qty, b.maxContracts);
      const stopTicks = Math.abs(t.entryPx - t.stopPx) / b.tickSize;
      const targetTicks = Math.abs(t.targetPx - t.entryPx) / b.tickSize;
      const what = `${t.side === "long" ? "BUY" : "SELL"} ${qty} ${b.contractName} at market, stop ${Math.round(stopTicks)} ticks, target ${Math.round(targetTicks)} ticks. ${t.why}`;
      const exec: Execution = { tradeId: t.id, at: now, side: t.side, qty, entryPx: t.entryPx, live: armed };
      if (armed) {
        try {
          exec.orderId = await px.placeBracketMarket({ accountId: b.accountId, contractId: b.contractId, side: t.side, size: qty, stopTicks, targetTicks, tag: `tp-${b.id}-${t.id}`.slice(0, 50) });
          await log({ botId: b.id, level: "order", text: `🚀 ${b.name}: ${what} (order ${exec.orderId})` }, true);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          exec.skipped = `rejected: ${msg}`;
          run.halted = "order rejected";
          await setMode(b.id, "shadow", "order rejected");
          const hint = /bracket/i.test(msg) ? " Set the account's risk setting to Auto OCO Brackets, then arm again." : "";
          await log({ botId: b.id, level: "error", text: `⛔ ${b.name}: order rejected: ${msg}. Bot disarmed.${hint}` }, true);
        }
      } else {
        await log({ botId: b.id, level: "info", text: `${tag}${b.name}: would ${what}` }, true);
      }
      run.executions[t.id] = exec;
      continue;
    }
    // The strategy closed a trade the broker's bracket does not cover: its
    // flat-by time or its break-even stop. Close it at market.
    if (!done.closed && !done.skipped && t.exit !== "open") {
      done.closed = true;
      if (done.live && (t.exit === "time" || t.exit === "breakeven")) {
        await px.closeContract(b.accountId, b.contractId).catch(() => undefined);
        await px.cancelOpenOrders(b.accountId, b.contractId).catch(() => undefined);
      }
      await log({ botId: b.id, level: done.live ? "order" : "info", text: `${done.live ? "" : "[SHADOW] "}${b.name}: ${t.exit} exit, ${money(t.pnl)} (${t.r >= 0 ? "+" : ""}${t.r}R).` }, true);
    }
  }
}

export async function liveTick(now = Date.now()) {
  const clock = nyClock(now);
  const bots = (await getBots()).filter((b) => b.mode !== "off");
  if (!bots.length || clock.weekday === 0 || clock.weekday === 6 || clock.minute < RTH_OPEN - 5 || clock.minute > RTH_CLOSE + 5) return;
  const secrets = await px.getSecrets();
  if (!secrets.apiKey) return;
  const runs = await getRuns();
  for (const b of bots) {
    const run: BotRun = runs[b.id]?.date === clock.date ? runs[b.id] : { date: clock.date, executions: {}, dayPnl: 0, trades: [] };
    try {
      await runBot(b, run, now);
      run.lastError = undefined;
    } catch (e) {
      run.lastError = e instanceof Error ? e.message : String(e);
    }
    run.lastCheck = now;
    runs[b.id] = run;
  }
  await updateJson<Record<string, BotRun>>(RUNS, {}, (all) => ({ ...all, ...runs }));
  liveState.lastTick = now;
}

export function startLiveDaemon() {
  if (liveState.started) return;
  liveState.started = Date.now();
  const loop = async () => {
    try {
      await liveTick();
      liveState.lastError = "";
    } catch (e) {
      liveState.lastError = e instanceof Error ? e.message : "Live loop failed";
    }
    const m = nyClock(Date.now()).minute;
    setTimeout(loop, m >= RTH_OPEN - 5 && m <= RTH_CLOSE + 5 ? 10_000 : 60_000);
  };
  setTimeout(loop, 8_000);
}

export const describeBot = (b: LiveBot) => `${STRATEGIES[b.cfg.strategy].label} · ${b.cfg.timeframe} · ${INSTRUMENTS[b.cfg.instrument].label}`;
