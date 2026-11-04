import test from "node:test";
import assert from "node:assert/strict";
import { MIN_SAMPLE, addDays, buildDays, currentStreak, inMonth, minuteOf, monthCsv, newsOn, pace, patterns, summarize, toReview, upcoming, weekdayOf, weekdaysLeft } from "../src/lib/calendarStats.ts";

const t = (date, netPL, time, extra = {}) => ({ date, netPL, time, outcome: netPL > 0 ? "win" : "loss", ...extra });

test("the first of a month stays in that month, in any time zone", () => {
  const old = process.env.TZ;
  for (const tz of ["America/Los_Angeles", "Asia/Tokyo", "UTC"]) {
    process.env.TZ = tz;
    const days = buildDays([t("2026-06-01", 100), t("2026-05-31", -50), t("2026-07-01", 7)]);
    assert.deepEqual(inMonth(days, 2026, 5).map((d) => d.date), ["2026-06-01"], tz);
    assert.equal(weekdayOf("2026-06-01"), 1, tz);
  }
  process.env.TZ = old;
});

test("a day's numbers and path follow the trades in time order", () => {
  const [d] = buildDays([t("2026-06-02", 50, "2:15 PM"), t("2026-06-02", -20, "9:30 AM", { symbol: "NQ" }), t("2026-06-02T00:00:00", 10, "12:05 PM", { symbol: "NQ" })]);
  assert.deepEqual(d.path, [0, -20, -10, 40]);
  assert.deepEqual([d.pnl, d.trades, d.wins, d.losses, d.bestTrade, d.worstTrade], [40, 3, 2, 1, 50, -20]);
  assert.deepEqual(d.symbols, ["NQ"]);
  assert.equal(minuteOf("12:05 AM"), 5);
  assert.equal(minuteOf("14:05"), 845);
  assert.equal(minuteOf(undefined), null);
});

test("a month's summary adds up", () => {
  const s = summarize(buildDays([t("2026-06-01", 300), t("2026-06-02", 100), t("2026-06-03", -200), t("2026-06-04", -100), t("2026-06-05", -100), t("2026-06-08", 500)]));
  assert.deepEqual([s.pnl, s.green, s.red, s.days, s.longestGreen, s.longestRed], [500, 3, 3, 6, 2, 3]);
  assert.equal(s.profitFactor, 900 / 400);
  assert.equal(s.best.date, "2026-06-08");
  assert.equal(s.worst.date, "2026-06-03");
  assert.equal(summarize(buildDays([t("2026-06-01", 5)])).profitFactor, null);
  assert.deepEqual(summarize([]).pnl, 0);
});

test("streaks count back from the latest day", () => {
  assert.deepEqual(currentStreak(buildDays([t("2026-06-01", 5), t("2026-06-02", -5), t("2026-06-03", -1)])), { kind: "red", n: 2 });
  assert.deepEqual(currentStreak([]), { kind: "none", n: 0 });
});

test("news lands on the right days, and upcoming sorts by date", () => {
  assert.ok(newsOn("2026-11-10").includes("cpi"));
  assert.ok(newsOn("2026-10-02").includes("jobs"));
  assert.ok(newsOn("2026-12-09").includes("fomc"));
  assert.ok(newsOn("2026-12-04").includes("jobs"), "a future first Friday");
  assert.deepEqual(newsOn("2026-11-11"), []);
  assert.ok(newsOn("2019-03-20", new Set(["2019-03-20"])).includes("fomc"));
  const u = upcoming("2026-11-03", { days: 40, payout: { date: "2026-11-05", amount: 900 } });
  assert.ok(u.every((e, i) => !i || u[i - 1].date <= e.date));
  assert.ok(u.some((e) => e.kind === "payout" && /\$900/.test(e.detail)));
  assert.ok(u.some((e) => e.kind === "cpi" && e.date === "2026-11-10"));
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

function history() {
  const out = [];
  for (let i = 0; i < 90; i++) {
    const date = addDays("2026-01-05", i);
    const w = weekdayOf(date);
    if (w === 0 || w === 6) continue;
    out.push(t(date, w === 2 ? -300 : 200, "9:45 AM"));
  }
  return out;
}

test("patterns find a real leak and say nothing on thin data", () => {
  const trades = history();
  const p = patterns(buildDays(trades), trades);
  assert.ok(p.weekday.find((b) => b.label === "Tue").pnl < 0);
  assert.ok(p.findings.some((f) => f.tone === "bad" && /Tues?/.test(f.text)), JSON.stringify(p.findings));
  const thin = [t("2026-06-02", -500), t("2026-06-03", 100)];
  assert.equal(patterns(buildDays(thin), thin).findings.length, 0);
  assert.ok(MIN_SAMPLE >= 5);
  assert.ok(!p.findings.some((f) => /NaN|undefined|Infinity/.test(f.text)));
});

test("the review list is the biggest unjournaled losses", () => {
  const days = buildDays([t("2026-06-01", -100), t("2026-06-02", -500), t("2026-06-03", -300), t("2026-06-04", 900)]);
  assert.deepEqual(toReview(days, (d) => d === "2026-06-02", 5).map((d) => d.date), ["2026-06-03", "2026-06-01"]);
});

test("pacing counts the weekdays left, including today", () => {
  assert.equal(weekdaysLeft(2026, 10, "2026-11-27"), 2);
  const month = buildDays([t("2026-11-02", 300), t("2026-11-03", 300), t("2026-11-04", 300)]);
  const p = pace(3000, month, 2026, 10, "2026-11-27");
  assert.equal(p.left, 2100);
  assert.equal(p.perDay, 1050);
  assert.equal(p.share, 0.3);
  assert.equal(p.projected, 900 + 300 * 2);
  assert.equal(pace(500, month, 2026, 10, "2026-11-27").perDay, null);
  assert.equal(pace(500, month.slice(0, 2), 2026, 10, "2026-11-27").projected, null);
});

test("the CSV has a row per day", () => {
  const csv = monthCsv(buildDays([t("2026-06-01", 12.5, "9:30 AM", { symbol: "NQ" })])).split("\n");
  assert.equal(csv.length, 2);
  assert.match(csv[1], /^2026-06-01,Mon,12\.50,1,1,0/);
});
