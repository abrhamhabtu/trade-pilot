// ─── Copy-trading risk ─────────────────────────────────────────────────────────
// Copying one strategy across five accounts feels like five chances. It is one
// chance, five times the size: the day that ends one account ends all of them.
//
// This finds accounts that move together (daily P&L correlation, which ignores
// size, so a 2-lot copy of a 1-lot account still matches) and asks what their
// worst recorded day would do if it landed on every copy at once.
// ───────────────────────────────────────────────────────────────────────────────

import type { Account } from '@/store/accountStore';
import { computeLiquidation } from '@/lib/liquidation';
import { firmLabel } from '@/lib/propLedger';

/** Correlation at which two accounts count as copies. */
export const COPY_CORRELATION = 0.8;
/** Shared trading days needed before a correlation means anything. */
export const MIN_SHARED_DAYS = 8;

function dailyPnL(account: Account): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of account.trades) {
    const d = t.date.slice(0, 10);
    m.set(d, (m.get(d) ?? 0) + t.netPL);
  }
  return m;
}

/** Pearson correlation over the days both accounts traded. null when too few. */
export function correlation(a: Map<string, number>, b: Map<string, number>): number | null {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [d, x] of a) {
    const y = b.get(d);
    if (y !== undefined) {
      xs.push(x);
      ys.push(y);
    }
  }
  const n = xs.length;
  if (n < MIN_SHARED_DAYS) return null;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}

export interface CopyMember {
  id: string;
  name: string;
  firm: string;
  /** Worst recorded day, as a positive loss. */
  worstDay: number;
  /** Room left before the account is closed. null when its rules are unknown. */
  cushion: number | null;
  /** True when the worst day, landing again, ends this account. */
  wouldBlow: boolean;
}

export interface CopyGroup {
  members: CopyMember[];
  /** Lowest pairwise correlation inside the group. */
  minCorrelation: number;
  /** Combined loss if every copy has its worst day together. */
  combinedWorstDay: number;
  blowCount: number;
  /** Every member at one firm: a single rule change or outage hits them all. */
  singleFirm: boolean;
  suggestions: string[];
}

const money = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString()}`;

function member(account: Account): CopyMember {
  const days = [...dailyPnL(account).values()];
  const worstDay = Math.max(0, -Math.min(0, ...days));
  const liq = computeLiquidation(account);
  const cushion = liq ? Math.max(0, liq.cushion) : null;
  return {
    id: account.id,
    name: account.name,
    firm: firmLabel(account),
    worstDay,
    cushion,
    wouldBlow: cushion !== null && worstDay > 0 && worstDay >= cushion,
  };
}

/** Groups of live accounts that trade as copies of each other. */
export function findCopyGroups(accounts: Account[]): CopyGroup[] {
  const live = accounts.filter((a) => a.status === 'active' && a.trades.length > 0);
  const series = live.map(dailyPnL);

  // Union-find over pairs that correlate as copies.
  const parent = live.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const pairCorr = new Map<string, number>();
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const c = correlation(series[i], series[j]);
      if (c !== null && c >= COPY_CORRELATION) {
        parent[find(i)] = find(j);
        pairCorr.set(`${i}-${j}`, c);
      }
    }
  }

  const byRoot = new Map<number, number[]>();
  live.forEach((_, i) => byRoot.set(find(i), [...(byRoot.get(find(i)) ?? []), i]));

  const groups: CopyGroup[] = [];
  for (const idx of byRoot.values()) {
    if (idx.length < 2) continue;
    const members = idx.map((i) => member(live[i]));
    const corrs = [...pairCorr.entries()]
      .filter(([k]) => {
        const [a, b] = k.split('-').map(Number);
        return idx.includes(a) && idx.includes(b);
      })
      .map(([, c]) => c);
    const combinedWorstDay = members.reduce((n, m) => n + m.worstDay, 0);
    const blowCount = members.filter((m) => m.wouldBlow).length;
    const singleFirm = new Set(members.map((m) => m.firm)).size === 1;

    const suggestions: string[] = [];
    if (blowCount > 1) {
      suggestions.push(
        `A repeat of your worst day ends ${blowCount} accounts at once. Cut size on the copies with the least room until each can absorb that day on its own.`,
      );
    }
    const cushions = members.map((m) => m.cushion).filter((c): c is number => c !== null);
    if (cushions.length > 1 && Math.max(...cushions) - Math.min(...cushions) < Math.max(...cushions) * 0.15) {
      suggestions.push('Every copy sits about the same distance from its threshold, so they fail together. Stagger size so one account always has more room than the rest.');
    }
    if (singleFirm) {
      suggestions.push(`All ${members.length} are at ${members[0].firm}. Spreading across firms means one rule change, payout delay or outage cannot hit everything.`);
    }
    suggestions.push('Keep one account trading a smaller copy, or a day behind, so a single bad session never touches everything you have.');

    groups.push({
      members,
      minCorrelation: corrs.length ? Math.min(...corrs) : COPY_CORRELATION,
      combinedWorstDay,
      blowCount,
      singleFirm,
      suggestions,
    });
  }
  return groups.sort((a, b) => b.blowCount - a.blowCount || b.combinedWorstDay - a.combinedWorstDay);
}

/**
 * For planning: what happens to N copied accounts on the trader's worst day.
 * Used where the trader is choosing how many accounts to run.
 */
export function copyPlanWarning(worstDay: number, drawdown: number, accounts: number, costPerAccount: number): string | null {
  if (accounts < 2 || worstDay <= 0 || drawdown <= 0) return null;
  if (worstDay >= drawdown) {
    return `Your worst recorded day (${money(worstDay)}) is bigger than this ${money(drawdown)} drawdown. Copied across ${accounts} accounts, one such day ends all ${accounts} at once: about ${money(accounts * costPerAccount)} in fees gone in a session.`;
  }
  const share = Math.round((worstDay / drawdown) * 100);
  return `Copied across ${accounts} accounts, your worst recorded day (${money(worstDay)}) takes ${share}% of every account's drawdown on the same day. The accounts do not diversify each other; stagger size so they do not all sit at the same distance from their thresholds.`;
}
