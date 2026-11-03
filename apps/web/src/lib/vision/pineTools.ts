// ─── Pine tools ────────────────────────────────────────────────────────────────
// TradingView runs Pine, this app can't, so nothing here pretends to. It reads a
// script well enough to say what it is and what it can alert on, flags common
// traps, and adds alert code. The result still has to compile in TradingView.
// ───────────────────────────────────────────────────────────────────────────────

export interface PineInput {
  name: string;
  type: string;
  label: string;
}

export interface PineCondition {
  name: string;
  /** Pine expression. */
  expr: string;
  side: "long" | "short" | "";
  /** Where it was found. */
  from: "alertcondition" | "variable";
  title: string;
}

export interface PineCheck {
  tone: "good" | "warn" | "bad";
  text: string;
}

export interface PineInfo {
  version: number | null;
  kind: "indicator" | "strategy" | "library" | "unknown";
  title: string;
  lines: number;
  inputs: PineInput[];
  conditions: PineCondition[];
  alertCalls: number;
  plots: number;
  usesSecurity: boolean;
  hasOurAlerts: boolean;
  checks: PineCheck[];
}

const MARK_START = "// ── TradePilot alerts ──";
const MARK_END = "// ── end TradePilot alerts ──";

const sideOf = (s: string): PineCondition["side"] => (/long|buy|bull|\bup\b|above/i.test(s) ? "long" : /short|sell|bear|\bdown\b|below/i.test(s) ? "short" : "");

/** The arguments of a call starting at `open`, split on top-level commas. */
function args(code: string, open: number) {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  let quote = "";
  for (let i = open; i < code.length; i++) {
    const c = code[i];
    if (quote) {
      cur += c;
      if (c === quote && code[i - 1] !== "\\") quote = "";
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      cur += c;
      continue;
    }
    if (c === "(" || c === "[") {
      if (depth++ > 0) cur += c;
      continue;
    }
    if (c === ")" || c === "]") {
      if (--depth === 0) {
        out.push(cur.trim());
        return out;
      }
      cur += c;
      continue;
    }
    if (c === "," && depth === 1) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    if (depth > 0) cur += c;
  }
  return out;
}

