// Runs Pilot's lookups in the browser, against the trader's own journal.
// Model-supplied input is untrusted: each call is checked against its schema
// before anything runs, and a bad call gets an error back instead of a guess.

import type { Account } from '@/store/accountStore';
import { accountsInScope } from '@/store/accountStore';
import { getFirmById, PROP_FIRMS } from '@/components/payout/propFirmData';
import { finePrintFor } from '@/components/payout/firmFinePrint';
import { payoutWindow } from '@/lib/payoutSchedule';
import { compareFirms, dailySamples, MIN_SAMPLE_DAYS, rulesFromFirm, simulateOdds } from '@/lib/passOdds';
import { computeLedger } from '@/lib/propLedger';
import { orderedTrades, tradeMinute } from '@/lib/pilot/workspace';
import { groupStats, tradeSummary } from '@/lib/pilot/facts';
import { PILOT_TOOLS, type ToolDef } from '@/lib/pilot/toolDefs';

export interface ToolContext {
  account: Account;
  accounts: Account[];
  today: string;
}

type Input = Record<string, unknown>;

/** Checks input against a tool's JSON schema subset. Returns an error message, or null when valid. */
export function validateToolInput(def: ToolDef, input: unknown): string | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return 'Input must be an object.';
  const props = def.parameters.properties as Record<string, { type?: string; enum?: unknown[]; pattern?: string; minimum?: number; maximum?: number }>;
  for (const key of def.parameters.required ?? []) {
    if ((input as Input)[key] === undefined) return `Missing required field "${key}".`;
  }
  for (const [key, value] of Object.entries(input as Input)) {
    const spec = props[key];
    if (!spec) return `Unknown field "${key}".`;
    if (value === undefined || value === null) continue;
    if (spec.type === 'string' && typeof value !== 'string') return `"${key}" must be a string.`;
    if (spec.type === 'integer' && !(typeof value === 'number' && Number.isInteger(value))) return `"${key}" must be a whole number.`;
    if (spec.type === 'number' && !(typeof value === 'number' && Number.isFinite(value))) return `"${key}" must be a number.`;
    if (spec.enum && !spec.enum.includes(value)) return `"${key}" must be one of ${spec.enum.join(', ')}.`;
    if (spec.pattern && typeof value === 'string' && !new RegExp(spec.pattern).test(value)) return `"${key}" has the wrong format.`;
    if (typeof value === 'number' && spec.minimum !== undefined && value < spec.minimum) return `"${key}" must be at least ${spec.minimum}.`;
    if (typeof value === 'number' && spec.maximum !== undefined && value > spec.maximum) return `"${key}" must be at most ${spec.maximum}.`;
  }
  return null;
}

function pickAccount(ctx: ToolContext, id: unknown): Account {
  if (typeof id === 'string' && id) {
    const found = ctx.accounts.find((a) => a.id === id);
    if (!found) throw new Error(`No account with id "${id}". Use an id from the fact sheet.`);
    return found;
  }
  return ctx.account;
}

const inRange = (d: string, from?: unknown, to?: unknown) =>
  (typeof from !== 'string' || d >= from) && (typeof to !== 'string' || d <= to);

const compact = (t: Account['trades'][number]) => ({
  date: t.date.slice(0, 10),
  time: t.time ?? null,
  symbol: t.symbol,
  side: t.side ?? null,
  qty: t.quantity,
  netPL: Math.round(t.netPL * 100) / 100,
  minutes: t.duration,
  setup: t.strategy ?? null,
  note: t.notes ? t.notes.slice(0, 200) : null,
});

