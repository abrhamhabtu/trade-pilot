// ─── Preflight ─────────────────────────────────────────────────────────────────
// A pre-market checklist that cannot say no is decoration. This engine turns the
// routine into a clearance decision with three possible answers: fly, fly small,
// or stay on the ground.
//
// Two principles it is built on:
//   1. The most restrictive signal wins. Good sleep does not cancel a thin buffer.
//   2. Gates are different from restrictions. A gate means you have not finished
//      preparing, and no amount of feeling great gets you past it.
// ───────────────────────────────────────────────────────────────────────────────

export type Clearance = 'cleared' | 'restricted' | 'grounded' | 'incomplete';
export type Severity = 'gate' | 'stop' | 'warn' | 'good';

export interface PreflightCondition {
  /** Hours slept last night. */
  sleep: number;
  /** 1 = calm, 5 = wired. */
  stress: number;
  /** 1 = scattered, 5 = sharp. */
  focus: number;
  /** Something outside trading is taking up room today. */
  lifeNoise: boolean;
}

export interface PreflightSignals {
  /** Share of the drawdown buffer still intact, 0–1. null when unknown. */
  bufferRemaining: number | null;
  /** Consecutive losing days ending yesterday. */
  redDayStreak: number;
  /** True when the trader broke at least one rule on their last session. */
  brokeRulesLastSession: boolean;
  /** Fraction of the prep checklist ticked, 0–1. */
  checklistComplete: number;
  /** A daily max loss has been committed for today. */
  hasDailyStop: boolean;
  /** A stop time has been committed for today. */
  hasStopTime: boolean;
  /** The trader has written a bias and at least one level. */
  hasMarketPlan: boolean;
}

export interface PreflightReason {
  id: string;
  severity: Severity;
  text: string;
  /** What the trader should do about it, in one line. */
  action?: string;
}

