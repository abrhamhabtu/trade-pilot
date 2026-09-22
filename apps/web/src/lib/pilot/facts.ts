// ─── Pilot's fact sheet ────────────────────────────────────────────────────────
// Models are poor calculators. Handed a list of trades they will guess at win
// rates and costs, and guess wrong often enough to matter. Everything the app
// has already worked out — room left to lose, today's stop, payout readiness,
// pass odds, the fee ledger, firm rules, the Coach's findings — goes to the
// model as numbers it can quote, so it reasons instead of arithmetic.
//
// Pure: callers pass in accounts, today's plan and the date.
// ───────────────────────────────────────────────────────────────────────────────

import type { Account } from '@/store/accountStore';
import { accountsInScope } from '@/store/accountStore';
import type { Trade } from '@/store/tradingStore';
import { computeLiquidation, resolveFirm } from '@/lib/liquidation';
import { evaluateDailyStop, type DayPlanLimits } from '@/lib/dailyStop';
import { addTradingDays, payoutWindow } from '@/lib/payoutSchedule';
import { accountPassOdds, dailySamples } from '@/lib/passOdds';
import { computeLedger } from '@/lib/propLedger';
import { buildCoachInsights } from '@/lib/coachInsights';
import { findCopyGroups } from '@/lib/copyRisk';
import { NEWS_LABEL, finePrintFor, tierOneReleasesOn } from '@/components/payout/firmFinePrint';
import { tradeMinute } from '@/lib/pilot/workspace';

const r0 = (n: number) => Math.round(n);
const r2 = (n: number) => Math.round(n * 100) / 100;
const pct = (n: number) => Math.round(n * 1000) / 10;

export interface GroupRow {
  key: string;
  trades: number;
  winRate: number;
  net: number;
  avg: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** P&L grouped by hour of entry, weekday, setup or symbol. */
export function groupStats(trades: Trade[], by: 'hour' | 'weekday' | 'setup' | 'symbol' | 'side'): GroupRow[] {
  const rows = new Map<string, { n: number; w: number; net: number }>();
  for (const t of trades) {
    let key: string | null;
    if (by === 'hour') {
      const m = tradeMinute(t.time);
      key = m === null ? null : `${String(Math.floor(m / 60)).padStart(2, '0')}:00`;
    } else if (by === 'weekday') key = WEEKDAYS[new Date(`${t.date.slice(0, 10)}T12:00:00`).getDay()];
    else if (by === 'setup') key = t.strategy?.trim() || 'No setup recorded';
    else if (by === 'side') key = t.side ?? 'Unknown';
    else key = t.symbol || 'Unknown';
    if (!key) continue;
    const r = rows.get(key) ?? { n: 0, w: 0, net: 0 };
    r.n += 1;
    r.w += Number(t.netPL > 0);
    r.net += t.netPL;
    rows.set(key, r);
  }
  return [...rows.entries()]
    .map(([key, r]) => ({ key, trades: r.n, winRate: pct(r.w / r.n), net: r0(r.net), avg: r2(r.net / r.n) }))
    .sort((a, b) => (by === 'hour' ? a.key.localeCompare(b.key) : b.net - a.net));
}

/** Headline numbers for a set of trades. */
export function tradeSummary(trades: Trade[]) {
  const wins = trades.filter((t) => t.netPL > 0);
  const losses = trades.filter((t) => t.netPL < 0);
  const gross = (xs: Trade[]) => xs.reduce((n, t) => n + t.netPL, 0);
  const byDay = new Map<string, number>();
  for (const t of trades) byDay.set(t.date.slice(0, 10), (byDay.get(t.date.slice(0, 10)) ?? 0) + t.netPL);
  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  const best = days.reduce<[string, number] | null>((m, d) => (!m || d[1] > m[1] ? d : m), null);
  const worst = days.reduce<[string, number] | null>((m, d) => (!m || d[1] < m[1] ? d : m), null);

  // Current streak of red or green days, counted back from the latest.
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const sign = Math.sign(days[i][1]);
    if (!streak) streak = sign;
    else if (Math.sign(streak) === sign) streak += sign;
    else break;
  }

