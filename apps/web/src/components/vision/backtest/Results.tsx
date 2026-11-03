"use client";

import { useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Download, FolderDown, Trophy } from "lucide-react";
import type { Bar } from "@/lib/pilot/market";
import { READERS, analyze, type ReaderId } from "@/lib/vision/analyze";
import { tradesCsv, type BacktestResult, type BacktestTrade, type Group } from "@/lib/vision/backtest";
import { formatPrice, type VisionSymbol } from "@/lib/vision/markets";
import type { VisionTrade } from "@/store/visionStore";
import { VisionChart } from "../VisionChart";
import { dateOf, download, money, timeOf } from "./data";
import { CY, CY_SOFT, Card, NEG, Pill, Seg } from "./ui";

export type LeagueRow = { reader: ReaderId; stats: BacktestResult["stats"] };

const pf = (n: number) => (n === Infinity ? "∞" : n.toFixed(2));
const pct = (n: number) => `${Math.round(n * 100)}%`;
const r2 = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}R`;

export function Results({
  result,
  bars,
  sym,
  anchor,
  label,
  onSave,
  saved,
  onUse,
  league,
}: {
  result: BacktestResult;
  bars: Bar[];
  sym: VisionSymbol | null;
  anchor: "rth" | "utc";
  label: string;
  onSave: () => void;
  saved: "idle" | "saving" | "saved" | "error";
  onUse: (r: ReaderId) => void;
  league: LeagueRow[] | null;
}) {
  const s = result.stats;
  const [pick, setPick] = useState<number | null>(null);
  const viewer = useRef<HTMLDivElement>(null);
  const open = (k: number) => {
    setPick(k);
    requestAnimationFrame(() => viewer.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  if (!s.trades)
    return (
      <Card>
        <p className="text-[17px] font-semibold text-white">No trades in this period</p>
        <p className="mt-1 text-[14px] text-white/55">
          None of the setups fired{result.skipped.fomc + result.skipped.early + result.skipped.vix + result.skipped.side + result.skipped.hours ? ", or your filters skipped them all" : ""}. Try another strategy, a longer period or a different timeframe.
        </p>
      </Card>
    );

  return (
    <div className="space-y-5">
      {/* Headline */}
      <section className="rounded-[28px] border border-[#5AC8FA]/20 bg-[radial-gradient(120%_140%_at_0%_0%,rgba(90,200,250,0.14),rgba(18,18,20,0.85)_55%)] p-6 backdrop-blur-2xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-white/50">Net P&amp;L after costs</p>
            <p
              className={clsx(
                "mt-1 bg-clip-text text-[58px] font-bold leading-none tracking-[-0.045em] tabular-nums text-transparent",
                s.pnl >= 0 ? "bg-gradient-to-b from-[#D4F3FF] to-[#5AC8FA]" : "bg-gradient-to-b from-white to-white/55",
              )}
            >
              {money(s.pnl, 2)}
            </p>
            <p className="mt-2 text-[13.5px] text-white/55">
              {s.trades} trades · {dateOf(result.from)} – {dateOf(result.to)} · {result.bars.toLocaleString()} bars · {label}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => download(`backtest-${sym?.id ?? "data"}-${new Date().toISOString().slice(0, 10)}.csv`, tradesCsv(result))}
              className="flex h-10 items-center gap-2 rounded-full bg-white/[0.08] px-4 text-[13.5px] font-semibold text-white ring-1 ring-white/[0.08] hover:bg-white/[0.12]"
            >
              <Download className="h-4 w-4" /> CSV
            </button>
            <button onClick={onSave} disabled={saved === "saving" || saved === "saved"} className="flex h-10 items-center gap-2 rounded-full bg-[#5AC8FA] px-4 text-[13.5px] font-bold text-black hover:brightness-105 disabled:opacity-70">
              <FolderDown className="h-4 w-4" /> {saved === "saved" ? "Saved to Library" : saved === "saving" ? "Saving…" : saved === "error" ? "Retry save" : "Save to Library"}
            </button>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
          <Kpi label="Win rate" value={pct(s.winRate)} sub={`${s.wins}W · ${s.losses}L`} />
          <Kpi label="Profit factor" value={pf(s.profitFactor)} sub={s.profitFactor >= 1 ? "Gains cover losses" : "Losses bigger"} />
          <Kpi label="Expectancy" value={r2(s.expectancyR)} sub="per trade" />
          <Kpi label="Net R" value={r2(s.netR)} sub={`avg win ${s.avgWinR.toFixed(2)}R · loss ${s.avgLossR.toFixed(2)}R`} />
          <Kpi label="Max drawdown" value={money(-s.maxDrawdown)} sub={`${s.maxDrawdownR.toFixed(1)}R · ${s.longestLosing} losses in a row`} />
          <Kpi label="Avg hold" value={`${s.avgHold.toFixed(0)} bars`} sub={`best ${money(s.best)} · worst ${money(s.worst)}`} />
        </div>
        {(result.skipped.fomc || result.skipped.early || result.skipped.vix) > 0 && (
          <p className="mt-3 flex flex-wrap gap-1.5 text-[12px]">
            {result.skipped.fomc > 0 && <Pill>{result.skipped.fomc} skipped on FOMC days</Pill>}
            {result.skipped.early > 0 && <Pill>{result.skipped.early} skipped on early closes</Pill>}
            {result.skipped.vix > 0 && <Pill>{result.skipped.vix} outside your VIX band</Pill>}
          </p>
        )}
      </section>

      <EquityCard result={result} />

      {league && <League rows={league} onUse={onUse} />}

      <Breakdowns by={result.by} />

      {pick != null && result.trades[pick] && sym && (
        <div ref={viewer}>
          <TradeView
            key={pick}
            bars={bars}
            trade={result.trades[pick]}
            sym={sym}
            anchor={anchor}
            onPrev={pick > 0 ? () => setPick(pick - 1) : undefined}
            onNext={pick < result.trades.length - 1 ? () => setPick(pick + 1) : undefined}
            onClose={() => setPick(null)}
          />
        </div>
      )}

      <TradesTable trades={result.trades} sym={sym} active={pick} onPick={open} />
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-[18px] bg-white/[0.05] px-3.5 py-3 ring-1 ring-inset ring-white/[0.06]">
      <p className="text-[11.5px] font-semibold text-white/50">{label}</p>
      <p className="mt-0.5 text-[22px] font-bold tabular-nums tracking-tight text-white">{value}</p>
      <p className="truncate text-[11.5px] text-white/40">{sub}</p>
    </div>
  );
}

// ── Equity and drawdown ──

function EquityCard({ result }: { result: BacktestResult }) {
  const [unit, setUnit] = useState<"usd" | "r">("usd");
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<SVGSVGElement>(null);
  const W = 1000;
  const H = 220;
  const DH = 70;
  const pts = useMemo(() => [{ t: result.from, pnl: 0, r: 0 }, ...result.equity], [result]);
  const val = (p: { pnl: number; r: number }) => (unit === "usd" ? p.pnl : p.r);
  const vals = pts.map(val);
  const lo = Math.min(0, ...vals);
  const hi = Math.max(0, ...vals);
  const x = (i: number) => (i / Math.max(1, pts.length - 1)) * W;
  const y = (v: number) => 12 + (1 - (v - lo) / (hi - lo || 1)) * (H - 24);
  const line = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  let peak = 0;
  const dd = vals.map((v) => {
    peak = Math.max(peak, v);
    return v - peak;
  });
  const ddMin = Math.min(-1e-9, ...dd);
  const dy = (v: number) => (v / ddMin) * (DH - 6);
  const ddPath = `M0,0 ${dd.map((v, i) => `L${x(i).toFixed(1)},${dy(v).toFixed(1)}`).join(" ")} L${W},0 Z`;
  const fmt = (v: number) => (unit === "usd" ? money(v) : r2(v));
  const h = hover != null ? Math.min(hover, pts.length - 1) : null;
  const tr = h ? result.trades[h - 1] : null;

  const onMove = (e: React.PointerEvent) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setHover(Math.round(((e.clientX - r.left) / r.width) * (pts.length - 1)));
  };

  return (
    <Card
      title="Equity curve"
      aside={
        <Seg
          size="sm"
          value={unit}
          onChange={setUnit}
          options={[
            { v: "usd" as const, l: "$" },
            { v: "r" as const, l: "R" },
          ]}
        />
      }
    >
      <div className="relative" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <svg ref={box} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[220px] w-full touch-none">
          <defs>
            <linearGradient id="bt-eq" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={CY} stopOpacity="0.28" />
              <stop offset="1" stopColor={CY} stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,0.14)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          <path d={`${line} L${W},${y(lo)} L0,${y(lo)} Z`} fill="url(#bt-eq)" />
          <path d={line} fill="none" stroke={CY} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {h != null && <line x1={x(h)} x2={x(h)} y1="0" y2={H} stroke="rgba(255,255,255,0.3)" vectorEffect="non-scaling-stroke" />}
        </svg>
        {h != null && <span className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#5AC8FA] ring-2 ring-[#121214]" style={{ left: `${(x(h) / W) * 100}%`, top: y(vals[h]) }} />}
        {h != null && (
          <div
            className={clsx("pointer-events-none absolute top-1 z-10 w-[210px] rounded-2xl bg-[#1C1C1F]/95 px-3 py-2 text-[12px] ring-1 ring-white/10 backdrop-blur", x(h) / W > 0.6 ? "-translate-x-[calc(100%+12px)]" : "translate-x-3")}
            style={{ left: `${(x(h) / W) * 100}%` }}
          >
            <p className="font-semibold text-white">{fmt(vals[h])}</p>
            {tr ? (
              <p className="text-white/55">
                Trade {tr.n} · {timeOf(tr.exitT)} · {tr.r >= 0 ? "+" : ""}
                {tr.r.toFixed(2)}R
              </p>
            ) : (
              <p className="text-white/55">Start</p>
            )}
          </div>
        )}
        <span className="pointer-events-none absolute right-0 top-0 text-[11px] tabular-nums text-white/40">{fmt(hi)}</span>
        <span className="pointer-events-none absolute bottom-0 right-0 text-[11px] tabular-nums text-white/40">{fmt(lo)}</span>
      </div>
      <p className="mb-1 mt-3 text-[11.5px] font-semibold text-white/45">Drawdown from peak · deepest {fmt(ddMin)}</p>
      <svg viewBox={`0 0 ${W} ${DH}`} preserveAspectRatio="none" className="h-[70px] w-full">
        <path d={ddPath} fill={NEG} fillOpacity="0.22" stroke={NEG} strokeOpacity="0.7" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        {h != null && <line x1={x(h)} x2={x(h)} y1="0" y2={DH} stroke="rgba(255,255,255,0.3)" vectorEffect="non-scaling-stroke" />}
      </svg>
    </Card>
  );
}

// ── Each strategy on its own ──

function League({ rows, onUse }: { rows: LeagueRow[]; onUse: (r: ReaderId) => void }) {
  const ranked = [...rows].sort((a, b) => b.stats.pnl - a.stats.pnl);
  return (
    <Card
      title={
        <span className="flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5" /> Your strategies, each on its own
        </span>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13px] tabular-nums">
          <thead>
            <tr className="text-left text-[11.5px] text-white/45">
              <th className="pb-2 font-semibold">Strategy</th>
              <th className="pb-2 text-right font-semibold">Trades</th>
              <th className="pb-2 text-right font-semibold">Win</th>
              <th className="pb-2 text-right font-semibold">PF</th>
              <th className="pb-2 text-right font-semibold">Exp.</th>
              <th className="pb-2 text-right font-semibold">Net</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {ranked.map((r, k) => (
              <tr key={r.reader} className="border-t border-white/[0.05]">
                <td className="py-2.5 font-semibold text-white">
                  {k === 0 && r.stats.netR > 0 && r.stats.pnl > 0 && <span className="mr-1.5 text-[#9BE1FF]">★</span>}
                  {READERS[r.reader].label}
                </td>
                <td className="py-2.5 text-right text-white/70">{r.stats.trades}</td>
                <td className="py-2.5 text-right text-white/70">{r.stats.trades ? pct(r.stats.winRate) : "—"}</td>
                <td className="py-2.5 text-right text-white/70">{r.stats.trades ? pf(r.stats.profitFactor) : "—"}</td>
                <td className="py-2.5 text-right text-white/70">{r.stats.trades ? r2(r.stats.expectancyR) : "—"}</td>
                <td className={clsx("py-2.5 text-right font-semibold", r.stats.pnl >= 0 ? "text-[#9BE1FF]" : "text-[#FFA3AB]")}>{r.stats.trades ? money(r.stats.pnl) : "—"}</td>
                <td className="py-2.5 pl-3 text-right">
                  <button onClick={() => onUse(r.reader)} className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[12px] font-semibold text-white/80 hover:bg-white/[0.12]">
                    Test this
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Where the edge is ──

const DIMENSIONS = [
  { v: "hour" as const, l: "Hour (NY)" },
  { v: "weekday" as const, l: "Weekday" },
  { v: "month" as const, l: "Month" },
  { v: "reader" as const, l: "Strategy" },
  { v: "side" as const, l: "Side" },
  { v: "vix" as const, l: "VIX" },
  { v: "fomc" as const, l: "FOMC" },
];

function Breakdowns({ by }: { by: BacktestResult["by"] }) {
  const [dim, setDim] = useState<(typeof DIMENSIONS)[number]["v"]>("hour");
  const [metric, setMetric] = useState<"pnl" | "r">("pnl");
  const rows: Group[] = by[dim];
  const v = (g: Group) => (metric === "pnl" ? g.pnl : g.netR);
  const max = Math.max(1e-9, ...rows.map((g) => Math.abs(v(g))));
  const name = (k: string) => (dim === "reader" ? (READERS[k as ReaderId]?.label ?? k) : dim === "hour" ? `${k}:00` : dim === "month" ? new Date(`${k}-15`).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : k);
  const best = rows.length > 1 ? rows.reduce((a, b) => (v(b) > v(a) ? b : a)) : null;
  const worst = rows.length > 1 ? rows.reduce((a, b) => (v(b) < v(a) ? b : a)) : null;
  return (
    <Card
      title="Where the edge is"
      aside={
        <Seg
          size="sm"
          value={metric}
          onChange={setMetric}
          options={[
            { v: "pnl" as const, l: "$" },
            { v: "r" as const, l: "R" },
          ]}
        />
      }
    >
      <div className="-mx-1 mb-3 flex gap-1 overflow-x-auto px-1 pb-1">
        {DIMENSIONS.map((d) => (
          <button
            key={d.v}
            onClick={() => setDim(d.v)}
            className={clsx("whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-semibold", dim === d.v ? "bg-white/[0.14] text-white" : "text-white/50 hover:bg-white/[0.05] hover:text-white/80")}
          >
            {d.l}
          </button>
        ))}
      </div>
      {best && worst && v(best) > 0 && (
        <p className="mb-3 text-[13px] text-white/60">
          Best: <span className="font-semibold text-white">{name(best.key)}</span> ({metric === "pnl" ? money(best.pnl) : r2(best.netR)}, {best.n} trades)
          {v(worst) < 0 && (
            <>
              {" "}
              · Worst: <span className="font-semibold text-white">{name(worst.key)}</span> ({metric === "pnl" ? money(worst.pnl) : r2(worst.netR)})
            </>
          )}
        </p>
      )}
      <div className={clsx("grid gap-x-6 gap-y-1", rows.length > 8 && "md:grid-cols-2")}>
        {rows.map((g) => {
          const val = v(g);
          const w = (Math.abs(val) / max) * 50;
          return (
            <div key={g.key} className="group grid grid-cols-[92px_1fr_92px] items-center gap-2 rounded-lg px-1 py-1 hover:bg-white/[0.03]" title={`${name(g.key)}: ${g.n} trades, ${pct(g.wins / g.n)} win, ${money(g.pnl)}, ${r2(g.netR)}`}>
              <span className="truncate text-[12.5px] text-white/70">{name(g.key)}</span>
              <span className="relative h-[14px]">
                <span className="absolute inset-y-0 left-1/2 w-px bg-white/15" />
                <span className="absolute inset-y-[1px] rounded-[4px]" style={{ left: val >= 0 ? "50%" : `${50 - w}%`, width: `${Math.max(0.6, w)}%`, background: val >= 0 ? CY : NEG, opacity: 0.85 }} />
              </span>
              <span className="text-right text-[12px] tabular-nums text-white/60">
                <span className="font-semibold text-white/85">{metric === "pnl" ? money(val) : r2(val)}</span> · {g.n}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Every trade ──

function TradesTable({ trades, sym, active, onPick }: { trades: BacktestTrade[]; sym: VisionSymbol | null; active: number | null; onPick: (k: number) => void }) {
  const [shown, setShown] = useState(60);
  const [filter, setFilter] = useState<"all" | "win" | "loss">("all");
  const fmt = (n: number) => (sym ? formatPrice(sym, n) : n.toFixed(2));
  const list = trades.map((t, k) => ({ t, k })).filter(({ t }) => filter === "all" || (filter === "win" ? t.r > 0 : t.r <= 0));
  return (
    <Card
      title={`Trades · ${list.length}`}
      aside={
        <Seg
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { v: "all" as const, l: "All" },
            { v: "win" as const, l: "Winners" },
            { v: "loss" as const, l: "Losers" },
          ]}
        />
      }
    >
      <p className="-mt-1 mb-2 text-[12px] text-white/40">Tap a trade to see it on the chart.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[13px] tabular-nums">
          <thead>
            <tr className="text-left text-[11.5px] text-white/45">
              {["#", "Entered (NY)", "Strategy", "Side", "Entry", "Exit", "Result", "R", "P&L", "Hold"].map((h, i) => (
                <th key={h} className={clsx("pb-2 font-semibold", i >= 7 && "text-right")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.slice(0, shown).map(({ t, k }) => (
              <tr key={t.n} onClick={() => onPick(k)} className={clsx("cursor-pointer border-t border-white/[0.05] transition", active === k ? "bg-[#5AC8FA]/10" : "hover:bg-white/[0.035]")}>
                <td className="py-2 text-white/40">{t.n}</td>
                <td className="py-2 text-white/80">{timeOf(t.entryT)}</td>
                <td className="py-2 text-white/70">{READERS[t.reader].short}</td>
                <td className={clsx("py-2 font-semibold", t.side === "long" ? "text-[#9BE1FF]" : "text-[#FFA3AB]")}>{t.side === "long" ? "Long" : "Short"}</td>
                <td className="py-2 text-white/70">{fmt(t.entry)}</td>
                <td className="py-2 text-white/70">{fmt(t.exit)}</td>
                <td className="py-2">
                  <Pill tone={t.outcome === "target" ? "cyan" : t.outcome === "stop" ? "neg" : "muted"}>{t.outcome === "target" ? "Target" : t.outcome === "stop" ? "Stop" : "Time"}</Pill>
                </td>
                <td className={clsx("py-2 text-right font-semibold", t.r >= 0 ? "text-[#9BE1FF]" : "text-[#FFA3AB]")}>{r2(t.r)}</td>
                <td className={clsx("py-2 text-right font-semibold", t.pnl >= 0 ? "text-white" : "text-white/60")}>{money(t.pnl, 2)}</td>
                <td className="py-2 text-right text-white/45">{t.hold}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length > shown && (
        <button onClick={() => setShown(shown + 120)} className="mt-3 w-full rounded-xl bg-white/[0.05] py-2 text-[13px] font-semibold text-white/70 hover:bg-white/[0.08]">
          Show more ({list.length - shown} left)
        </button>
      )}
    </Card>
  );
}

// ── One trade, drawn the way Vision saw it ──

const NO_SCAN = { scan: null, revealed: 99, projection: true, step: "done" as const };

function TradeView({ bars, trade, sym, anchor, onPrev, onNext, onClose }: { bars: Bar[]; trade: BacktestTrade; sym: VisionSymbol; anchor: "rth" | "utc"; onPrev?: () => void; onNext?: () => void; onClose: () => void }) {
  // Enough bars before the entry for the session VWAP and the averages to settle, and a little after the exit.
  const start = Math.max(0, trade.entryIndex - 400);
  const slice = useMemo(() => bars.slice(start, Math.min(bars.length, trade.exitIndex + 24)), [bars, start, trade.exitIndex]);
  const fmt = (n: number) => formatPrice(sym, n);
  const scan = useMemo(() => analyze(slice, { fmt, reader: trade.reader, anchor, atIndex: trade.entryIndex - start }), [slice, trade]); // eslint-disable-line react-hooks/exhaustive-deps
  const closed: VisionTrade = {
    id: `bt-${trade.n}`,
    symbol: sym.id,
    side: trade.side,
    qty: 1,
    entry: trade.entry,
    stop: trade.stop,
    target: trade.target,
    openedAt: trade.entryT * 1000,
    setupId: "",
    auto: true,
    venue: "paper",
    pointValue: 1,
    exit: trade.exit,
    closedAt: Date.now(),
    pnl: trade.pnl,
    reason: trade.outcome === "time" ? "manual" : trade.outcome,
  };
  return (
    <Card
      title={`Trade ${trade.n} · ${READERS[trade.reader].label}`}
      aside={
        <div className="flex items-center gap-1.5">
          <button aria-label="Previous trade" disabled={!onPrev} onClick={onPrev} className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.07] text-white/75 hover:bg-white/[0.12] disabled:opacity-30">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button aria-label="Next trade" disabled={!onNext} onClick={onNext} className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.07] text-white/75 hover:bg-white/[0.12] disabled:opacity-30">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button onClick={onClose} className="rounded-full bg-white/[0.07] px-3 py-1.5 text-[12.5px] font-semibold text-white/75 hover:bg-white/[0.12]">
            Close
          </button>
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap gap-1.5 text-[12px]">
        <Pill tone={trade.side === "long" ? "cyan" : "neg"}>{trade.side === "long" ? "Long" : "Short"}</Pill>
        <Pill>Entry {fmt(trade.entry)}</Pill>
        <Pill>Stop {fmt(trade.stop)}</Pill>
        <Pill>Target {fmt(trade.target)}</Pill>
        <Pill tone={trade.r >= 0 ? "cyan" : "neg"}>
          {trade.outcome === "target" ? "Target hit" : trade.outcome === "stop" ? "Stopped" : "Timed out"} · {r2(trade.r)} · {money(trade.pnl, 2)}
        </Pill>
        <Pill>{timeOf(trade.entryT)}</Pill>
        {trade.vix != null && <Pill>VIX {trade.vix.toFixed(1)}</Pill>}
        {trade.fomc && <Pill tone="warn">FOMC day</Pill>}
      </div>
      <div className="overflow-hidden rounded-[20px] bg-black/25 ring-1 ring-white/[0.05]">
        <VisionChart bars={slice} sym={sym} scan={scan.setup ? scan : null} phase={NO_SCAN} position={null} closed={closed} height={440} story label="BACKTEST" />
      </div>
      {!scan.setup && <p className="mt-2 text-[12px] text-white/40">The marks need the bars before this trade; showing price only.</p>}
      <p className="mt-2 text-[11.5px]" style={{ color: CY_SOFT }}>
        Fills: entry at the signal bar&apos;s close plus slippage; the stop wins a bar that touches both.
      </p>
    </Card>
  );
}
