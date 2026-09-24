import test from "node:test";
import assert from "node:assert/strict";
import {
  biasFor,
  calendarEvents,
  readMarket,
  rootSymbol,
  scheduledEvents,
  tradedRoots,
} from "../src/lib/pilot/market.ts";
import {
  DEFAULT_PLAN,
  adherence,
  autoNote,
  buildGamePlan,
  checkSignal,
  debrief,
  parseSignal,
  setupFamily,
} from "../src/lib/pilot/session.ts";
import { DEFAULT_SETTINGS } from "../src/lib/pilot/workspace.ts";
import { alertTemplate, pineScript } from "../src/lib/pilot/pine.ts";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

// Route modules import next/server, which only resolves under Next; load the
// webhook the way the other route tests do.
const require = createRequire(import.meta.url);
const routeSource = readFileSync(new URL("../src/app/api/signals/tradingview/route.ts", import.meta.url), "utf8");
const route = { exports: {} };
new Function("require", "module", "exports", ts.transpileModule(routeSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(require, route, route.exports);
const { GET, POST } = route.exports;

const rules = DEFAULT_SETTINGS.rules; // 3 trades, $500 stop, 2 contracts, 5m cooldown, 11:00 finish

// Unix seconds for a New York wall-clock time in September (EDT, UTC-4).
const et = (date, hhmm) => Date.parse(`${date}T${hhmm}:00-04:00`) / 1000;
const bar = (t, o, h, l, c, v = 100) => ({ t, o, h, l, c, v });

test("root symbols survive every way a platform writes a contract", () => {
  assert.equal(rootSymbol("MNQZ5"), "MNQ");
  assert.equal(rootSymbol("MNQZ25"), "MNQ");
  assert.equal(rootSymbol("CME_MINI:MNQ1!"), "MNQ");
  assert.equal(rootSymbol("/ES"), "ES");
  assert.equal(rootSymbol("MES 12-25"), "MES");
  // MNQ and NQ price from the same contract: one market read, not two.
  assert.deepEqual(tradedRoots(["MNQZ5", "NQZ5", "MNQZ5", "MESZ5", "XYZ"]), ["MNQ", "MES"]);
});

test("reads prior-day, overnight and RTH VWAP from 5-minute bars", () => {
  const bars = [
    // Prior RTH session, Sep 23.
    bar(et("2026-09-23", "09:30"), 100, 110, 95, 105),
    bar(et("2026-09-23", "15:55"), 105, 108, 90, 102),
    // Globex evening belongs to Sep 24's session.
    bar(et("2026-09-23", "19:00"), 102, 112, 101, 111),
    bar(et("2026-09-24", "04:00"), 111, 111, 98, 99),
    // Sep 24 RTH.
    bar(et("2026-09-24", "09:30"), 104, 106, 104, 106, 200),
    bar(et("2026-09-24", "09:35"), 106, 110, 106, 110, 100),
  ];
  const m = readMarket("MNQ", bars, null, Date.parse("2026-09-24T09:40:00-04:00"));
  assert.equal(m.sessionDate, "2026-09-24");
  assert.equal(m.pdh, 110);
  assert.equal(m.pdl, 90);
  assert.equal(m.prevClose, 102);
  assert.equal(m.onh, 112);
  assert.equal(m.onl, 98);
  assert.equal(m.rthOpen, 104);
  // Typical prices 105.33 (vol 200) and 108.67 (vol 100).
  assert.equal(m.vwap, 106.44);
});

test("bias says why, and a two-sided tape stays two-sided", () => {
  const up = biasFor({ price: 120, prevClose: 100, pdh: 115, pdl: 90, onh: 121, onl: 100, vwap: 110 }, null);
  assert.equal(up.bias, "bullish");
  assert.ok(up.reasons.some((r) => r.includes("prior-day high")));
  const mixed = biasFor({ price: 101, prevClose: 102, pdh: 110, pdl: 90, onh: 105, onl: 95, vwap: 100 }, null);
  assert.equal(mixed.bias, "balanced");
});

test("calendar keeps today's US high and medium events in New York time", () => {
  const rows = [
    { title: "CPI m/m", country: "USD", date: "2026-09-24T08:30:00-04:00", impact: "High", forecast: "0.3%", previous: "0.2%" },
    { title: "Crude Oil Inventories", country: "USD", date: "2026-09-24T10:30:00-04:00", impact: "Low" },
    { title: "ECB Speech", country: "EUR", date: "2026-09-24T09:00:00-04:00", impact: "High" },
    { title: "GDP", country: "USD", date: "2026-09-25T08:30:00-04:00", impact: "High" },
  ];
  assert.deepEqual(calendarEvents(rows, "2026-09-24"), [
    { date: "2026-09-24", time: "08:30", title: "CPI m/m", impact: "high", forecast: "0.3%", previous: "0.2%" },
  ]);
  // Fallback schedule: Thursday claims; first-Friday payrolls; Fed days.
  assert.equal(scheduledEvents("2026-09-24")[0].title, "Initial Jobless Claims");
  assert.ok(scheduledEvents("2026-10-02").some((e) => e.title.startsWith("Nonfarm")));
  assert.ok(scheduledEvents("2026-09-16").some((e) => e.title === "FOMC rate decision"));
});

const t = (id, time, pnl, extra = {}) => ({
  id, date: "2026-09-24", time, netPL: pnl, symbol: "MNQ", quantity: 1,
  entryPrice: 1, exitPrice: 1, duration: 3, outcome: pnl < 0 ? "loss" : "win",
  strategy: "VWAP Reclaim", ...extra,
});
const sig = (hhmm, extra = {}) =>
  parseSignal({ setup: "double-break-vwap", side: "long", symbol: "MNQ1!", price: 21450, ...extra }, et("2026-09-24", hhmm) * 1000, "s1");

test("a CPI morning pushes the first entry to the close of the first 15-minute candle", () => {
  const game = buildGamePlan({
    market: null,
    events: [{ date: "2026-09-24", time: "08:30", title: "CPI m/m", impact: "high" }],
    history: [],
    plan: { ...DEFAULT_PLAN, waitMinutes: 5 },
    rules,
    today: "2026-09-24",
  });
  assert.equal(game.firstEntry, 9 * 60 + 45);
  assert.match(game.lines.find((l) => l.kind === "event").text, /first 15-minute candle close \(9:45\)/);
});

test("signals are checked against the plan: opening candle, news, cooldown, cap", () => {
  const plan = { ...DEFAULT_PLAN, bias: "long" };
  const game = buildGamePlan({
    market: null,
    events: [{ date: "2026-09-24", time: "10:00", title: "Consumer Confidence", impact: "med" }],
    history: [], plan, rules, today: "2026-09-24",
  });
  const ctx = (minute, trades = []) => ({ minute, trades, rules, plan, game });

  assert.equal(checkSignal(sig("09:40"), ctx(9 * 60 + 40)).verdict, "wait");
  assert.match(checkSignal(sig("09:40"), ctx(9 * 60 + 40)).headline, /9:45/);
  assert.equal(checkSignal(sig("09:59"), ctx(9 * 60 + 59)).verdict, "wait"); // news window
  assert.equal(checkSignal(sig("09:50"), ctx(9 * 60 + 50)).verdict, "go");
  assert.equal(checkSignal(sig("09:50", { side: "short" }), ctx(9 * 60 + 50)).verdict, "caution");

  // A loss closed at 09:48 (09:45 + 3m): a 09:50 signal is inside the 5-minute cooldown.
  const cooled = checkSignal(sig("09:50"), ctx(9 * 60 + 50, [t("a", "09:45", -120)]));
  assert.equal(cooled.verdict, "wait");
  assert.match(cooled.headline, /cooldown/);

  const capped = checkSignal(sig("10:20"), ctx(10 * 60 + 20, [t("a", "09:46", 50), t("b", "09:55", 50), t("c", "10:10", 50)]));
  assert.equal(capped.checks.find((c) => c.label === "Trade count").state, "fail");
  assert.match(autoNote(sig("09:50"), checkSignal(sig("09:50"), ctx(9 * 60 + 50)), 9 * 60 + 50), /MNQ1! Double-break VWAP long @ 21,450 .*Pilot: cleared/);
});

test("parses whatever TradingView sends: our JSON, a template, or plain text", () => {
  const full = parseSignal({ setup: "sr-retest", side: "short", symbol: "mesz5", price: "5820.25", level: 5821, levelName: "PDH", closes: [1, 2, "3", "x"] }, 1, "a");
  assert.equal(full.setup, "sr-retest");
  assert.equal(full.side, "short");
  assert.equal(full.symbol, "MESZ5");
  assert.equal(full.price, 5820.25);
  assert.deepEqual(full.closes, [1, 2, 3]);
  const text = parseSignal("NQ crossing VWAP up, buy", 1, "b");
  assert.equal(text.setup, "double-break-vwap");
  assert.equal(text.side, "long");
});

test("setup families match how traders actually name them", () => {
  assert.equal(setupFamily("VWAP Reclaim"), "vwap");
  assert.equal(setupFamily("Support & Resistance"), "sr");
  assert.equal(setupFamily("Mean Reversion"), null);
});

test("adherence and debrief score the day against the plan", () => {
  const all = [t("a", "09:35", -100, { strategy: "ORB" }), t("b", "10:00", 300, { quantity: 4 })];
  const { items, score } = adherence(all, all, DEFAULT_PLAN, rules);
  assert.equal(items.find((i) => i.label.startsWith("Setup")).state, "fail");
  assert.equal(items.find((i) => i.label.startsWith("Sizing")).state, "fail");
  assert.equal(items.find((i) => i.label.startsWith("Entry")).state, "fail");
  assert.equal(score, 40);
  const d = debrief("2026-09-24", all, DEFAULT_PLAN, rules, []);
  assert.equal(d.pnl, 200);
  assert.match(d.tomorrow, /Nothing before 9:45/);
});

test("the Pine indicator carries the key, the plan's wait and the trader's own levels", () => {
  const src = pineScript({ key: "abcDEF1234567890xyz", waitMinutes: 30, levels: [{ label: "Weekly high", price: 21600.5 }] });
  assert.match(src, /^\/\/@version=6/);
  assert.match(src, /string KEY = "abcDEF1234567890xyz"/);
  assert.match(src, /input\.int\(30, "Skip the first N minutes/);
  assert.match(src, /input\.float\(21600\.5, "Weekly high/);
  assert.match(src, /alert\(f_payload\("double-break-vwap", "long"/);
  assert.match(alertTemplate("k"), /"price":\{\{close\}\}/);
});

test("webhook: needs a key, never leaks it, and keeps each key's signals apart", async () => {
  const url = (q) => `http://localhost:4040/api/signals/tradingview${q}`;
  const keyA = "keyAAAAAAAAAAAAAAAAAA";
  const keyB = "keyBBBBBBBBBBBBBBBBBB";
  assert.equal((await POST(new Request(url(""), { method: "POST", body: "{}" }))).status, 401);
  assert.equal((await POST(new Request(url("?key=short"), { method: "POST", body: "{}" }))).status, 401);

  const ok = await POST(new Request(url(""), { method: "POST", body: JSON.stringify({ key: keyA, setup: "sr-break", side: "long" }) }));
  assert.equal(ok.status, 200);
  await POST(new Request(url(`?key=${keyB}`), { method: "POST", body: "plain text alert" }));

  const a = await (await GET(new Request(url(`?key=${keyA}`)))).json();
  assert.equal(a.signals.length, 1);
  assert.equal(a.signals[0].payload.setup, "sr-break");
  assert.equal(a.signals[0].payload.key, undefined);
  const b = await (await GET(new Request(url(`?key=${keyB}&since=0`)))).json();
  assert.deepEqual(b.signals.map((s) => s.payload), ["plain text alert"]);
  const later = await (await GET(new Request(url(`?key=${keyA}&since=${a.signals[0].receivedAt}`)))).json();
  assert.equal(later.signals.length, 0);
  assert.equal((await GET(new Request(url("")))).status, 401);
});
