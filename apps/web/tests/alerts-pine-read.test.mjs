import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_RULES, alertText, callScript, localClock, parseWebhook, routeAlert, scanLatest, xmlEscape } from "../src/lib/vision/alerts.ts";
import { PINE_STARTERS, addAlerts, alertMessage, analyzePine } from "../src/lib/vision/pineTools.ts";
import { gradeRead, parseRead, readPrompt } from "../src/lib/vision/read.ts";
import { coinFlipTest, prescribe } from "../src/lib/vision/doctor.ts";
import { runBacktest } from "../src/lib/vision/backtest.ts";
import { parseRules, TEMPLATES } from "../src/lib/vision/custom.ts";

const pacificWed = Date.parse("2026-11-04T14:35:00Z"); // 6:35 am Pacific, a Wednesday
const ev = (o = {}) => ({ source: "tradingview", title: "Double-break VWAP", symbol: "NQ", side: "long", price: 25000, stop: null, target: null, tf: "5m", message: "", at: 0, ...o });
const route = (e, o = {}) => routeAlert(e, DEFAULT_RULES, { now: pacificWed, tz: "America/Los_Angeles", last: {}, ...o });

test("a double-break VWAP calls; anything else texts; only the named rule fires for a named alert", () => {
  assert.deepEqual(route(ev()).channels.sort(), ["call", "telegram"]);
  const other = route(ev({ title: "EMA cross" }));
  assert.ok(other.channels.includes("sms") && !other.channels.includes("call"));
});

test("rules respect hours, days and quiet time", () => {
  assert.equal(localClock(pacificWed, "America/Los_Angeles").minute, 6 * 60 + 35);
  const late = route(ev(), { now: Date.parse("2026-11-05T01:00:00Z") });
  assert.ok(!late.channels.includes("call"));
  assert.ok(late.skipped.some((s) => /hours/.test(s.why)));
  const sat = route(ev(), { now: Date.parse("2026-11-07T15:00:00Z") });
  assert.equal(sat.channels.length, 0);
  const first = route(ev());
  const last = Object.fromEntries(first.fired.map((k) => [k, pacificWed]));
  const again = route(ev(), { now: pacificWed + 60_000, last });
  assert.ok(again.skipped.some((s) => /cooling/.test(s.why)));
  assert.ok(!again.channels.includes("call"));
  assert.ok(route(ev(), { now: pacificWed + 31 * 60_000, last }).channels.includes("call"));
});

test("webhooks accept JSON or plain words, and treat them as untrusted", () => {
  const a = parseWebhook('{"name":"VWAP touched","side":"buy","symbol":"mnq1!","price":"25010.5","tf":"5"}');
  assert.deepEqual([a.title, a.side, a.symbol, a.price], ["VWAP touched", "long", "MNQ1!", 25010.5]);
  assert.equal(parseWebhook("NQ crossed VWAP").title, "NQ crossed VWAP");
  assert.equal(parseWebhook('{"setup":"double-break-vwap"}').title, "double break vwap");
  assert.equal(parseWebhook(`{"name":"${"x".repeat(900)}"}`).title.length, 80);
  const s = callScript(ev({ title: `</Say><Dial>+15551234</Dial><Say>` }));
  assert.ok(!s.includes("<Dial>"), s);
  assert.equal(xmlEscape("a<b>&'\""), "a&lt;b&gt;&amp;&apos;&quot;");
  assert.match(alertText(ev()), /NQ LONG Double-break VWAP at 25000.*Check your chart/);
});

test("the watcher only reads closed bars, and sees a VWAP touch", () => {
  const bars = [];
  const t0 = Date.parse("2026-11-04T14:30:00Z") / 1000;
  for (let i = 0; i < 60; i++) {
    const away = i < 59;
    const c = away ? 100 + (i < 30 ? 0 : 5) + i * 0.3 : 112;
    bars.push({ t: t0 + i * 300, o: c, h: c + 0.5, l: away ? c - 0.5 : 80, c, v: 100 });
  }
  const closed = (bars.at(-1).t + 300) * 1000 + 1000;
  const touch = scanLatest(bars, "vwap_touch", 300, closed);
  assert.ok(touch && touch.t === bars.at(-1).t, "fires on the bar that touched");
  assert.equal(scanLatest(bars, "vwap_touch", 300, closed - 200_000), null, "not while that bar is still forming");
});

