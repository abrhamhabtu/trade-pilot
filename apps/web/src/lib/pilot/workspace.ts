import type { Trade } from "../../store/tradingStore";

export interface PilotRules {
  maxTrades: number;
  dailyLoss: number;
  maxContracts: number;
  cooldown: number;
  finishTime: string;
}
export interface PilotSettings {
  tags: boolean;
  notes: boolean;
  rules: PilotRules;
}
export interface PilotReview {
  fingerprint: string;
  tags: string[];
  note: string;
  reviewed: boolean;
  generatedAt: string;
}
export const DEFAULT_SETTINGS: PilotSettings = {
  tags: false,
  notes: false,
  rules: {
    maxTrades: 3,
    dailyLoss: 500,
    maxContracts: 2,
    cooldown: 5,
    finishTime: "11:00",
  },
};
export function tradeMinute(time?: string): number | null {
  if (!time) return null;
  const m = time.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const minute = Number(m[2]);
  if (minute > 59 || h > 23 || (m[3] && (h < 1 || h > 12))) return null;
  if (m[3]) h = (h % 12) + (m[3].toUpperCase() === "PM" ? 12 : 0);
  return h * 60 + minute;
}
export function orderedTrades<T extends { date: string; time?: string }>(
  trades: T[],
): T[] {
  return [...trades].sort(
    (a, b) =>
      a.date.slice(0, 10).localeCompare(b.date.slice(0, 10)) ||
      (tradeMinute(a.time) ?? 1440) - (tradeMinute(b.time) ?? 1440),
  );
}
export function tradeFingerprint(t: Trade): string {
  return JSON.stringify([
    t.date,
    t.time,
    t.symbol,
    t.side,
    t.netPL,
    t.quantity,
    t.duration,
    t.strategy,
  ]);
}
export function inspectTrade(t: Trade, all: Trade[], rules: PilotRules) {
  const ordered = orderedTrades(
    all.filter((x) => x.date.slice(0, 10) === t.date.slice(0, 10)),
  );
  const index = ordered.findIndex((x) => x.id === t.id);
  const prior = ordered.slice(0, Math.max(0, index));
  const minute = tradeMinute(t.time);
  const tags = [t.strategy, t.side].filter(Boolean) as string[];
  if (minute !== null)
    tags.push(
      minute >= 570 && minute < 660
        ? "Opening session"
        : minute >= 840
          ? "Afternoon"
          : "Outside opening session",
    );
  const flags: string[] = [];
  if (minute !== null && index >= rules.maxTrades)
    flags.push(
      `Trade ${index + 1} exceeds your ${rules.maxTrades}-trade limit`,
    );
  if (t.quantity > rules.maxContracts)
    flags.push(
      `${t.quantity} contracts exceeds your ${rules.maxContracts}-contract limit`,
    );
  const finish = tradeMinute(rules.finishTime);
  if (minute !== null && finish !== null && minute >= finish)
    flags.push(`Entry at or after your ${rules.finishTime} finish time`);
  const closeMinute = (x: Trade) => {
    const start = tradeMinute(x.time);
    return start !== null && Number.isFinite(x.duration) && x.duration >= 0
      ? start + x.duration
      : null;
  };
  const closed = ordered
    .filter((x) => x.id !== t.id && closeMinute(x) !== null)
    .sort((a, b) => closeMinute(a)! - closeMinute(b)!);
  let realized = 0;
  let breachedBeforeEntry = false;
  for (const x of closed) {
    if (minute === null || closeMinute(x)! > minute) continue;
    realized += x.netPL;
    if (realized <= -rules.dailyLoss) breachedBeforeEntry = true;
  }
  if (breachedBeforeEntry)
    flags.push("Entered after your realized daily loss limit was reached");
  const close = closeMinute(t);
  if (close !== null) {
    const beforeClose = closed
      .filter((x) => closeMinute(x)! < close)
      .reduce((sum, x) => sum + x.netPL, 0);
    if (
      beforeClose > -rules.dailyLoss &&
      beforeClose + t.netPL <= -rules.dailyLoss
    )
      flags.push("This trade reached your realized daily loss limit");
  }
  // Entry time + duration gives a close estimate. Never treat overlapping positions as revenge trades.
  const recentLoss = prior.findLast((p) => {
    const start = tradeMinute(p.time);
    if (
      p.netPL >= 0 ||
      minute === null ||
      start === null ||
      !Number.isFinite(p.duration) ||
      p.duration < 0
    )
      return false;
    const gap = minute - (start + p.duration);
    return gap >= 0 && gap < rules.cooldown;
  });
  if (recentLoss)
    flags.push(
      `Possible revenge entry: within ${rules.cooldown} minutes of a loss closing`,
    );
  if (!t.strategy) tags.push("Setup unrecorded");
  const note = `${t.symbol} ${t.side?.toLowerCase() || "trade"} on ${t.date.slice(0, 10)}${t.time ? ` at ${t.time}` : ""}. ${t.quantity} contract${t.quantity === 1 ? "" : "s"}; net P&L ${money(t.netPL)}. ${t.strategy ? `Recorded setup: ${t.strategy}.` : "Setup was not recorded."} ${flags.length ? flags.join(". ") + "." : "No breaches found in the available closed-trade data."}${minute === null ? " Entry time is missing; timing checks are incomplete." : ""} Execution quality and emotions need your own observation.`;
  return { tags, flags, note, timingKnown: minute !== null };
}
export function prepareReviews(
  trades: Trade[],
  settings: PilotSettings,
  force = false,
): Trade[] {
  let changed = false;
  const sessionInputs = new Map<string, string>();
  for (const t of orderedTrades(trades)) {
    const day = t.date.slice(0, 10);
    sessionInputs.set(
      day,
      (sessionInputs.get(day) || "") + t.id + tradeFingerprint(t),
    );
  }
  const next = trades.map((t) => {
    const fingerprint =
      sessionInputs.get(t.date.slice(0, 10)) +
      tradeFingerprint(t) +
      JSON.stringify(settings.rules) +
      settings.tags +
      settings.notes;
    if (
      (!force && !settings.tags && !settings.notes) ||
      (t.pilotReview?.fingerprint === fingerprint &&
        (!force || (!!t.pilotReview.note && t.pilotReview.tags.length > 0)))
    )
      return t;
    const result = inspectTrade(t, trades, settings.rules);
    changed = true;
    return {
      ...t,
      pilotReview: {
        fingerprint,
        tags: settings.tags || force ? result.tags : [],
        note: settings.notes || force ? result.note : "",
        reviewed: false,
        generatedAt: new Date().toISOString(),
      },
    };
  });
  return changed ? next : trades;
}
export function playbookStats(trades: Trade[]) {
  const rows = new Map<
    string,
    { name: string; count: number; wins: number; pnl: number }
  >();
  for (const t of trades) {
    if (!t.strategy?.trim()) continue;
    const name = t.strategy.trim();
    const r = rows.get(name) || { name, count: 0, wins: 0, pnl: 0 };
    r.count++;
    r.wins += Number(t.netPL > 0);
    r.pnl += t.netPL;
    rows.set(name, r);
  }
  return [...rows.values()].sort((a, b) => b.pnl - a.pnl);
}
export function money(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}
