// The TradingView side of In-flight monitoring. One indicator watches the
// trader's two setups and calls alert() with a JSON payload the webhook
// understands — including the last N closes and VWAP values, so Pilot can draw
// the moment the signal fired without a screenshot.

export interface PineOptions {
  key: string;
  levels?: { label: string; price: number }[];
  waitMinutes?: number;
}

const safe = (s: string) => s.replace(/[^A-Za-z0-9 _/-]/g, "").slice(0, 12) || "L";

export function pineScript({ key, levels = [], waitMinutes = 15 }: PineOptions): string {
  const own = levels.slice(0, 3);
  const lv = (i: number) => own[i] ? String(own[i].price) : "0.0";
  const ln = (i: number) => (own[i] ? safe(own[i].label) : `Level ${i + 1}`);
  return `//@version=6
// TradePilot · Pilot Signals — generated for your account. Keep the key private.
indicator("TradePilot Pilot Signals", shorttitle = "Pilot Signals", overlay = true, max_labels_count = 200)

string KEY = "${key}"

// ─── Setups ───────────────────────────────────────────────
grpS      = "Setups"
useDbv    = input.bool(true, "Double-break VWAP", group = grpS)
useBreak  = input.bool(true, "S/R break (close through a level)", group = grpS)
useRetest = input.bool(true, "S/R retest & hold", group = grpS)

grpV      = "Double-break VWAP"
anchorRth = input.bool(true, "Anchor VWAP at 09:30 ET (off = session VWAP)", group = grpV)
window    = input.int(20, "Second break within N bars of the first", minval = 2, group = grpV)
bufTicks  = input.int(2, "Close must clear the line by N ticks", minval = 0, group = grpV)

grpL        = "Levels"
usePrior    = input.bool(true, "Prior-day RTH high / low", group = grpL)
useOn       = input.bool(true, "Overnight high / low", group = grpL)
lvl1        = input.float(${lv(0)}, "${ln(0)} (0 = off)", group = grpL)
lvl2        = input.float(${lv(1)}, "${ln(1)} (0 = off)", group = grpL)
lvl3        = input.float(${lv(2)}, "${ln(2)} (0 = off)", group = grpL)
retestBars  = input.int(12, "Retest within N bars of the break", minval = 2, group = grpL)
retestTicks = input.int(4, "Retest tolerance (ticks)", minval = 0, group = grpL)

grpT      = "Timing"
rthOnly   = input.bool(true, "Only fire 09:30–16:00 ET", group = grpT)
skipFirst = input.int(${waitMinutes}, "Skip the first N minutes after the open", minval = 0, group = grpT)
nBars     = input.int(40, "Bars sent with each alert (for the snapshot)", minval = 10, maxval = 80, group = grpT)

tick = syminfo.mintick
buf  = bufTicks * tick
tol  = retestTicks * tick

// ─── Session ──────────────────────────────────────────────
inRth   = not na(time(timeframe.period, "0930-1600", "America/New_York"))
rthOpen = inRth and not inRth[1]

var int openTime = na
if rthOpen
    openTime := time
minsIn = na(openTime) ? 0.0 : (time_close - openTime) / 60000.0
armed  = rthOnly ? (inRth and minsIn >= skipFirst) : (not inRth or minsIn >= skipFirst)

// ─── VWAP ─────────────────────────────────────────────────
vwRth  = ta.vwap(hlc3, rthOpen)
vwSess = ta.vwap(hlc3)
vw     = anchorRth ? vwRth : vwSess

// ─── Levels: prior-day RTH and overnight ─────────────────
var float rthHi = na
var float rthLo = na
var float pdh   = na
var float pdl   = na
var float onHi  = na
var float onLo  = na
var float onh   = na
var float onl   = na
if rthOpen
    pdh   := rthHi
    pdl   := rthLo
    onh   := onHi
    onl   := onLo
    rthHi := high
    rthLo := low
    onHi  := na
    onLo  := na
else if inRth
    rthHi := math.max(nz(rthHi, high), high)
    rthLo := math.min(nz(rthLo, low), low)
else
    onHi := na(onHi) ? high : math.max(onHi, high)
    onLo := na(onLo) ? low : math.min(onLo, low)

// ─── Double-break VWAP ───────────────────────────────────
// First close through VWAP arms the side. Back through the other way, then
// through again within the window: the second break fires.
var int vSide  = 0
var int lastUp = -1
var int lastDn = -1
bool dbLong  = false
bool dbShort = false
if rthOpen and anchorRth
    vSide  := 0
    lastUp := -1
    lastDn := -1
if close > vw + buf and vSide != 1
    if lastUp >= 0 and bar_index - lastUp <= window
        dbLong := true
        lastUp := -1
    else
        lastUp := bar_index
    vSide := 1
else if close < vw - buf and vSide != -1
    if lastDn >= 0 and bar_index - lastDn <= window
        dbShort := true
        lastDn := -1
    else
        lastDn := bar_index
    vSide := -1

// ─── S/R break and retest ────────────────────────────────
var array<string> names    = array.from("PDH", "PDL", "ONH", "ONL", "${ln(0)}", "${ln(1)}", "${ln(2)}")
var array<int>    brokeDir = array.new_int(7, 0)
var array<int>    brokeBar = array.new_int(7, -1)
if rthOpen
    for i = 0 to 6
        array.set(brokeDir, i, 0)
levels = array.from(usePrior ? pdh : na, usePrior ? pdl : na, useOn ? onh : na, useOn ? onl : na, lvl1 > 0 ? lvl1 : na, lvl2 > 0 ? lvl2 : na, lvl3 > 0 ? lvl3 : na)

string srSetup = ""
string srSide  = ""
string srName  = ""
float  srLevel = na
for i = 0 to 6
    lv = array.get(levels, i)
    if na(lv)
        continue
    if close > lv + buf and close[1] <= lv + buf
        array.set(brokeDir, i, 1)
        array.set(brokeBar, i, bar_index)
        if useBreak and srSetup == ""
            srSetup := "sr-break"
            srSide  := "long"
            srName  := array.get(names, i)
            srLevel := lv
    else if close < lv - buf and close[1] >= lv - buf
        array.set(brokeDir, i, -1)
        array.set(brokeBar, i, bar_index)
        if useBreak and srSetup == ""
            srSetup := "sr-break"
            srSide  := "short"
            srName  := array.get(names, i)
            srLevel := lv
    else
        d = array.get(brokeDir, i)
        b = array.get(brokeBar, i)
        fresh = d != 0 and b >= 0 and bar_index > b and bar_index - b <= retestBars
        if fresh and d == 1 and low <= lv + tol and close > lv + buf
            array.set(brokeDir, i, 0)
            if useRetest and srSetup == ""
                srSetup := "sr-retest"
                srSide  := "long"
                srName  := array.get(names, i)
                srLevel := lv
        else if fresh and d == -1 and high >= lv - tol and close < lv - buf
            array.set(brokeDir, i, 0)
            if useRetest and srSetup == ""
                srSetup := "sr-retest"
                srSide  := "short"
                srName  := array.get(names, i)
                srLevel := lv

// ─── Payload ─────────────────────────────────────────────
f_num(float x) =>
    na(x) ? "null" : str.tostring(math.round_to_mintick(x))

f_series(float src, int n) =>
    string s = ""
    for i = n - 1 to 0
        s := s + f_num(src[i]) + (i > 0 ? "," : "")
    s

f_payload(string setup, string side, float lvl, string lvlName) =>
    '{"key":"' + KEY + '","setup":"' + setup + '","side":"' + side + '","symbol":"' + syminfo.ticker + '","tf":"' + timeframe.period + '","price":' + f_num(close) + ',"vwap":' + f_num(vw) + ',"level":' + f_num(lvl) + ',"levelName":"' + lvlName + '","barTime":' + str.tostring(time) + ',"closes":[' + f_series(close, nBars) + '],"vwaps":[' + f_series(vw, nBars) + ']}'

fireDbL = armed and useDbv and dbLong
fireDbS = armed and useDbv and dbShort
fireSr  = armed and srSetup != ""

if fireDbL
    alert(f_payload("double-break-vwap", "long", float(na), ""), alert.freq_once_per_bar_close)
if fireDbS
    alert(f_payload("double-break-vwap", "short", float(na), ""), alert.freq_once_per_bar_close)
if fireSr
    alert(f_payload(srSetup, srSide, srLevel, srName), alert.freq_once_per_bar_close)

// ─── Drawing ─────────────────────────────────────────────
plot(vw, "VWAP", color = color.new(#4F9CF9, 0), linewidth = 2)
plot(usePrior ? pdh : na, "PDH", color = color.new(#FF4868, 30), style = plot.style_linebr)
plot(usePrior ? pdl : na, "PDL", color = color.new(#00D68F, 30), style = plot.style_linebr)
plot(useOn ? onh : na, "ONH", color = color.new(#FFB800, 40), style = plot.style_linebr)
plot(useOn ? onl : na, "ONL", color = color.new(#FFB800, 40), style = plot.style_linebr)
plotshape(fireDbL, "DB-VWAP long", shape.triangleup, location.belowbar, color.new(#00D68F, 0), text = "DB", textcolor = color.new(#00D68F, 0), size = size.small)
plotshape(fireDbS, "DB-VWAP short", shape.triangledown, location.abovebar, color.new(#FF4868, 0), text = "DB", textcolor = color.new(#FF4868, 0), size = size.small)
plotshape(fireSr and srSide == "long", "S/R long", shape.circle, location.belowbar, color.new(#00D68F, 0), text = "SR", textcolor = color.new(#00D68F, 0), size = size.tiny)
plotshape(fireSr and srSide == "short", "S/R short", shape.circle, location.abovebar, color.new(#FF4868, 0), text = "SR", textcolor = color.new(#FF4868, 0), size = size.tiny)
`;
}

/** For traders who would rather keep their own alerts: a message body for any TradingView alert. */
export function alertTemplate(key: string, setup = "double-break-vwap", side = "long") {
  return `{"key":"${key}","setup":"${setup}","side":"${side}","symbol":"{{ticker}}","price":{{close}},"tf":"{{interval}}"}`;
}