const SCRIPT = `//@version=5
indicator("My Script", overlay = true)
len = input.int(20, "Length")
src = input.source(close, title = "Source")
fast = ta.ema(close, len)
longSignal = ta.crossover(close, fast)
shortSignal = ta.crossunder(close, fast)
plot(fast)
alertcondition(longSignal and volume > 0, title = "Go long", message = "x")
`;

test("Pine: reads what a script is, what it can alert on, and common traps", () => {
  const i = analyzePine(SCRIPT);
  assert.deepEqual([i.version, i.kind, i.title, i.plots, i.inputs.length], [5, "indicator", "My Script", 1, 2]);
  assert.ok(i.conditions.some((c) => c.from === "alertcondition" && c.title === "Go long" && c.side === "long"));
  assert.ok(i.conditions.some((c) => c.name === "shortSignal" && c.side === "short"));
  assert.ok(!i.conditions.some((c) => c.name === "len" || c.name === "fast"));
  const trap = analyzePine(`//@version=6\nindicator("x")\na = request.security(syminfo.tickerid, "D", close, lookahead = barmerge.lookahead_on)`);
  assert.ok(trap.checks.some((c) => c.tone === "bad" && /future/.test(c.text)));
  assert.ok(analyzePine("plot(close)").checks.some((c) => c.tone === "bad"));
  assert.equal(analyzePine(`//@version=6\nstrategy("s")`).kind, "strategy");
});

