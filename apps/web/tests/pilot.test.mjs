import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPremarketBriefing,
  revengeTrades,
  summarizeToday,
  tagTrade,
  answerPilot,
} from '../src/lib/pilot/prepEngine.ts';

const friday = new Date(2026, 8, 11, 7, 30); // Friday Sep 11 2026

const trades = [
  { date: '2026-09-04', time: '09:45', netPL: 220, outcome: 'win', strategy: 'Failed Auction' },
  { date: '2026-09-04', time: '10:10', netPL: 80, outcome: 'win', strategy: 'Failed Auction' },
  { date: '2026-09-05', time: '14:20', netPL: -180, outcome: 'loss', strategy: 'ORB' },
  { date: '2026-09-05', time: '14:22', netPL: -90, outcome: 'loss', strategy: 'ORB' },
  { date: '2026-09-11', time: '10:05', netPL: -40, outcome: 'loss', strategy: 'Failed Auction' },
  { date: '2026-09-11', time: '10:40', netPL: -60, outcome: 'loss', strategy: 'Failed Auction' },
  { date: '2026-09-11', time: '14:15', netPL: -120, outcome: 'loss', strategy: 'Failed Auction' },
];

test('revenge trades flag a re-entry within 5 minutes of a loss', () => {
  const flagged = revengeTrades(trades);
  assert.equal(flagged.length, 1);
  assert.equal(flagged[0].time, '14:22');
});

test('Friday briefing warns on a red weekday and names the A+ setup', () => {
  const brief = buildPremarketBriefing(trades, friday, {
    setup: 'Failed Auction',
    finishTime: '11:00',
    maxTrades: 2,
    symbol: 'MNQ',
  });
  assert.equal(brief.weekday, 'Friday');
  assert.match(brief.recommendation, /Failed Auction/);
  assert.match(brief.recommendation, /11:00/);
  assert.ok(brief.patterns.some((p) => /Friday/i.test(p.title) || /Friday/i.test(p.detail)));
  assert.ok(brief.events.some((e) => e.time === '11:00'));
  assert.equal(brief.focusSetup, 'Failed Auction');
});

test('ask Pilot answers from the briefing, not generic pep talk', () => {
  const brief = buildPremarketBriefing(trades, friday, { setup: 'Failed Auction' });
  const answer = answerPilot('Why do I keep losing on Fridays?', trades, brief);
  assert.match(answer, /Friday/i);
  const empty = answerPilot('How am I doing?', [], brief);
  assert.match(empty, /tape/i);
});

test('today summary and tags', () => {
  const today = summarizeToday(trades, '2026-09-11');
  assert.equal(today.trades, 3);
  assert.ok(today.pnl < 0);
  const tags = tagTrade(trades[3], trades);
  assert.ok(tags.includes('Revenge risk'));
});
