// ─── Vision · Pass mode ────────────────────────────────────────────────────────
// For the setup on screen and a chosen prop account: how many contracts the
// firm's rules and the trader's own limits allow right now, what a loss or a
// win does to the account, and whether a rule says not to trade at all.
//
// This is arithmetic on published rules and the trader's limits. It never
// says a trade is good; it says what the rules allow.
// ───────────────────────────────────────────────────────────────────────────────

import type { DrawdownType } from "@/components/payout/propFirmData";
import { sessionOf, type MacroEvent } from "@/lib/pilot/market";
import { FEES, riskCap, type RiskLimits } from "./limits";
import { SYMBOLS, type VisionSymbolId } from "./markets";
import type { Setup } from "./analyze";
import type { AccountState, PropAccount } from "./account";

export interface GuardAccount {
  phase: "eval" | "funded" | "live";
  balance: number;
  /** The level that ends the account. */
  floor: number;
  ddType: DrawdownType;
  /** Daily loss limit remaining today, or none. */
  dllLeft: number | null;
  /** Balance needed to pass; evaluations only. */
  target: number | null;
  /** Where the account started, for how far along the target a win goes. */
  start: number;
  todayPnl: number;
  /** Dollars today may still make before the consistency rule bites. */
  bestDayCapLeft: number | null;
  maxMicros: number;
  maxMinis: number;
  /** Trailing drawdown that has locked and no longer follows profit. */
  trailLocked?: boolean;
}

export interface GuardReason {
  tone: "ok" | "warn" | "stop";
  text: string;
}

export interface GuardResult {
  verdict: "go" | "reduce" | "no";
  /** Contracts. */
  suggested: number;
  max: number;
  /** At the suggested size, fees included. */
  riskUsd: number;
  riskShareOfRoom: number;
  reasons: GuardReason[];
  ifLoss: { room: number; lossesLeftAtThisSize: number };
  ifWin: { balance: number; shareOfTarget: number | null; breaksBestDay: boolean };
  /** Intraday trailing only: room lost if price reaches +1R and then comes back to the stop. */
  roundTripLoss: number | null;
}

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** Which of the trader's news flags an event falls under. */
function newsKind(e: MacroEvent): "cpi" | "jobs" | "fomc" | null {
  const t = e.title.toLowerCase();
  if (/\bcpi\b|consumer price/.test(t)) return "cpi";
  if (/payroll|jobs report|employment situation/.test(t)) return "jobs";
  if (/fomc|fed (rate|decision)|powell/.test(t)) return "fomc";
  return null;
}

/** Minutes from `now` to an event (negative once it has passed), on the New York clock. */
function minutesTo(e: MacroEvent, now: number) {
  if (!e.time) return null;
  const c = sessionOf(Math.floor(now / 1000));
  if (e.date !== c.date) return null;
  const [h, m] = e.time.split(":").map(Number);
  return h * 60 + m - c.minute;
}