  return {
    trades: trades.length,
    tradingDays: days.length,
    net: r0(gross(trades)),
    winRate: trades.length ? pct(wins.length / trades.length) : null,
    avgWin: wins.length ? r2(gross(wins) / wins.length) : null,
    avgLoss: losses.length ? r2(gross(losses) / losses.length) : null,
    profitFactor: losses.length ? r2(gross(wins) / Math.abs(gross(losses))) : null,
    greenDays: days.filter(([, v]) => v > 0).length,
    redDays: days.filter(([, v]) => v < 0).length,
    bestDay: best ? { date: best[0], net: r0(best[1]) } : null,
    worstDay: worst ? { date: worst[0], net: r0(worst[1]) } : null,
    currentDayStreak: streak === 0 ? 'none' : `${Math.abs(streak)} ${streak > 0 ? 'green' : 'red'} day${Math.abs(streak) === 1 ? '' : 's'}`,
    firstDate: days[0]?.[0] ?? null,
    lastDate: days.at(-1)?.[0] ?? null,
  };
}

function firmFacts(account: Account, today: string) {
  const match = resolveFirm(account);
  if (!match) return null;
  const fp = finePrintFor(match.firm.id);
  const upcoming: { date: string; releases: string[] }[] = [];
  for (let i = 0; i <= 5; i++) {
    const d = i === 0 ? today : addTradingDays(today, i);
    const rel = tierOneReleasesOn(d);
    if (rel.length) upcoming.push({ date: d, releases: rel.map((r) => `${r.label} ${r.time}${r.certainty === 'typical' ? ' (usual slot, confirm)' : ''}`) });
  }
  return {
    firm: match.firm.name,
    program: match.firm.program,
    size: match.tier.label,
    drawdown: match.tier.drawdown,
    drawdownType: match.firm.drawdownType,
    profitTarget: account.profitTarget ?? match.tier.profitTarget,
    consistency: `${account.consistencyRulePercentage ?? match.firm.consistencyPercent}% (${match.firm.consistencyBasis === 'profitTarget' ? 'of profit target' : 'of total profit'})`,
    minTradingDays: match.firm.minTradingDays,
    profitSplit: match.firm.profitSplit,
    dailyLossLimit: match.tier.dailyLossLimit,
    rulesChecked: fp?.checked ?? match.firm.rulesUpdated,
    news: fp ? { policy: NEWS_LABEL[fp.news.value], source: fp.news.source, detail: fp.news.note } : 'not on file',
    upcomingTierOneNews: upcoming,
    finePrint: fp
      ? [
          fp.minPayout && `Minimum payout $${fp.minPayout.value} (${fp.minPayout.source})`,
          fp.payoutDays && `${fp.payoutDays.value.count} qualifying days per payout (${fp.payoutDays.source})`,
          fp.maxPayouts && `${fp.maxPayouts.value} payouts per account max (${fp.maxPayouts.source})`,
          fp.safetyNet && `${fp.safetyNet.value} (${fp.safetyNet.source})`,
          fp.inactivity && `${fp.inactivity.value} (${fp.inactivity.source})`,
          ...(fp.gotchas ?? []).map((g) => `${g.value} (${g.source})`),
        ].filter(Boolean)
      : [],
  };
}

export interface FactSheetInput {
  account: Account;
  accounts: Account[];
  /** Today's committed Preflight limits, if any. */
  plan?: DayPlanLimits;
  today: string;
  /** What the trader asked Pilot to remember. */
  notes?: string[];
}