const stripComments = (code: string) => code.split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
const unquote = (s: string) => s.replace(/^["']|["']$/g, "");
const named = (list: string[], name: string) => list.find((a) => new RegExp(`^${name}\\s*=`).test(a))?.replace(new RegExp(`^${name}\\s*=\\s*`), "");

export function analyzePine(code: string): PineInfo {
  const clean = stripComments(code);
  const v = code.match(/\/\/\s*@version\s*=\s*(\d+)/);
  const version = v ? Number(v[1]) : null;
  const decl = clean.match(/\b(indicator|strategy|library|study)\s*\(/);
  const kind: PineInfo["kind"] = !decl ? "unknown" : decl[1] === "study" ? "indicator" : (decl[1] as PineInfo["kind"]);
  const title = decl ? unquote(named(args(clean, clean.indexOf("(", decl.index!)), "title") ?? args(clean, clean.indexOf("(", decl.index!))[0] ?? "") : "";

  const inputs: PineInput[] = [];
  for (const m of clean.matchAll(/^\s*(?:\w+\s+)?(\w+)\s*=\s*input(?:\.(\w+))?\s*\(/gm)) {
    const a = args(clean, clean.indexOf("(", m.index! + m[0].length - 1));
    inputs.push({ name: m[1], type: m[2] ?? "value", label: unquote(named(a, "title") ?? (a[1] && /^["']/.test(a[1]) ? a[1] : m[1])) });
  }

  const conditions: PineCondition[] = [];
  for (const m of clean.matchAll(/\balertcondition\s*\(/g)) {
    const a = args(clean, m.index! + m[0].length - 1);
    const expr = named(a, "condition") ?? a[0];
    if (!expr) continue;
    const t = unquote(named(a, "title") ?? a[1] ?? expr);
    conditions.push({ name: t.replace(/\W+/g, "_").toLowerCase(), expr, side: sideOf(`${t} ${expr}`), from: "alertcondition", title: t });
  }
  const seen = new Set(conditions.map((c) => c.expr));
  for (const m of clean.matchAll(/^(?:bool\s+)?([A-Za-z_]\w*)\s*:?=\s*(.+)$/gm)) {
    const [, name, expr] = m;
    if (seen.has(name) || /^input/.test(expr)) continue;
    const boolish = /\bta\.(crossover|crossunder|cross|rising|falling)\s*\(|\b(and|or|not)\b|[<>]=?|==|!=/.test(expr) && !/[?]/.test(expr) && !/=>/.test(expr);
    if (!boolish) continue;
    seen.add(name);
    conditions.push({ name, expr: name, side: sideOf(name), from: "variable", title: name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ") });
  }

  const alertCalls = (clean.match(/\balert\s*\(/g) ?? []).length;
  const plots = (clean.match(/\bplot(shape|char|arrow|candle|bar)?\s*\(/g) ?? []).length;
  const usesSecurity = /request\.security\s*\(|\bsecurity\s*\(/.test(clean);
  const hasOurAlerts = code.includes(MARK_START);

  const checks: PineCheck[] = [];
  if (!version) checks.push({ tone: "bad", text: "No //@version line. TradingView will treat it as very old Pine." });
  else if (version < 5) checks.push({ tone: "warn", text: `Written in Pine v${version}. TradingView has a Convert command in the editor if something fails.` });
  else checks.push({ tone: "good", text: `Pine v${version}.` });
  if (kind === "library") checks.push({ tone: "warn", text: "This is a library, so it can't be added to a chart or send alerts by itself." });
  if (kind === "strategy") checks.push({ tone: "good", text: "A strategy: TradingView can alert on each order fill. Use the Order fills message on the Alerts tab." });
  if (/lookahead\s*=\s*barmerge\.lookahead_on/.test(clean) && !/\[\s*1\s*\]\s*,\s*lookahead/.test(clean)) checks.push({ tone: "bad", text: "lookahead_on without [1]: this can read the future in history, so backtests look better than live trading." });
  else if (usesSecurity) checks.push({ tone: "warn", text: "Pulls another timeframe. Values can change until that bar closes, so alerts may differ from history." });
  if (/\bbarstate\.isrealtime\b|\bcalc_on_every_tick\s*=\s*true/.test(clean)) checks.push({ tone: "warn", text: "Acts on unfinished bars: an alert can fire and the signal can then vanish." });
  if (/timenow|\brandom\s*\(/.test(clean)) checks.push({ tone: "warn", text: "Uses the clock or random numbers, so history and live results will differ." });
  if (!conditions.length && !alertCalls && kind !== "strategy" && kind !== "library") checks.push({ tone: "warn", text: "No conditions found to alert on. Add a true/false variable like longSignal = ta.crossover(a, b)." });
  if (alertCalls || conditions.some((c) => c.from === "alertcondition")) checks.push({ tone: "good", text: `Has alerts already: ${alertCalls} alert() call${alertCalls === 1 ? "" : "s"}, ${conditions.filter((c) => c.from === "alertcondition").length} alertcondition.` });
  return { version, kind, title, lines: code.split("\n").length, inputs, conditions, alertCalls, plots, usesSecurity, hasOurAlerts, checks };
}

const jsonPart = (s: string) => s.replace(/[^A-Za-z0-9 _.&/+-]/g, "").slice(0, 60);

/**
 * Adds alert() calls for the chosen conditions, or replaces ones added before.
 * The webhook key isn't written into the script: it stays in the alert's address.
 */
export function addAlerts(code: string, picks: { expr: string; title: string; side: PineCondition["side"] }[], o: { freq?: "bar_close" | "all" } = {}) {
  const freq = o.freq === "all" ? "alert.freq_once_per_bar" : "alert.freq_once_per_bar_close";
  const body = picks
    .map((p) => {
      const title = jsonPart(p.title);
      const msg = `'{"name":"${title}","side":"${p.side}","symbol":"' + syminfo.ticker + '","price":' + str.tostring(close) + ',"tf":"' + timeframe.period + '"}'`;
      return `if ${p.expr}\n    alert(${msg}, ${freq})`;
    })
    .join("\n");
  const block = `${MARK_START}\n${body}\n${MARK_END}`;
  const start = code.indexOf(MARK_START);
  if (start >= 0) {
    const end = code.indexOf(MARK_END);
    if (end > start) return `${code.slice(0, start)}${block}${code.slice(end + MARK_END.length)}`;
  }
  return `${code.replace(/\s+$/, "")}\n\n${block}\n`;
}

/** The message to paste into TradingView's alert box for a script with no alert() of its own. */
export const alertMessage = (name: string, side = "") => JSON.stringify({ name: jsonPart(name) || "My alert", side, symbol: "{{ticker}}", price: "{{close}}", tf: "{{interval}}" });
export const orderFillMessage = (name: string) => JSON.stringify({ name: jsonPart(name) || "Strategy", side: "{{strategy.order.action}}", symbol: "{{ticker}}", price: "{{strategy.order.price}}", message: "{{strategy.order.comment}}" });

// ── Ready to use ───────────────────────────────────────────────────────────────

export interface PineStarter {
  id: string;
  name: string;
  blurb: string;
  /** Rules to test the same idea in Strategy test, when the app can run it. */
  rules?: string;
  code: string;
}

const head = (title: string, short: string) => `//@version=6\nindicator("${title}", shorttitle = "${short}", overlay = true)\n`;
const msg = (name: string, side: string) => `'{"name":"${name}","side":"${side}","symbol":"' + syminfo.ticker + '","price":' + str.tostring(close) + ',"tf":"' + timeframe.period + '"}'`;

export const PINE_STARTERS: PineStarter[] = [
  {
    id: "vwap-touch",
    name: "VWAP touch",
    blurb: "Alerts the first bar that touches session VWAP after being away from it.",
    code: `${head("TradePilot VWAP Touch", "TP VWAP")}
v = ta.vwap(hlc3)
plot(v, "VWAP", color.orange, 2)

touching = low <= v and high >= v
touched = touching and not touching[1]
plotshape(touched, "Touch", shape.circle, location.abovebar, color.orange, size = size.tiny)

if touched
    alert(${msg("VWAP touched", "")}, alert.freq_once_per_bar_close)
`,
  },
  {
    id: "double-break",
    name: "Double-break VWAP",
    blurb: "Close through VWAP, pushed back, close through again. Calls your phone if your rule says so.",
    rules: "Use my double-break VWAP strategy on NQ in the New York session with its own stop and target.",
    code: `${head("TradePilot Double-Break VWAP", "TP DBV")}
maxGap = input.int(12, "Second break within N bars", minval = 2)
v = ta.vwap(hlc3)
plot(v, "VWAP", color.orange, 2)

// State: which way the first break went, and when.
var int firstDir = 0
var int firstBar = na
var bool pushedBack = false

upBreak = ta.crossover(close, v)
downBreak = ta.crossunder(close, v)

longSignal = false
shortSignal = false

if firstDir != 0 and bar_index - firstBar > maxGap
    firstDir := 0
    pushedBack := false
if firstDir == 1 and close < v
    pushedBack := true
if firstDir == -1 and close > v
    pushedBack := true

if upBreak
    if firstDir == 1 and pushedBack
        longSignal := true
        firstDir := 0
        pushedBack := false
    else
        firstDir := 1
        firstBar := bar_index
        pushedBack := false
if downBreak
    if firstDir == -1 and pushedBack
        shortSignal := true
        firstDir := 0
        pushedBack := false
    else
        firstDir := -1
        firstBar := bar_index
        pushedBack := false

plotshape(longSignal, "Long", shape.triangleup, location.belowbar, color.lime, size = size.small)
plotshape(shortSignal, "Short", shape.triangledown, location.abovebar, color.red, size = size.small)

if longSignal
    alert(${msg("Double-break VWAP", "long")}, alert.freq_once_per_bar_close)
if shortSignal
    alert(${msg("Double-break VWAP", "short")}, alert.freq_once_per_bar_close)
`,
  },
  {
    id: "orb",
    name: "Opening range break",
    blurb: "First close beyond the first 15 minutes of New York.",
    rules: "Opening range breakout on the first 15 minutes of New York. Long on the first close above the range, short below it. Stop at the signal candle. Take profit 2R. One trade per day.",
    code: `${head("TradePilot Opening Range Break", "TP ORB")}
rangeTime = input.session("0930-0945", "Opening range, New York")
tradeTime = input.session("0945-1600", "Watch until, New York")

inRange = not na(time(timeframe.period, rangeTime, "America/New_York"))
inTrade = not na(time(timeframe.period, tradeTime, "America/New_York"))

var float hi = na
var float lo = na
var bool doneLong = false
var bool doneShort = false

if inRange and not inRange[1]
    hi := high
    lo := low
    doneLong := false
    doneShort := false
else if inRange
    hi := math.max(hi, high)
    lo := math.min(lo, low)

plot(inTrade ? hi : na, "Range high", color.aqua, style = plot.style_linebr)
plot(inTrade ? lo : na, "Range low", color.aqua, style = plot.style_linebr)

breakUp = inTrade and not doneLong and close > hi
breakDown = inTrade and not doneShort and close < lo

if breakUp
    doneLong := true
    alert(${msg("Opening range break", "long")}, alert.freq_once_per_bar_close)
if breakDown
    doneShort := true
    alert(${msg("Opening range break", "short")}, alert.freq_once_per_bar_close)
`,
  },
  {
    id: "prior-day",
    name: "Prior day high and low",
    blurb: "Alerts when price trades through yesterday's high or low.",
    rules: "Trade the break and retest of the previous day's high and low. Go long when price breaks above the prior high, pulls back to retest it, and prints a bullish candle. Mirror for shorts. Stop: 1.5x ATR(14). Take profit: 2:1.",
    code: `${head("TradePilot Prior Day Levels", "TP PDHL")}
pdh = request.security(syminfo.tickerid, "D", high[1], lookahead = barmerge.lookahead_on)
pdl = request.security(syminfo.tickerid, "D", low[1], lookahead = barmerge.lookahead_on)
plot(pdh, "Prior high", color.teal, style = plot.style_linebr)
plot(pdl, "Prior low", color.maroon, style = plot.style_linebr)

breakHigh = ta.crossover(close, pdh)
breakLow = ta.crossunder(close, pdl)

if breakHigh
    alert(${msg("Prior day high broken", "long")}, alert.freq_once_per_bar_close)
if breakLow
    alert(${msg("Prior day low broken", "short")}, alert.freq_once_per_bar_close)
`,
  },
  {
    id: "ema-cross",
    name: "EMA cross",
    blurb: "Two EMAs you choose cross.",
    rules: "Long when the 9 EMA crosses above the 21 EMA, short when it crosses below. Stop 20 points. Take profit 40 points. New York session only.",
    code: `${head("TradePilot EMA Cross", "TP EMA")}
fastLen = input.int(9, "Fast", minval = 1)
slowLen = input.int(21, "Slow", minval = 2)
fast = ta.ema(close, fastLen)
slow = ta.ema(close, slowLen)
plot(fast, "Fast", color.aqua)
plot(slow, "Slow", color.orange)

crossUp = ta.crossover(fast, slow)
crossDown = ta.crossunder(fast, slow)

if crossUp
    alert(${msg("EMA cross up", "long")}, alert.freq_once_per_bar_close)
if crossDown
    alert(${msg("EMA cross down", "short")}, alert.freq_once_per_bar_close)
`,
  },
  {
    id: "price-level",
    name: "My price levels",
    blurb: "Type up to three prices each morning. It alerts when price reaches one.",
    code: `${head("TradePilot Price Levels", "TP Levels")}
a = input.price(0.0, "Level 1")
b = input.price(0.0, "Level 2")
c = input.price(0.0, "Level 3")
plot(a > 0 ? a : na, "Level 1", color.yellow, style = plot.style_linebr)
plot(b > 0 ? b : na, "Level 2", color.yellow, style = plot.style_linebr)
plot(c > 0 ? c : na, "Level 3", color.yellow, style = plot.style_linebr)

hit(level) =>
    level > 0 and low <= level and high >= level and not (low[1] <= level and high[1] >= level)

if hit(a) or hit(b) or hit(c)
    alert(${msg("Price level reached", "")}, alert.freq_once_per_bar_close)
`,
  },
];
