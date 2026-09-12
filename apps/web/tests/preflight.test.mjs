import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluatePreflight,
  conditionScore,
  redDayStreak,
} from '../src/lib/preflight.ts';

const GOOD_CONDITION = { sleep: 8, stress: 1, focus: 5, lifeNoise: false };
const READY = {
  bufferRemaining: 0.9,
  redDayStreak: 0,
  brokeRulesLastSession: false,
  checklistComplete: 1,
  hasDailyStop: true,
  hasStopTime: true,
  hasMarketPlan: true,
};

const verdict = (c = {}, s = {}) =>
  evaluatePreflight({ ...GOOD_CONDITION, ...c }, { ...READY, ...s });

test('a fully prepared, rested trader gets full size', () => {
  const v = verdict();
  assert.equal(v.clearance, 'cleared');
  assert.equal(v.sizeMultiplier, 1);
  assert.ok(v.readiness >= 90);
  assert.equal(v.headline, 'Cleared for full size.');
});

test('gates cannot be outweighed by feeling great', () => {
  const v = verdict({}, { checklistComplete: 0.75 });
  assert.equal(v.clearance, 'incomplete');
  assert.equal(v.sizeMultiplier, 0, 'no size until preflight is finished');
  assert.ok(v.reasons.some((r) => r.id === 'gate-checklist' && r.severity === 'gate'));
});

test('every missing commitment raises its own gate', () => {
  const v = verdict({}, {
    checklistComplete: 0,
    hasDailyStop: false,
    hasStopTime: false,
    hasMarketPlan: false,
  });
  const gates = v.reasons.filter((r) => r.severity === 'gate').map((r) => r.id);
  assert.deepEqual(gates.sort(), [
    'gate-checklist',
    'gate-plan',
    'gate-stop',
    'gate-time',
  ]);
});

test('severe sleep loss grounds the trader outright', () => {
  const v = verdict({ sleep: 3 });
  assert.equal(v.clearance, 'grounded');
  assert.equal(v.sizeMultiplier, 0);
  assert.equal(v.headline, 'Stand down today.');
});

test('the most restrictive signal wins, never the average', () => {
  // Elevated stress alone is 0.75; a thin buffer alone is 0.5. Together: 0.5.
  const v = verdict({ stress: 4 }, { bufferRemaining: 0.15 });
  assert.equal(v.sizeMultiplier, 0.5);
  assert.equal(v.clearance, 'restricted');
  assert.equal(v.headline, 'Cleared at 50% size.');
});

test('good sleep does not cancel a thin buffer', () => {
  const v = verdict({ sleep: 9, stress: 1, focus: 5 }, { bufferRemaining: 0.1 });
  assert.equal(v.sizeMultiplier, 0.5);
  assert.ok(v.reasons.some((r) => r.id === 'buffer-thin' && r.severity === 'stop'));
});

test('breaking rules last session costs size today', () => {
  const v = verdict({}, { brokeRulesLastSession: true });
  assert.equal(v.sizeMultiplier, 0.5);
  assert.ok(v.reasons.some((r) => r.id === 'broke-rules'));
});

test('red-day streaks tighten size in steps', () => {
  assert.equal(verdict({}, { redDayStreak: 1 }).sizeMultiplier, 1);
  assert.equal(verdict({}, { redDayStreak: 2 }).sizeMultiplier, 0.75);
  assert.equal(verdict({}, { redDayStreak: 3 }).sizeMultiplier, 0.5);
});

test('unknown buffer does not invent a restriction', () => {
  const v = verdict({}, { bufferRemaining: null });
  assert.equal(v.clearance, 'cleared');
  assert.equal(v.sizeMultiplier, 1);
});

test('condition score weights sleep above the rest', () => {
  const rested = conditionScore({ sleep: 8, stress: 3, focus: 3, lifeNoise: false });
  const wrecked = conditionScore({ sleep: 4, stress: 3, focus: 3, lifeNoise: false });
  assert.ok(rested > wrecked);
  assert.ok(conditionScore(GOOD_CONDITION) > 0.95);
  assert.ok(
    conditionScore({ ...GOOD_CONDITION, lifeNoise: true }) <
      conditionScore(GOOD_CONDITION),
  );
  assert.ok(conditionScore({ sleep: 0, stress: 5, focus: 1, lifeNoise: true }) === 0);
});

test('red-day streak counts back from yesterday only', () => {
  const trades = [
    { date: '2026-01-05', netPL: -100 }, // today — must be ignored
    { date: '2026-01-04', netPL: -50 },
    { date: '2026-01-03', netPL: -20 },
    { date: '2026-01-02', netPL: 300 },
    { date: '2026-01-01', netPL: -10 },
  ];
  assert.equal(redDayStreak(trades, '2026-01-05'), 2);
  assert.equal(redDayStreak([], '2026-01-05'), 0);
});

test('a day that nets flat breaks the streak', () => {
  const trades = [
    { date: '2026-01-04', netPL: -100 },
    { date: '2026-01-04', netPL: 100 },
    { date: '2026-01-03', netPL: -20 },
  ];
  assert.equal(redDayStreak(trades, '2026-01-05'), 0);
});