export interface PreflightVerdict {
  clearance: Clearance;
  /** Fraction of normal size the trader has earned today. */
  sizeMultiplier: number;
  /** 0–100. Presentation only — the clearance is what actually gates. */
  readiness: number;
  reasons: PreflightReason[];
  /** The single line the trader should read if they read nothing else. */
  headline: string;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Scores condition on its own, 0–1. Sleep carries the most weight because it is
 * the input most strongly tied to impulse control, and the one traders most
 * reliably lie to themselves about.
 */
export function conditionScore(c: PreflightCondition): number {
  const sleep = clamp01((c.sleep - 3) / 5); // 3h → 0, 8h → 1
  const stress = clamp01((5 - c.stress) / 4);
  const focus = clamp01((c.focus - 1) / 4);
  const base = sleep * 0.45 + stress * 0.3 + focus * 0.25;
  return clamp01(base - (c.lifeNoise ? 0.15 : 0));
}

/**
 * The clearance decision.
 *
 * Gates are evaluated first and are absolute: an unfinished checklist is not a
 * small problem to be traded around, it means preflight is not done.
 */
export function evaluatePreflight(
  condition: PreflightCondition,
  signals: PreflightSignals,
): PreflightVerdict {
  const reasons: PreflightReason[] = [];

  // ── Gates: preparation that simply has not happened yet ─────────────────────
  if (signals.checklistComplete < 1) {
    reasons.push({
      id: 'gate-checklist',
      severity: 'gate',
      text: `Prep checklist is ${Math.round(signals.checklistComplete * 100)}% done.`,
      action: 'Finish every item before the open.',
    });
  }
  if (!signals.hasDailyStop) {
    reasons.push({
      id: 'gate-stop',
      severity: 'gate',
      text: 'No daily max loss committed.',
      action: 'Decide the number now, while it is still cheap to decide.',
    });
  }
  if (!signals.hasStopTime) {
    reasons.push({
      id: 'gate-time',
      severity: 'gate',
      text: 'No stop time set.',
      action: 'Name the hour you walk away regardless of P&L.',
    });
  }
  if (!signals.hasMarketPlan) {
    reasons.push({
      id: 'gate-plan',
      severity: 'gate',
      text: 'No bias or levels written down.',
      action: 'A plan you did not write is a plan you will improvise.',
    });
  }

  // ── Restrictions: you may trade, but not at full size ───────────────────────
  let multiplier = 1;
  const restrict = (m: number, reason: PreflightReason) => {
    multiplier = Math.min(multiplier, m);
    reasons.push(reason);
  };

  if (condition.sleep < 4) {
    restrict(0, {
      id: 'sleep-critical',
      severity: 'stop',
      text: `${condition.sleep}h of sleep.`,
      action: 'This is not a discipline problem you can willpower through. Sit out.',
    });
  } else if (condition.sleep < 5.5) {
    restrict(0.5, {
      id: 'sleep-low',
      severity: 'warn',
      text: `${condition.sleep}h of sleep — impulse control is the first thing to go.`,
      action: 'Half size.',
    });
  }

  if (condition.stress >= 5) {
    restrict(0.5, {
      id: 'stress-high',
      severity: 'warn',
      text: 'Stress is maxed.',
      action: 'Half size, and no adds.',
    });
  } else if (condition.stress === 4) {
    restrict(0.75, {
      id: 'stress-elevated',
      severity: 'warn',
      text: 'Stress is elevated.',
      action: 'Three-quarter size.',
    });
  }

  if (condition.focus <= 2) {
    restrict(0.5, {
      id: 'focus-low',
      severity: 'warn',
      text: 'Focus is low.',
      action: 'A-setups only, half size.',
    });
  }

  if (condition.lifeNoise) {
    restrict(0.75, {
      id: 'life-noise',
      severity: 'warn',
      text: 'Something outside trading is taking up room today.',
      action: 'Trade smaller than you think you need to.',
    });
  }

  if (signals.bufferRemaining !== null && signals.bufferRemaining <= 0.2) {
    restrict(0.5, {
      id: 'buffer-thin',
      severity: 'stop',
      text: `Only ${Math.round(signals.bufferRemaining * 100)}% of your drawdown buffer is left.`,
      action: 'You cannot size your way out of this. Half size, one setup.',
    });
  } else if (signals.bufferRemaining !== null && signals.bufferRemaining <= 0.4) {
    restrict(0.75, {
      id: 'buffer-low',
      severity: 'warn',
      text: `${Math.round(signals.bufferRemaining * 100)}% of your buffer is left.`,
      action: 'Protect the account before you grow it.',
    });
  }

  if (signals.redDayStreak >= 3) {
    restrict(0.5, {
      id: 'streak-deep',
      severity: 'stop',
      text: `${signals.redDayStreak} red days in a row.`,
      action: 'Half size until you put a green day up. Earn it back, do not take it back.',
    });
  } else if (signals.redDayStreak === 2) {
    restrict(0.75, {
      id: 'streak',
      severity: 'warn',
      text: 'Two red days in a row.',
      action: 'Three-quarter size.',
    });
  }

  if (signals.brokeRulesLastSession) {
    restrict(0.5, {
      id: 'broke-rules',
      severity: 'stop',
      text: 'You broke your rules last session.',
      action: 'Half size today. Size is a privilege, and it resets when you break form.',
    });
  }

  // ── Verdict ────────────────────────────────────────────────────────────────
  const gated = reasons.some((r) => r.severity === 'gate');
  const condScore = conditionScore(condition);
  const bufferScore = signals.bufferRemaining === null ? 0.75 : signals.bufferRemaining;
  const prepScore =
    (signals.checklistComplete +
      (signals.hasDailyStop ? 1 : 0) +
      (signals.hasStopTime ? 1 : 0) +
      (signals.hasMarketPlan ? 1 : 0)) /
    4;

  const readiness = Math.round(
    clamp01(condScore * 0.4 + bufferScore * 0.25 + prepScore * 0.35) * 100,
  );

  let clearance: Clearance;
  if (gated) clearance = 'incomplete';
  else if (multiplier <= 0) clearance = 'grounded';
  else if (multiplier < 1) clearance = 'restricted';
  else clearance = 'cleared';

  if (clearance === 'cleared') {
    reasons.push({
      id: 'all-clear',
      severity: 'good',
      text: 'Rested, prepared, and with room to work.',
      action: 'Full size. Trade your plan.',
    });
  }

  const headline =
    clearance === 'incomplete'
      ? 'Preflight is not finished.'
      : clearance === 'grounded'
        ? 'Stand down today.'
        : clearance === 'restricted'
          ? `Cleared at ${Math.round(multiplier * 100)}% size.`
          : 'Cleared for full size.';

  return {
    clearance,
    sizeMultiplier: clearance === 'incomplete' ? 0 : multiplier,
    readiness,
    reasons,
    headline,
  };
}

/** Counts consecutive losing days ending at (and excluding) `today`. */
export function redDayStreak(
  trades: { date: string; netPL: number }[],
  today: string,
): number {
  const byDay = new Map<string, number>();
  for (const t of trades) {
    if (t.date >= today) continue;
    byDay.set(t.date, (byDay.get(t.date) || 0) + t.netPL);
  }
  const days = Array.from(byDay.keys()).sort().reverse();
  let streak = 0;
  for (const d of days) {
    if ((byDay.get(d) as number) < 0) streak += 1;
    else break;
  }
  return streak;
}