export function tradeGuard(o: {
  setup: Pick<Setup, "entry" | "stop" | "target" | "side">;
  symbol: VisionSymbolId;
  micro: boolean;
  account: GuardAccount;
  limits: RiskLimits;
  /** Unix milliseconds. */
  now: number;
  events: MacroEvent[];
  /** The size the trader has set; anything below it is a reduction. */
  wanted?: number;
}): GuardResult {
  const { setup, account: a, limits } = o;
  const sym = SYMBOLS[o.symbol];
  const pv = o.micro ? sym.pointValue!.micro : sym.pointValue!.full;
  const fee = o.micro ? FEES.micro : FEES.full;
  const stopPts = Math.abs(setup.entry - setup.stop);
  const targetPts = Math.abs(setup.target - setup.entry);
  const reasons: GuardReason[] = [];
  const room = Math.max(0, a.balance - a.floor);

  // 1. What one contract risks, fees included.
  const perContract = stopPts * pv + fee;
  const winPerContract = targetPts * pv - fee;

  // 2. The trader's own cap on risk: a share of the room on prop accounts, of the balance live.
  const cap = a.phase === "live" ? (limits.livePct / 100) * a.balance : riskCap(limits, o.symbol, a.phase) * room;
  let n = perContract > 0 ? Math.floor(cap / perContract) : 0;
  let blocked = false;
  if (n < 1) {
    blocked = true;
    reasons.push({ tone: "stop", text: `One contract risks ${usd(perContract)}; your limit here is ${usd(cap)}.` });
  } else reasons.push({ tone: "ok", text: `Your ${a.phase === "live" ? `${limits.livePct}% of the balance` : `${Math.round(riskCap(limits, o.symbol, a.phase) * 100)}% of the room`} allows ${n} at ${usd(perContract)} each.` });

  // 3. The daily loss limit and the firm's contract limit.
  if (!blocked && a.dllLeft != null) {
    const byDll = Math.floor(a.dllLeft / perContract);
    if (byDll < 1) {
      blocked = true;
      reasons.push({ tone: "stop", text: `Daily loss limit: ${usd(a.dllLeft)} left today, less than one contract's risk.` });
    } else if (byDll < n) {
      n = byDll;
      reasons.push({ tone: "warn", text: `Daily loss limit: ${usd(a.dllLeft)} left today caps it at ${n}.` });
    }
  }
  const firmMax = o.micro ? a.maxMicros : a.maxMinis;
  if (!blocked && n > firmMax) {
    n = firmMax;
    reasons.push({ tone: "warn", text: `The firm allows ${firmMax} ${o.micro ? "micros" : "minis"} on this account.` });
  }

  // 4. Hours and days the trader said they trade.
  const clock = sessionOf(Math.floor(o.now / 1000));
  const weekday = new Date(`${clock.date}T12:00:00Z`).getUTCDay();
  if (limits.hours) {
    const [from, to] = limits.hours;
    const inside = from <= to ? clock.minute >= from && clock.minute < to : clock.minute >= from || clock.minute < to;
    if (!inside) {
      blocked = true;
      reasons.push({ tone: "stop", text: "Outside the hours you set for entries." });
    }
  }
  if (!limits.weekdays.includes(weekday)) {
    blocked = true;
    reasons.push({ tone: "stop", text: "Not a day you said you trade." });
  }

  // 5. High-impact news from 10 minutes before to 30 after.
  for (const e of o.events) {
    if (e.impact !== "high") continue;
    const m = minutesTo(e, o.now);
    if (m == null || m > 10 || m < -30) continue;
    const kind = newsKind(e);
    const when = m >= 0 ? `in ${m} min` : `${-m} min ago`;
    if (kind && limits.skipNews[kind]) {
      blocked = true;
      reasons.push({ tone: "stop", text: `${e.title} ${when}: you skip this news.` });
    } else reasons.push({ tone: "warn", text: `${e.title} ${when}. Spreads and slippage run wide around it.` });
  }

  // 6. Consistency: a win at the target must not push today past what the rule allows.
  let breaksBestDay = false;
  if (!blocked && a.bestDayCapLeft != null && n > 0 && winPerContract > 0) {
    const fits = Math.floor(Math.max(0, a.bestDayCapLeft) / winPerContract);
    if (fits < n) {
      if (fits >= 1) {
        n = fits;
        reasons.push({ tone: "warn", text: `Consistency rule: today can make ${usd(a.bestDayCapLeft)} more; ${n} keeps a win inside it.` });
      } else {
        n = 1;
        breaksBestDay = true;
        const dir = setup.side === "long" ? 1 : -1;
        const at = setup.entry + (dir * (Math.max(0, a.bestDayCapLeft) + fee)) / pv;
        reasons.push({ tone: "warn", text: `Consistency rule: even one contract's win passes today's cap. It's reached at ${at.toFixed(sym.decimals)}; consider closing there.` });
      }
    }
  }

  // 7. Near the target: no more size than it takes to finish.
  if (!blocked && a.phase === "eval" && a.target != null && n > 1 && winPerContract > 0) {
    const need = a.target - a.balance;
    const win = winPerContract * n;
    const risk = perContract * n;
    if (need > 0 && win - need > risk) {
      const enough = Math.max(1, Math.ceil(need / winPerContract));
      if (enough < n) {
        n = enough;
        reasons.push({ tone: "ok", text: enough === 1 ? "One contract finishes it; no need for more." : `${enough} contracts finish it; no need for more.` });
      }
    }
  }

  const suggested = blocked ? 0 : n;
  const riskUsd = perContract * Math.max(1, suggested);
  const winUsd = winPerContract * Math.max(1, suggested);

  // 8. Intraday trailing: the floor follows open profit, so a round trip costs twice.
  let roundTripLoss: number | null = null;
  if (a.ddType === "trailing-intraday" && !a.trailLocked) {
    roundTripLoss = riskUsd + (stopPts * pv) * Math.max(1, suggested);
    if (roundTripLoss >= riskUsd * 1.25) reasons.push({ tone: "warn", text: `On this account the floor follows open profit. A round trip from +1R to the stop costs ${usd(roundTripLoss)} of room, not ${usd(riskUsd)}.` });
  }

  const afterLoss = room - riskUsd;
  const dllAfter = a.dllLeft != null ? a.dllLeft - riskUsd : Infinity;
  const usable = Math.max(0, Math.min(afterLoss, dllAfter));
  const wanted = o.wanted ?? suggested;
  return {
    verdict: suggested < 1 ? "no" : suggested < wanted ? "reduce" : "go",
    suggested,
    max: blocked ? 0 : Math.max(suggested, n),
    riskUsd,
    riskShareOfRoom: room > 0 ? riskUsd / room : 1,
    reasons,
    ifLoss: { room: Math.max(0, afterLoss), lossesLeftAtThisSize: riskUsd > 0 ? Math.floor(usable / riskUsd) : 0 },
    ifWin: {
      balance: a.balance + winUsd,
      shareOfTarget: a.target != null && a.target > a.start ? Math.min(1, Math.max(0, (a.balance + winUsd - a.start) / (a.target - a.start))) : null,
      breaksBestDay: breaksBestDay || (a.bestDayCapLeft != null && winUsd > a.bestDayCapLeft),
    },
    roundTripLoss,
  };
}

