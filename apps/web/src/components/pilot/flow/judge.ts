import type { Account } from "@/store/accountStore";
import { DEFAULT_SETTINGS, orderedTrades } from "@/lib/pilot/workspace";
import { nyClock, type MacroEvent } from "@/lib/pilot/market";
import { buildGamePlan, checkSignal, type DayPlan, type TvSignal } from "@/lib/pilot/session";

/** The trades an account took on one New York session date, in order. */
export const tradesOn = (account: Account, date: string) =>
  orderedTrades(account.trades.filter((t) => t.date.slice(0, 10) === date));

/** Check one signal against the plan the trader had at the moment it arrived. */
export function judge(signal: TvSignal, account: Account, plan: DayPlan, events: MacroEvent[]) {
  const { date, minute } = nyClock(signal.receivedAt);
  const rules = account.pilotSettings?.rules || DEFAULT_SETTINGS.rules;
  const game = buildGamePlan({ market: null, events, history: [], plan, rules, today: date });
  return {
    minute,
    date,
    check: checkSignal(signal, { minute, trades: tradesOn(account, date), rules, plan, game }),
  };
}

/** A short two-note chime. Silent if the browser blocks audio. */
export function chime(tone: "go" | "caution" | "wait") {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const notes = tone === "go" ? [660, 990] : tone === "caution" ? [660, 660] : [520, 390];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      const t = ctx.currentTime + i * 0.14;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.25);
    });
    setTimeout(() => ctx.close(), 800);
  } catch {
    /* no audio, no problem */
  }
}