test("Pine: adding alerts is repeatable and never writes the key into the script", () => {
  const once = addAlerts(SCRIPT, [{ expr: "longSignal", title: "Go long", side: "long" }]);
  assert.match(once, /if longSignal\n    alert\(/);
  assert.match(once, /alert\.freq_once_per_bar_close/);
  const twice = addAlerts(once, [{ expr: "shortSignal", title: "Go short", side: "short" }]);
  assert.equal((twice.match(/TradePilot alerts ──/g) ?? []).length, 2, "one start and one end marker");
  assert.ok(!twice.includes("if longSignal"));
  assert.ok(twice.includes("if shortSignal"));
  assert.ok(analyzePine(twice).hasOurAlerts);
  assert.ok(!twice.includes("key"));
  assert.match(alertMessage("A\"b"), /\{\{ticker\}\}/);
  assert.doesNotThrow(() => JSON.parse(alertMessage('A"b')));
});

test("every ready-made script is well formed and can alert", () => {
  for (const s of PINE_STARTERS) {
    const i = analyzePine(s.code);
    assert.equal(i.version, 6, s.id);
    assert.equal(i.kind, "indicator", s.id);
    assert.ok(i.alertCalls >= 1, s.id);
    assert.ok(i.title, s.id);
    assert.ok(!i.checks.some((c) => c.tone === "bad"), `${s.id}: ${JSON.stringify(i.checks)}`);
    const open = (s.code.match(/\(/g) ?? []).length;
    assert.equal(open, (s.code.match(/\)/g) ?? []).length, `${s.id} parens`);
  }
});

const truth = { high: 25200, low: 25000, last: 25100, lastCandle: "up", bars: 60 };
const answer = (o = {}) => JSON.stringify({ seen: { high: 25195, low: 25003, last: 25102, lastCandle: "up", trend: "up" }, read: "It's trending.", levels: [{ price: 25150, why: "swing" }], stance: "wait", invalidation: "A close below VWAP.", ...o });

test("a chart read is only trusted when it reads what the picture shows", () => {
  const good = gradeRead(parseRead(`Sure!\n\`\`\`json\n${answer()}\n\`\`\``), truth);
  assert.ok(good.verified);
  assert.ok(good.checks.every((c) => c.ok));
  const blind = gradeRead(parseRead(answer({ seen: { high: 26000, low: 24000, last: 25100, lastCandle: "up", trend: "up" } })), truth);
  assert.equal(blind.verified, false);
  const refused = gradeRead(parseRead(answer({ seen: { high: null, low: null, last: null, lastCandle: "", trend: "" } })), truth);
  assert.equal(refused.verified, false);
  const far = gradeRead(parseRead(answer({ levels: [{ price: 30000, why: "moon" }] })), truth);
  assert.ok(far.verified && far.checks.some((c) => !c.ok && /far off/.test(c.detail)));
  assert.equal(parseRead("I can't see anything."), null);
  assert.ok(!readPrompt({ market: "NQ", tf: "5m", facts: { scan: ["Trend: up"] } }).includes("25200"));
});

function market(days = 90, seed = 5) {
  let a = seed;
  const r = () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
  const bars = [];
  let px = 15000;
  for (let d = 0; d < days; d++) {
    const base = Date.UTC(2024, 0, 2 + d, 14, 30) / 1000;
    for (let i = 0; i < 78; i++) {
      const c = px + (r() - 0.5) * 12;
      bars.push({ t: base + i * 300, o: px, h: Math.max(px, c) + r() * 3, l: Math.min(px, c) - r() * 3, c, v: 100 });
      px = c;
    }
  }
  return bars;
}
const OPTS = { anchor: "rth", side: "both", pointValue: 2, contracts: 1, commission: 1, slippageTicks: 1, tick: 0.25, maxHold: 48, skipFomc: false, skipEarly: false, vix: "any", context: { fomc: [], early: [], vix: {} }, reader: "auto" };

test("new strategies parse from plain words and trade without seeing the future", () => {
  for (const id of ["coin", "reversal", "drive", "globex", "narrow", "inside", "gap", "last"]) {
    const t = TEMPLATES.find((x) => x.id === id);
    const { rules } = parseRules(t.text);
    assert.notEqual(rules.entry.kind, "pdhl_retest", id);
    const bars = market(60);
    const a = runBacktest(bars, { ...OPTS, custom: rules, maxPerDay: rules.maxPerDay });
    // Cutting off the future must not change any trade already taken.
    const half = bars.slice(0, Math.floor(bars.length * 0.6));
    const b = runBacktest(half, { ...OPTS, custom: rules, maxPerDay: rules.maxPerDay });
    const before = a.trades.filter((x) => x.exitIndex < half.length - 1);
    for (let k = 0; k < Math.min(before.length, b.trades.length); k++) assert.equal(before[k].entryT, b.trades[k].entryT, `${id} trade ${k}`);
    if (id === "coin") {
      assert.ok(a.trades.length > 40);
      const longs = a.trades.filter((x) => x.side === "long").length / a.trades.length;
      assert.ok(longs > 0.25 && longs < 0.75, `coin side split ${longs}`);
    }
  }
});

test("the coin flip test says a coin is a coin, and the doctor offers nothing false on noise", () => {
  const bars = market(120, 11);
  const r = runBacktest(bars, { ...OPTS, custom: parseRules(TEMPLATES.find((x) => x.id === "coin").text).rules });
  const c = coinFlipTest(bars, r.trades, { slip: 0.25, maxHold: 48, runs: 400 });
  assert.equal(c.trades, r.trades.length);
  assert.ok(c.low <= c.medianR && c.medianR <= c.high);
  assert.ok(c.beat > 0.01 && c.beat < 0.995, `beat ${c.beat}`);
  const d = prescribe(r);
  assert.ok(d.tried > 5);
  for (const p of d.prescriptions) {
    assert.ok(p.older.after.avgR > p.older.before.avgR);
    assert.ok(p.newer.after.avgR > p.newer.before.avgR);
  }
  assert.ok(d.tips.length >= 2);
});

test("the doctor doesn't find patterns in pure coin flips", () => {
  let offered = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const bars = market(200, seed * 13);
    const r = runBacktest(bars, { ...OPTS, custom: parseRules(TEMPLATES.find((x) => x.id === "coin").text).rules });
    offered += prescribe(r).prescriptions.length;
  }
  assert.ok(offered <= 1, `${offered} changes offered on noise across 6 runs`);
});

test("the doctor does find a real pattern, and calls a real edge better than a coin", () => {
  const bars = market(200, 21);
  const r = runBacktest(bars, { ...OPTS, custom: parseRules(TEMPLATES.find((x) => x.id === "coin").text).rules });
  const trades = r.trades.map((t) => (t.weekday === 2 ? { ...t, pnl: -Math.abs(t.riskUsd) * 1.5, r: -1.5 } : t));
  const d = prescribe({ ...r, trades });
  assert.ok(d.prescriptions.some((p) => p.id === "wd2"), d.prescriptions.map((p) => p.id).join());
});