/** Everything Pilot knows for certain, as numbers it can quote. */
export function buildFactSheet({ account, accounts, plan, today, notes = [] }: FactSheetInput) {
  const scope = accountsInScope(accounts);
  const liq = computeLiquidation(account, { today, personalDailyLimit: account.personalDailyLimit ?? plan?.maxLoss ?? null });
  const stop = evaluateDailyStop(account, today, plan ?? {});
  const payout = payoutWindow(account, today);
  const odds = accountPassOdds(account, dailySamples(scope));
  const ledger = computeLedger(scope);
  const coach = buildCoachInsights(account.trades).slice(0, 5);
  const since = new Date(`${today}T12:00:00`);
  since.setDate(since.getDate() - 30);
  const cutoff = since.toISOString().slice(0, 10);
  const last30 = account.trades.filter((t) => t.date.slice(0, 10) > cutoff);

  return {
    today,
    howToUse:
      'Computed by TradePilot from the journal. Quote these numbers rather than recomputing them. Use the lookup tools for anything not here.',
    account: {
      id: account.id,
      name: account.name,
      stage: account.isFunded === true ? 'funded' : account.isFunded === false ? 'evaluation' : 'unknown',
      status: account.status,
      sample: account.type === 'demo',
      startingBalance: account.startingBalance ?? null,
      netPnL: r0(account.balance),
    },
    firm: firmFacts(account, today),
    risk: liq
      ? {
          roomToLose: r0(Math.max(0, liq.roomToStop)),
          roomBindsOn: liq.bindingConstraint === 'daily' ? "today's daily stop" : 'account drawdown',
          cushionToLiquidation: r0(liq.cushion),
          liquidatesAtBalance: r0(liq.threshold),
          bufferLeftPct: pct(liq.bufferRemaining),
          thresholdLocked: liq.locked,
          averageLosersSurvivable: liq.lossesSurvived,
          worstCaseLosersSurvivable: liq.worstCaseLossesSurvived,
          estimatedFromClosedTradesOnly: liq.estimated,
        }
      : 'No drawdown rules known for this account.',
    todaySession: {
      pnl: r0(stop.todayPnL),
      trades: stop.tradesToday,
      doneForToday: stop.stopped,
      stopReasons: stop.reasons.map((r) => r.text),
      warning: stop.warning?.text ?? null,
      lossLimit: stop.lossLimit,
      profitGoal: stop.profitGoal,
      consistencyCapToday: stop.consistencyCeiling === null ? null : r0(stop.consistencyCeiling),
      plan: plan ?? null,
    },
    payout: payout
      ? {
          status: payout.status,
          blockers: payout.blockers.map((b) => b.text),
          cycleProfit: r0(payout.cycleProfit),
          requestable: r0(payout.requestable),
          afterSplit: r0(payout.afterSplit),
          earliestDate: payout.earliestDate,
          qualifyingDays: `${payout.days.have}/${payout.days.need}`,
          payoutsTaken: payout.payoutsTaken,
        }
      : account.isFunded === true
        ? 'Firm rules unknown, so payout readiness cannot be checked.'
        : 'Not a funded account.',
    passOdds: odds
      ? { pass: pct(odds.pass), blow: pct(odds.blow), outOfTime: pct(odds.timeout), medianDaysToPass: odds.medianDays, method: 'Bootstrap of the trader’s own daily results against the firm rules, from where the account stands.' }
      : null,
    performance: {
      allTime: tradeSummary(account.trades),
      last30Days: tradeSummary(last30),
      byHour: groupStats(account.trades, 'hour'),
      byWeekday: groupStats(account.trades, 'weekday'),
      bySetup: groupStats(account.trades, 'setup').slice(0, 8),
      bySymbol: groupStats(account.trades, 'symbol').slice(0, 6),
    },
    coachFindings: coach.map((c) => ({
      title: c.title,
      finding: c.detail,
      evidence: c.evidence ?? [],
      dollarImpact: r0(c.weight),
      habitToTry: c.action,
    })),
    allAccounts: {
      scope: scope.some((a) => a.type === 'demo') ? 'sample accounts' : 'trader’s own accounts',
      list: scope.map((a) => ({ id: a.id, name: a.name, firm: resolveFirm(a)?.firm.name ?? a.broker, status: a.status, stage: a.isFunded ? 'funded' : 'evaluation', net: r0(a.balance) })),
      ledger: {
        feesPaid: r0(ledger.spent),
        payoutsReceived: r0(ledger.received),
        net: r0(ledger.net),
        returnOnFeesPct: ledger.returnOnFees === null ? null : pct(ledger.returnOnFees),
        evalPassRatePct: ledger.evals.passRate === null ? null : pct(ledger.evals.passRate),
        fundedToPaidPct: ledger.funded.payoutRate === null ? null : pct(ledger.funded.payoutRate),
        byFirm: ledger.byFirm.map((f) => ({ firm: f.label, spent: r0(f.spent), received: r0(f.received), net: r0(f.net) })),
      },
      copyTradedGroups: findCopyGroups(scope).map((g) => ({
        accounts: g.members.map((m) => m.name),
        combinedWorstDay: r0(g.combinedWorstDay),
        wouldEndOnWorstDay: g.blowCount,
      })),
    },
    traderNotes: notes,
  };
}

export type FactSheet = ReturnType<typeof buildFactSheet>;
