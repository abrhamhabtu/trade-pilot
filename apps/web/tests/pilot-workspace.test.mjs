import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SETTINGS,
  inspectTrade,
  prepareReviews,
  tradeMinute,
  playbookStats,
} from "../src/lib/pilot/workspace.ts";
const trade = (id, time, pnl, extra = {}) => ({
  id,
  date: "2026-09-10",
  time,
  netPL: pnl,
  symbol: "MNQ",
  quantity: 1,
  entryPrice: 100,
  exitPrice: 101,
  duration: 1,
  outcome: pnl < 0 ? "loss" : "win",
  ...extra,
});
const rules = { ...DEFAULT_SETTINGS.rules, finishTime: "16:00" };
test("AM/PM and invalid timestamps do not create false session labels", () => {
  assert.equal(tradeMinute("01:30 PM"), 810);
  assert.equal(tradeMinute("12:00 AM"), 0);
  assert.equal(tradeMinute("12:00 PM"), 720);
  assert.equal(tradeMinute("25:01"), null);
  assert.equal(tradeMinute("9:99"), null);
  assert.equal(tradeMinute(undefined), null);
  const t = trade("a", undefined, 10);
  assert.equal(inspectTrade(t, [t], rules).timingKnown, false);
  assert.ok(!inspectTrade(t, [t], rules).tags.includes("Opening session"));
});
test("cooldown uses the loss close, sorts imported history and ignores overlapping positions", () => {
  const loss = trade("loss", "01:00 PM", -100, { duration: 10 });
  const overlapping = trade("overlap", "01:03 PM", 10);
  const reentry = trade("reentry", "01:12 PM", 10);
  const all = [reentry, overlapping, loss];
  assert.ok(
    !inspectTrade(overlapping, all, rules).flags.some((f) =>
      f.includes("revenge"),
    ),
  );
  assert.ok(
    inspectTrade(reentry, all, rules).flags.some((f) => f.includes("revenge")),
  );
  assert.ok(
    !inspectTrade({ ...reentry, date: "2026-09-11" }, all, rules).flags.some(
      (f) => f.includes("revenge"),
    ),
  );
});
test("trade cap equality is allowed; oversizing and loss limit are explicit", () => {
  const all = [
    trade("a", "09:00", -300),
    trade("b", "10:00", -250),
    trade("c", "11:00", 10),
    trade("d", "12:00", 10, { quantity: 3 }),
  ];
  assert.ok(
    !inspectTrade(all[2], all, rules).flags.some((f) =>
      f.includes("trade limit"),
    ),
  );
  const flags = inspectTrade(all[3], all, rules).flags.join(" ");
  assert.match(flags, /4 exceeds/);
  assert.match(flags, /3 contracts/);
  assert.match(flags, /after your realized daily loss/);
});
test("account-specific batches remain isolated and automatic drafts never overwrite notes", () => {
  const a = [trade("a", "09:30", -100, { notes: "My own observation" })];
  const b = [trade("b", "09:33", 20)];
  const settings = { ...DEFAULT_SETTINGS, tags: true, notes: true, rules };
  const result = prepareReviews(a, settings);
  assert.equal(result[0].notes, "My own observation");
  assert.ok(result[0].pilotReview.note);
  assert.equal(prepareReviews(result, settings), result, "idempotent replay");
  assert.equal(
    prepareReviews(b, DEFAULT_SETTINGS),
    b,
    "disabled agents do not write",
  );
  assert.ok(
    !inspectTrade(b[0], b, rules).flags.some((f) => f.includes("revenge")),
  );
});
test("rule edits regenerate drafts; strategy statistics expose sample size", () => {
  const all = [trade("a", "09:30", 100, { strategy: "ORB", quantity: 2 })];
  const settings = { ...DEFAULT_SETTINGS, tags: true, notes: true };
  const result = prepareReviews(all, settings);
  const next = prepareReviews(result, {
    ...settings,
    rules: { ...settings.rules, maxContracts: 1 },
  });
  assert.match(next[0].pilotReview.note, /2 contracts exceeds/);
  assert.deepEqual(playbookStats(all), [
    { name: "ORB", count: 1, wins: 1, pnl: 100 },
  ]);
});

test("late imports refresh dependent drafts without changing accepted notes", () => {
  const settings = { ...DEFAULT_SETTINGS, tags: true, notes: true, rules };
  const first = prepareReviews(
    [trade("later", "10:03", 10, { notes: "Keep this" })],
    settings,
  );
  const merged = prepareReviews(
    [...first, trade("earlier", "10:00", -100)],
    settings,
  );
  assert.match(merged[0].pilotReview.note, /revenge/);
  assert.equal(merged[0].notes, "Keep this");
});
test("unclosed losses do not trigger a realized daily-limit entry flag", () => {
  const a = trade("a", "09:00", -600, { duration: 120 });
  const b = trade("b", "09:10", 50);
  assert.ok(
    !inspectTrade(b, [a, b], rules).flags.some((f) =>
      f.includes("realized daily"),
    ),
  );
});

test("manual review fills in notes even when only tagging automation is enabled", () => {
  const settings = { ...DEFAULT_SETTINGS, tags: true };
  const automatic = prepareReviews([trade("a", "09:30", 10)], settings);
  assert.equal(automatic[0].pilotReview.note, "");
  const manual = prepareReviews(automatic, settings, true);
  assert.ok(manual[0].pilotReview.note);
  assert.equal(prepareReviews(manual, settings), manual);
});