/**
 * A Prop desk practice account as the guard sees it. Real synced accounts
 * (lib/accountPulse.ts) can map onto the same fields later: balance and floor
 * from the broker, the program from the firm, today's P&L from the session.
 */
export function guardAccountOf(a: PropAccount, st: AccountState, today: string): GuardAccount {
  const p = st.program;
  const todayPnl = st.lastDay === today ? st.lastDayPnl : 0;
  const dllLeft = p.dll != null ? Math.max(0, p.dll + Math.min(0, todayPnl)) : null;
  let bestDayCapLeft: number | null = null;
  if (p.consistencyPct < 100) {
    const share = p.consistencyPct / 100;
    if (p.consistencyBasis === "profitTarget") bestDayCapLeft = share * p.target - todayPnl;
    else {
      // Best day at most `share` of total profit: today may end at x with x ≤ share × (profit before today + x).
      const before = st.profit - todayPnl;
      bestDayCapLeft = before > 0 ? (share * before) / (1 - share) - todayPnl : null;
    }
  }
  return {
    phase: a.phase,
    balance: st.balance,
    floor: st.threshold,
    ddType: p.ddType,
    dllLeft,
    target: a.phase === "eval" ? p.size + p.target : null,
    start: p.size,
    todayPnl,
    bestDayCapLeft,
    maxMicros: p.maxMicros,
    maxMinis: p.maxMinis,
    trailLocked: p.lock != null && st.peak - p.size >= p.lock,
  };
}
