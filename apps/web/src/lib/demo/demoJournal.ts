import type { DailyNote } from '@/store/dailyNotesStore';
import type { Trade } from '@/store/tradingStore';
import { buildDemoAccounts, nowCutoff } from './demoData';

/**
 * Journal entries for the sample accounts, so the Journal, calendar and day reviews have
 * something real to show. Keyed `${accountId}:${date}` like the trader's own notes, so they
 * never mix with a real account's journal.
 */

const usd = (n: number) => `${n < 0 ? '-' : '+'}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;

const STORY: Record<string, Record<string, { grade: string; tags: string[]; body: string }>> = {
  'demo-account': {
    '2026-07-17': {
      grade: 'A',
      tags: ['payout', 'process'],
      body: '<p><strong>First payout requested.</strong> $2,000 out at the 90% split. The work was boring on purpose: one or two A+ setups a day, done by 11.</p><p>Rule for the next cycle: same size, same hours. Nothing changes because the account is bigger.</p>',
    },
    '2026-08-21': {
      grade: 'A',
      tags: ['payout'],
      body: '<p><strong>Second payout — $2,500.</strong> Consistency held under 40% the whole cycle. Afternoons are still my weak spot, so the 1pm hard stop stays.</p>',
    },
  },
  'demo-paid-out': {
    '2026-04-24': {
      grade: 'A',
      tags: ['payout', 'milestone'],
      body: '<p><strong>Final payout and account closed.</strong> Took $3,200 and retired the Lucid account on my terms instead of giving it back. Moving the process to the Topstep funded account next month.</p>',
    },
  },
  'demo-blown': {
    '2026-07-15': {
      grade: 'C',
      tags: ['oversized'],
      body: '<p>Went to 5 contracts on the second trade to "make it back". Got lucky it was small. This is how it starts.</p>',
    },
    '2026-07-16': {
      grade: 'D',
      tags: ['tilt', 'broke-rules'],
      body: '<p>Three losses before 11. Kept trading after my 2-loss rule. Drawdown room is down to under $900.</p><p>Tomorrow: 1 contract, one trade, or no trade.</p>',
    },
    '2026-07-17': {
      grade: 'F',
      tags: ['blown', 'tilt', 'lesson'],
      body: '<p><strong>Account blown.</strong> Ignored yesterday’s plan: sized up after the first loss, then again after the second. Third trade at 6 contracts took out the trailing drawdown.</p><p>Lesson: the rule that saves the account is the one I break when I’m upset. Two losses = platform closed.</p>',
    },
  },
};

function autoNote(trades: Trade[]): { grade: string; tags: string[]; body: string } {
  const net = trades.reduce((n, t) => n + t.netPL, 0);
  const wins = trades.filter((t) => t.netPL > 0).length;
  const setups = [...new Set(trades.map((t) => t.strategy).filter(Boolean))].join(', ');
  const afternoon = trades.some((t) => /PM/.test(t.time ?? '') && !/^12:/.test(t.time ?? ''));
  if (net > 0) {
    return {
      grade: wins === trades.length ? 'A' : 'B',
      tags: ['followed-plan'],
      body: `<p>${usd(net)} on ${trades.length} trade${trades.length === 1 ? '' : 's'} (${setups}). Waited for the level and let the trade work.</p>${afternoon ? '<p>Took an afternoon trade I didn’t need. Stay disciplined after lunch.</p>' : '<p>Done before lunch. That’s the job.</p>'}`,
    };
  }
  return {
    grade: trades.length >= 3 ? 'D' : 'C',
    tags: ['red-day', 'review'],
    body: `<p>${usd(net)} on ${trades.length} trade${trades.length === 1 ? '' : 's'}. ${trades.length >= 3 ? 'Forced it after the first loss — too many trades for this tape.' : 'Clean losses, stops respected. Nothing to fix but patience.'}</p><p>Tomorrow: wait for the first 15 minutes to settle before the first entry.</p>`,
  };
}

export function demoDailyNotes(): Record<string, DailyNote> {
  const notes: Record<string, DailyNote> = {};
  for (const account of buildDemoAccounts(nowCutoff())) {
    const byDay = new Map<string, Trade[]>();
    account.trades.forEach((t) => byDay.set(t.date, [...(byDay.get(t.date) ?? []), t]));
    const days = [...byDay.keys()].sort();
    // Scripted story days, plus the five most recent sessions of the live account.
    const picks = new Set([...Object.keys(STORY[account.id] ?? {}), ...(account.status === 'active' ? days.slice(-5) : [])]);
    for (const date of picks) {
      const trades = byDay.get(date);
      if (!trades) continue;
      const n = STORY[account.id]?.[date] ?? autoNote(trades);
      notes[`${account.id}:${date}`] = {
        date,
        accountId: account.id,
        content: n.body,
        images: [],
        lastUpdated: `${date}T21:30:00.000Z`,
        tags: n.tags,
        grade: n.grade,
      };
    }
  }
  return notes;
}