const RUNNERS: Record<string, (input: Input, ctx: ToolContext) => unknown> = {
  find_trades(input, ctx) {
    const account = pickAccount(ctx, input.account_id);
    const setup = typeof input.setup === 'string' ? input.setup.toLowerCase() : null;
    const matched = orderedTrades(account.trades).filter((t) => {
      const d = t.date.slice(0, 10);
      if (!inRange(d, input.from, input.to)) return false;
      if (input.symbol && t.symbol !== input.symbol) return false;
      if (setup && !(t.strategy ?? '').toLowerCase().includes(setup)) return false;
      if (input.side && t.side !== input.side) return false;
      if (input.result === 'win' && !(t.netPL > 0)) return false;
      if (input.result === 'loss' && !(t.netPL < 0)) return false;
      if (input.hour_from !== undefined || input.hour_to !== undefined) {
        const m = tradeMinute(t.time);
        if (m === null) return false;
        const h = Math.floor(m / 60);
        if (typeof input.hour_from === 'number' && h < input.hour_from) return false;
        if (typeof input.hour_to === 'number' && h > input.hour_to) return false;
      }
      return true;
    });
    const limit = typeof input.limit === 'number' ? input.limit : 15;
    return {
      account: account.name,
      summary: tradeSummary(matched),
      shareOfAllTrades: account.trades.length ? `${Math.round((matched.length / account.trades.length) * 100)}%` : null,
      trades: matched.slice(-limit).map(compact),
      truncated: matched.length > limit,
    };
  },

  session_detail(input, ctx) {
    const account = pickAccount(ctx, input.account_id);
    const day = orderedTrades(account.trades).filter((t) => t.date.slice(0, 10) === input.date);
    let running = 0;
    return {
      account: account.name,
      date: input.date,
      net: Math.round(day.reduce((n, t) => n + t.netPL, 0)),
      trades: day.map((t) => {
        running += t.netPL;
        return { ...compact(t), runningPnL: Math.round(running) };
      }),
      note: day.length ? undefined : 'No trades on this date.',
    };
  },

  stats_by(input, ctx) {
    const account = pickAccount(ctx, input.account_id);
    const trades = account.trades.filter((t) => inRange(t.date.slice(0, 10), input.from, input.to));
    return { account: account.name, dimension: input.dimension, rows: groupStats(trades, input.dimension as 'hour') };
  },

  simulate_pass_odds(input, ctx) {
    const firm = PROP_FIRMS.find((f) => f.id === input.firm_id);
    if (!firm) throw new Error(`Unknown firm_id "${input.firm_id}".`);
    const tier = firm.tiers.find((t) => t.id === input.tier_id);
    if (!tier) throw new Error(`Unknown tier_id "${input.tier_id}" for ${firm.id}. Valid: ${firm.tiers.map((t) => t.id).join(', ')}.`);
    const samples = dailySamples(accountsInScope(ctx.accounts));
    if (samples.length < MIN_SAMPLE_DAYS) return { error: `Only ${samples.length} trading days recorded; need ${MIN_SAMPLE_DAYS}.` };
    const odds = simulateOdds(samples, rulesFromFirm(firm, tier), { riskScale: typeof input.risk_scale === 'number' ? input.risk_scale : 1 });
    return {
      program: `${firm.name} ${firm.program} ${tier.label}`,
      riskScale: input.risk_scale ?? 1,
      passPct: Math.round(odds.pass * 1000) / 10,
      blowPct: Math.round(odds.blow * 1000) / 10,
      outOfTimePct: Math.round(odds.timeout * 1000) / 10,
      medianDaysToPass: odds.medianDays,
      optimisticBecauseIntradayTrailing: odds.optimistic,
      basedOnTradingDays: samples.length,
    };
  },

  compare_evaluations(_input, ctx) {
    const samples = dailySamples(accountsInScope(ctx.accounts));
    if (samples.length < MIN_SAMPLE_DAYS) return { error: `Only ${samples.length} trading days recorded; need ${MIN_SAMPLE_DAYS}.` };
    return compareFirms(samples).slice(0, 8).map((r) => ({
      program: `${r.firm.name} ${r.firm.program} ${r.tier.label}`,
      firm_id: r.firm.id,
      tier_id: r.tier.id,
      passPct: Math.round(r.odds.pass * 1000) / 10,
      blowPct: Math.round(r.odds.blow * 1000) / 10,
      medianDays: r.odds.medianDays,
      feesPerAttempt: Math.round(r.costPerAttempt),
      feesPerPass: r.costPerPass === null ? null : Math.round(r.costPerPass),
    }));
  },

  payout_status(input, ctx) {
    const targets = input.account_id ? [pickAccount(ctx, input.account_id)] : accountsInScope(ctx.accounts);
    const rows = targets
      .map((a) => ({ a, w: payoutWindow(a, ctx.today) }))
      .filter((x) => x.w)
      .map(({ a, w }) => ({
        account: a.name,
        status: w!.status,
        blockers: w!.blockers.map((b) => b.text),
        requestable: Math.round(w!.requestable),
        afterSplit: Math.round(w!.afterSplit),
        earliestDate: w!.earliestDate,
        qualifyingDays: `${w!.days.have}/${w!.days.need}`,
      }));
    return rows.length ? rows : { note: 'No active funded accounts with known firm rules.' };
  },

  firm_rules(input) {
    const firm = getFirmById(String(input.firm_id));
    const fp = finePrintFor(firm.id);
    return {
      firm: firm.name,
      program: firm.program,
      rulesVerifiedOn: firm.rulesUpdated,
      drawdownType: firm.drawdownType,
      drawdownNote: firm.drawdownNote,
      consistency: `${firm.consistencyPercent}% of ${firm.consistencyBasis === 'profitTarget' ? 'profit target' : 'total profit'}`,
      minTradingDays: firm.minTradingDays,
      profitSplit: firm.profitSplit,
      tiers: firm.tiers.map((t) => ({ id: t.id, size: t.label, target: t.profitTarget, drawdown: t.drawdown, dailyLossLimit: t.dailyLossLimit, maxContracts: t.maxContracts, listPrice: t.cost })),
      finePrint: fp ?? 'No fine print on file for this program.',
      notes: firm.notes,
      source: firm.sourceUrl,
    };
  },

  ledger_detail(_input, ctx) {
    const l = computeLedger(accountsInScope(ctx.accounts));
    return {
      byAccount: l.byAccount.map((r) => ({ account: r.label, spent: Math.round(r.spent), received: Math.round(r.received), net: Math.round(r.net), payouts: r.payouts, status: r.status })),
      feesByType: l.byKind,
      byMonth: l.months.map((m) => ({ month: m.month, spent: Math.round(m.spent), received: Math.round(m.received), runningNet: Math.round(m.cumulative) })),
      payoutsCountedGross: l.grossPayouts,
    };
  },
};

const MAX_RESULT = 12000;

/** Runs one lookup. Always returns text for the model: a JSON result, or an error it can read. */
export function runPilotTool(name: string, input: unknown, ctx: ToolContext): { content: string; isError: boolean } {
  const def = PILOT_TOOLS.find((t) => t.name === name);
  if (!def || !RUNNERS[name]) return { content: `Unknown tool "${name}".`, isError: true };
  const invalid = validateToolInput(def, input);
  if (invalid) return { content: `Invalid input: ${invalid}`, isError: true };
  try {
    const text = JSON.stringify(RUNNERS[name](input as Input, ctx));
    return { content: text.length > MAX_RESULT ? `${text.slice(0, MAX_RESULT)}… [truncated; narrow the filters]` : text, isError: false };
  } catch (e) {
    return { content: e instanceof Error ? e.message : 'Lookup failed.', isError: true };
  }
}
