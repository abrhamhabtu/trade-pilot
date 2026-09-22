// ─── Pilot's lookups ───────────────────────────────────────────────────────────
// Read-only questions the model can ask of the journal mid-answer. The journal
// lives in the browser, so these run there: the server only relays the call.
// Nothing here can write a record, place an order or change a stop.
//
// Plain data so both the API route (to declare them) and the browser (to run
// them) can import it.
// ───────────────────────────────────────────────────────────────────────────────

import { PROP_FIRMS } from '@/components/payout/propFirmData';

export interface ToolDef {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: false;
  };
}

const accountId = { type: 'string', description: 'Account id from the fact sheet. Omit for the selected account.' };
const date = (what: string) => ({ type: 'string', description: `${what}, YYYY-MM-DD.`, pattern: '^\\d{4}-\\d{2}-\\d{2}$' });

const evalPrograms = PROP_FIRMS.filter((f) => f.payoutModel === 'eval' && f.id !== 'custom')
  .map((f) => `${f.id} (${f.name} ${f.program}: ${f.tiers.map((t) => t.id).join(', ')})`)
  .join('; ');

export const PILOT_TOOLS: ToolDef[] = [
  {
    name: 'find_trades',
    description:
      'Find trades matching filters and get their summary (count, net, win rate, best/worst day) plus up to `limit` trades. Use to check a pattern, count occurrences or cite example dates.',
    parameters: {
      type: 'object',
      properties: {
        account_id: accountId,
        from: date('First date, inclusive'),
        to: date('Last date, inclusive'),
        symbol: { type: 'string', description: 'Exact symbol, e.g. MNQ.' },
        setup: { type: 'string', description: 'Recorded setup/strategy name; case-insensitive substring.' },
        side: { type: 'string', enum: ['Long', 'Short'] },
        result: { type: 'string', enum: ['win', 'loss'] },
        hour_from: { type: 'integer', minimum: 0, maximum: 23, description: 'Entry hour at or after, 24h clock.' },
        hour_to: { type: 'integer', minimum: 0, maximum: 23, description: 'Entry hour at or before, 24h clock.' },
        limit: { type: 'integer', minimum: 0, maximum: 30, description: 'Trades to return (default 15).' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'session_detail',
    description: 'Every trade on one date in order, with the running P&L through the session. Use to recap or diagnose a specific day.',
    parameters: {
      type: 'object',
      properties: { account_id: accountId, date: date('The session date') },
      required: ['date'],
      additionalProperties: false,
    },
  },
  {
    name: 'stats_by',
    description: 'P&L, trade count and win rate grouped by hour of entry, weekday, setup, symbol or side, optionally within a date range.',
    parameters: {
      type: 'object',
      properties: {
        account_id: accountId,
        dimension: { type: 'string', enum: ['hour', 'weekday', 'setup', 'symbol', 'side'] },
        from: date('First date, inclusive'),
        to: date('Last date, inclusive'),
      },
      required: ['dimension'],
      additionalProperties: false,
    },
  },
  {
    name: 'simulate_pass_odds',
    description: `Simulate the trader's chance to pass an evaluation by resampling their own daily results against its rules, optionally at a different size (risk_scale 0.5 = half size). Programs and tier ids: ${evalPrograms}.`,
    parameters: {
      type: 'object',
      properties: {
        firm_id: { type: 'string' },
        tier_id: { type: 'string' },
        risk_scale: { type: 'number', minimum: 0.25, maximum: 3, description: 'Multiplier on every daily result. Default 1.' },
      },
      required: ['firm_id', 'tier_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'compare_evaluations',
    description: 'Rank every evaluation program and size by expected fees per pass for this trader, with pass and blow rates.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'payout_status',
    description: 'Whether funded accounts can request a payout now, what blocks them, the amount after split and the earliest date. Omit account_id for every funded account.',
    parameters: { type: 'object', properties: { account_id: accountId }, additionalProperties: false },
  },
  {
    name: 'firm_rules',
    description: 'Core rules and fine print (news policy, payout caps, minimums, safety nets, inactivity) for a program, each with its source.',
    parameters: {
      type: 'object',
      properties: { firm_id: { type: 'string', enum: PROP_FIRMS.filter((f) => f.id !== 'custom').map((f) => f.id) } },
      required: ['firm_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'ledger_detail',
    description: 'Fees paid and payouts received per account, by fee type and by month.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
];

/** A short, human line for the UI while a lookup runs. */
export function toolLabel(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case 'find_trades':
      return `Searching trades${input.setup ? ` for ${input.setup}` : ''}${input.from ? ` from ${input.from}` : ''}`;
    case 'session_detail':
      return `Replaying ${input.date}`;
    case 'stats_by':
      return `Breaking results down by ${input.dimension}`;
    case 'simulate_pass_odds':
      return `Simulating ${input.tier_id}${input.risk_scale && input.risk_scale !== 1 ? ` at ${input.risk_scale}× size` : ''}`;
    case 'compare_evaluations':
      return 'Comparing every evaluation';
    case 'payout_status':
      return 'Checking payout windows';
    case 'firm_rules':
      return `Reading ${input.firm_id} rules`;
    case 'ledger_detail':
      return 'Reading the ledger';
    default:
      return name;
  }
}
