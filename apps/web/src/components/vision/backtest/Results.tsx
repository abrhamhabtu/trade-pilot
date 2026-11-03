"use client";

import { useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { ChevronDown, Download, FolderDown, ShieldAlert, Sparkles, Trophy } from "lucide-react";
import type { Bar } from "@/lib/pilot/market";
import { READERS, type ReaderId } from "@/lib/vision/analyze";
import { tradesCsv, type BacktestResult, type BacktestTrade, type Group } from "@/lib/vision/backtest";
import type { FirmProgram } from "@/lib/proving/firms";
import { toDays, type PropReport } from "@/lib/vision/prop";
import type { Verdict } from "@/lib/vision/verdict";
import type { Timeframe, VisionSymbol } from "@/lib/vision/markets";
import { useVisionStore } from "@/store/visionStore";
import { dateOf, download, money, type Loaded } from "./data";
import type { BacktestSettings } from "@/store/visionStore";
import type { CoinFlipReport, DoctorReport } from "@/lib/vision/doctor";
import { DoctorCard } from "./DoctorCard";
import { DayLedger } from "./prop/DayLedger";
import { PropCard } from "./PropCard";
import { TradeReview } from "./TradeReview";
import { CY, Card, NEG, Seg } from "./ui";

export type LeagueRow = { reader: ReaderId; stats: BacktestResult["stats"] };

export const strategyOf = (k: ReaderId | "custom") => (k === "custom" ? "Your rules" : READERS[k].label);
const pf = (n: number) => (n === Infinity ? "∞" : n.toFixed(2));
const pct = (n: number, dp = 0) => `${(n * 100).toFixed(dp)}%`;
const r2 = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}R`;
export const dur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${Math.round(m % 60)}m` : `${Math.round(m)}m`);
const slotName = (k: string) => `${k} ET`;

export function Results({
  result,
  loaded,
  sym,
  tf,
  anchor,
  title,
  label,
  onSave,
  saved,
  onUse,
  league,
  verdict,
  prop,
  coin,
  doctor,
  onApply,
  onReplayTrade,
  onProgram,
  onSize,
}: {
  result: BacktestResult;
  loaded: Loaded;
  sym: VisionSymbol | null;
  tf: Timeframe;
  anchor: "rth" | "utc";
  title: string;
  label: string;
  onSave: () => void;
  saved: "idle" | "saving" | "saved" | "error";
  onUse: (r: ReaderId) => void;
  league: LeagueRow[] | null;
  verdict: Verdict | null;
  prop: PropReport | null | undefined;
  coin: CoinFlipReport | null;
  doctor: DoctorReport | null;
  onApply: (patch: Partial<BacktestSettings>) => void;
  onReplayTrade: (t: BacktestTrade) => void;
  onProgram: (key: string) => void;
  onSize: (contracts: number) => void;
}) {
  const s = result.stats;
  const bars: Bar[] = loaded.bars;
  const [pick, setPick] = useState<number>(0);
  const review = useRef<HTMLDivElement>(null);
  // Point value and bar length as the run itself priced them, recovered from a trade.
  const ledgerDays = useMemo(() => {
    const t = result.trades[0];
    if (!t || bars.length < 2) return [];
    const risk = Math.abs(t.entry - t.stop) * t.units;
    return toDays(result.trades, bars, risk ? t.riskUsd / risk : 1, bars[1].t - bars[0].t);
  }, [result, bars]);
  // Without a firm, one that can't be hit: the ledger is then just the days and their numbers.
  const ledgerProgram = useMemo(() => prop?.program ?? ({ size: result.balance, target: 0, drawdown: 1e12, ddType: "static", lock: null, dll: null, consistencyPct: 100, consistencyBasis: "totalProfit", minDays: 0, maxMinis: 1e6, maxMicros: 1e6 } as unknown as FirmProgram), [prop, result.balance]);
  const open = (k: number) => {
    setPick(k);
    requestAnimationFrame(() => review.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  if (!s.trades)
    return (
      <Card>
        <p className="text-[17px] font-semibold text-white">No trades in this period</p>
        <p className="mt-1 text-[14px] text-white/55">
          Nothing fired{Object.values(result.skipped).some(Boolean) ? ", or your filters and session skipped every signal" : ""}. Try another strategy, session, a longer period or a different timeframe.
        </p>
      </Card>
    );

  const years = `${new Date(result.from * 1000).getUTCFullYear()}–${new Date(result.to * 1000).getUTCFullYear()}`;
  return (
    <div className="space-y-5">
      {/* ── The headline card ── */}
      <section className="overflow-hidden rounded-[28px] border border-[#5AC8FA]/20 bg-[radial-gradient(120%_140%_at_0%_0%,rgba(90,200,250,0.13),rgba(18,18,20,0.88)_55%)] backdrop-blur-2xl">
        <header className="flex flex-wrap items-center gap-3 px-6 pt-5">
          <span className="grid h-11 w-11 place-items-center rounded-[13px] text-[13px] font-black text-white" style={{ background: sym ? `linear-gradient(135deg, ${sym.color}, #1c1c20)` : "#333" }}>
            {sym?.id ?? "—"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[18px] font-bold tracking-tight text-white">{title}</p>
            <p className="truncate font-mono text-[11.5px] text-white/45">
              {years} · {tf} · {s.trades} trades · {label}
            </p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-[#30D158]/12 px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wider text-[#7CE59A]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#30D158]" /> COMPLETE · {s.trades} TRADES
          </span>
        </header>
        <div className="mt-4 grid grid-cols-2 border-y border-white/[0.06] md:grid-cols-4">
          <Big label="Net P&L" value={money(s.pnl)} tone={s.pnl >= 0 ? "pos" : "neg"} sub={`${s.returnPct >= 0 ? "+" : ""}${pct(s.returnPct, 1)} on $${result.balance.toLocaleString("en-US")}`} />
          <Big label="Profit factor" value={pf(s.profitFactor)} sub={s.profitFactor >= 1 ? "Gross profit ÷ gross loss" : "Losses outweigh gains"} />
          <Big label="Win rate" value={pct(s.winRate, 1)} sub={`${s.wins}W · ${s.losses}L`} />
          <Big label="Max drawdown" value={`-${pct(s.maxDrawdownPct, 1)}`} tone="neg" sub={`${money(-s.maxDrawdown)} from peak`} />
        </div>
        <div className="flex flex-wrap items-center gap-4 px-6 py-4">
          {verdict ? <Grade v={verdict} /> : <span className="h-[72px]" />}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#9BE1FF]">
              <Sparkles className="h-3 w-3" /> Vision · edge verdict
            </p>
            <p className="mt-0.5 text-[15px] font-semibold text-white">{verdict ? verdict.title : "Reading the run…"}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => download(`backtest-${sym?.id ?? "data"}-${new Date().toISOString().slice(0, 10)}.csv`, tradesCsv(result))} className="flex h-10 items-center gap-2 rounded-full bg-white/[0.08] px-4 text-[13.5px] font-semibold text-white ring-1 ring-white/[0.08] hover:bg-white/[0.12]">
              <Download className="h-4 w-4" /> CSV
            </button>
            <button onClick={onSave} disabled={saved === "saving" || saved === "saved"} className="flex h-10 items-center gap-2 rounded-full bg-[#5AC8FA] px-4 text-[13.5px] font-bold text-black hover:brightness-105 disabled:opacity-70">
              <FolderDown className="h-4 w-4" /> {saved === "saved" ? "Saved as a session" : saved === "saving" ? "Saving…" : saved === "error" ? "Retry save" : "Save as a session"}
            </button>
          </div>
        </div>
      </section>

      {verdict && <VerdictCard v={verdict} />}

      {prop && <PropCard report={prop} onProgram={onProgram} onSize={onSize} />}

      <DoctorCard coin={coin} doctor={doctor} onApply={onApply} />

      <Report result={result} verdict={verdict} />

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <EquityCard result={result} />
        <MonthlyCard months={result.by.month} />
      </div>

      {league && <League rows={league} onUse={onUse} />}

      <Breakdowns by={result.by} />

      <DayLedger days={ledgerDays} program={ledgerProgram} firm={!!prop} name={`backtest-${sym?.id ?? "data"}`} />

      {/* ── Every trade the engine took, on the chart ── */}
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <TradeLog trades={result.trades} balance={result.balance} symbol={sym?.id ?? ""} active={pick} onPick={open} csv={() => download(`backtest-${sym?.id ?? "data"}.csv`, tradesCsv(result))} />
        <div ref={review} className="2xl:sticky 2xl:top-4 2xl:self-start">
          {sym && result.trades[pick] && (
            <TradeReview
              key={pick}
              bars={bars}
              loaded={loaded}
              trade={result.trades[pick]}
              sym={sym}
              tf={tf}
              anchor={anchor}
              onPrev={pick > 0 ? () => setPick(pick - 1) : undefined}
              onNext={pick < result.trades.length - 1 ? () => setPick(pick + 1) : undefined}
              onReplay={() => onReplayTrade(result.trades[pick])}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Big({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "pos" | "neg" }) {
  return (
    <div className="border-white/[0.06] px-6 py-4 [&:not(:last-child)]:border-r">
      <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/45">{label}</p>
      <p className={clsx("mt-1 text-[30px] font-bold leading-none tracking-[-0.03em] tabular-nums", tone === "pos" ? "text-[#9BE1FF]" : tone === "neg" ? "text-[#FFA3AB]" : "text-white")}>{value}</p>
      <p className="mt-1.5 truncate text-[11.5px] text-white/40">{sub}</p>
    </div>
  );
}

function Grade({ v }: { v: Verdict }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-3 rounded-[18px] bg-black/25 py-2 pl-2 pr-4 ring-1 ring-white/[0.06]">
      <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden>
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={v.score >= 60 ? CY : v.score >= 40 ? "#FFD60A" : NEG} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(v.score / 100) * c} ${c}`} transform="rotate(-90 28 28)" />
        <text x="28" y="33" textAnchor="middle" fill="#fff" fontSize="15" fontWeight="700">
          {v.grade}
        </text>
      </svg>
      <div>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">Edge score</p>
        <p className="text-[15px] font-bold tabular-nums text-white">{v.grade === "—" ? "Not rated" : `${v.score} / 100`}</p>
      </div>
    </div>
  );
}

function VerdictCard({ v }: { v: Verdict }) {
  const rb = v.robust;
  return (
    <section className="grid gap-5 rounded-[26px] border border-white/[0.07] bg-[linear-gradient(135deg,rgba(90,200,250,0.07),rgba(191,90,242,0.05)_60%,rgba(18,18,20,0.85))] p-5 backdrop-blur-2xl lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div>
        <p className="flex items-center gap-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/50">
          <span className="grid h-6 w-6 place-items-center rounded-[8px] bg-gradient-to-br from-[#5AC8FA] to-[#BF5AF2] text-white">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          Edge verdict
        </p>
        <h3 className="mt-3 text-[20px] font-bold tracking-tight text-white">{v.title}</h3>
        <p className="mt-2 text-[14px] leading-relaxed text-white/65">{v.body}</p>
        {v.fixes.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-[12px] font-semibold text-white/50">Before you size up</p>
            <ul className="space-y-1.5">
              {v.fixes.map((f) => (
                <li key={f} className="flex gap-2 text-[13px] leading-snug text-white/75">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FFD60A]" /> {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {v.grade !== "—" && (
        <div className="grid grid-cols-2 content-start gap-2">
          <Mini k="Luck test" v={`${rb.tStat.toFixed(1)}σ`} d={rb.tStat >= 2 ? "Unlikely to be chance" : rb.tStat >= 1 ? "Could be chance" : "Indistinguishable from chance"} good={rb.tStat >= 2} />
          <Mini k="First / second half" v={`${rb.firstHalfR >= 0 ? "+" : ""}${rb.firstHalfR.toFixed(2)} / ${rb.secondHalfR >= 0 ? "+" : ""}${rb.secondHalfR.toFixed(2)}R`} d="Expectancy per trade" good={rb.firstHalfR > 0 && rb.secondHalfR > 0} />
          <Mini k="Green months" v={`${rb.greenMonths} / ${rb.months}`} d={rb.carry > 0 ? `Best two carried ${Math.round(rb.carry * 100)}%` : "Monthly P&L"} good={rb.months > 0 && rb.greenMonths / rb.months >= 0.55} />
          <Mini k="Drawdown to expect" v={money(-rb.dd95)} d="95th percentile, 600 resamples" />
          <Mini k="Range of outcomes" v={`${money(rb.p5)} → ${money(rb.p95)}`} d="5th to 95th percentile" />
          <Mini k="Chance of a loss" v={pct(rb.pLoss)} d="Same trades, resampled" good={rb.pLoss < 0.1} />
        </div>
      )}
    </section>
  );
}

function Mini({ k, v, d, good }: { k: string; v: string; d: string; good?: boolean }) {
  return (
    <div className="rounded-[16px] bg-black/25 px-3 py-2.5 ring-1 ring-inset ring-white/[0.05]">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-white/45">
        {good != null && <span className={clsx("h-1.5 w-1.5 rounded-full", good ? "bg-[#30D158]" : "bg-[#FFD60A]")} />}
        {k}
      </p>
      <p className="mt-0.5 truncate text-[14px] font-bold tabular-nums text-white" title={v}>{v}</p>
      <p className="truncate text-[11px] text-white/38">{d}</p>
    </div>
  );
}

// ── Every number you need to judge an edge ──

function Report({ result, verdict }: { result: BacktestResult; verdict: Verdict | null }) {
  const s = result.stats;
  const [all, setAll] = useState(false);
  const long = result.by.side.find((g) => g.key === "Long");
  const short = result.by.side.find((g) => g.key === "Short");
  const slots = result.by.slot.filter((g) => g.n >= 3);
  const bestSlot = slots.length ? slots.reduce((a, b) => (b.pnl > a.pnl ? b : a)) : null;
  const rows: [string, string, string][] = [
    ["Win rate", pct(s.winRate, 1), "How often trades closed in profit"],
    ["Profit factor", pf(s.profitFactor), "Gross profit ÷ gross loss"],
    ["Net P&L", money(s.pnl, 2), "Total result after commission and slippage"],
    ["Return", `${s.returnPct >= 0 ? "+" : ""}${pct(s.returnPct, 1)}`, `On a $${result.balance.toLocaleString("en-US")} start`],
    ["Expectancy", `${money(s.expectancyUsd, 2)} · ${r2(s.expectancyR)}`, "Average result per trade"],
    ["Average win / loss", `${money(s.avgWin)} / ${money(s.avgLoss)}`, `Payoff ${s.payoff === Infinity ? "∞" : s.payoff.toFixed(2)}×`],
    ["Max drawdown", `${money(-s.maxDrawdown)} · -${pct(s.maxDrawdownPct, 1)}`, `Largest dip from an equity peak · ${s.maxDrawdownR.toFixed(1)}R`],
    ["Sharpe", s.sharpe.toFixed(2), "Daily returns, annualised, no risk-free rate"],
    ["Sortino", s.sortino.toFixed(2), "Like Sharpe, counting only downside days"],
    ["Calmar", s.calmar.toFixed(2), "Annual return ÷ max drawdown"],
    ["Streaks", `${s.longestWinning}W · ${s.longestLosing}L`, "Longest run of wins and of losses"],
    ["Trading days", `${s.days} · ${s.days ? pct(s.greenDays / s.days) : "—"} green`, `Best day ${money(s.bestDay)} · worst ${money(s.worstDay)}`],
    ["Average duration", dur(s.avgMinutes), `${s.avgHold.toFixed(0)} bars`],
    ["Heat and run-up", `${s.avgMae.toFixed(2)}R / +${s.avgMfe.toFixed(2)}R`, "Average worst and best open P&L per trade (MAE / MFE)"],
    ["Best and worst trade", `${money(s.best)} / ${money(s.worst)}`, "Single-trade extremes"],
    ...(verdict && verdict.grade !== "—" ? ([["Expectancy t-stat", verdict.robust.tStat.toFixed(2), "Standard errors from zero; 2+ is hard to get by luck"]] as [string, string, string][]) : []),
  ];
  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="grid grid-cols-2 content-start gap-3">
        <Tile k="Sharpe" v={s.sharpe.toFixed(2)} tone={s.sharpe >= 1 ? "pos" : s.sharpe < 0 ? "neg" : undefined} />
        <Tile k="Max drawdown" v={`$${Math.round(s.maxDrawdown).toLocaleString("en-US")}`} sub={`-${pct(s.maxDrawdownPct, 1)} of balance`} tone="neg" />
        <Tile k="Calmar" v={s.calmar.toFixed(2)} />
        <Tile k="Sortino" v={s.sortino.toFixed(2)} />
        <SideTile label="Long trades" g={long} dot="bg-[#5AC8FA]" />
        <SideTile label="Short trades" g={short} dot="bg-[#FF7A85]" />
        <Tile k="Best trade time" v={bestSlot ? slotName(bestSlot.key) : "—"} sub={bestSlot ? `${money(bestSlot.pnl)} over ${bestSlot.n} trades` : undefined} />
        <Tile k="Avg duration" v={dur(s.avgMinutes)} sub={`Expectancy ${money(s.expectancyUsd)} a trade`} />
      </div>
      <div className="overflow-hidden rounded-[22px] border border-white/[0.07] bg-[#121214]/80">
        <div className="flex justify-between bg-white/[0.03] px-4 py-2.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/40">
          <span>Metric</span>
          <span>Value</span>
        </div>
        {(all ? rows : rows.slice(0, 7)).map(([k, v, d]) => (
          <div key={k} className="flex items-start justify-between gap-3 border-t border-white/[0.05] px-4 py-2.5">
            <div className="min-w-0">
              <p className="text-[13.5px] font-medium text-white">{k}</p>
              <p className="text-[11.5px] text-white/40">{d}</p>
            </div>
            <p className="shrink-0 font-mono text-[13px] tabular-nums text-white/90">{v}</p>
          </div>
        ))}
        <button onClick={() => setAll(!all)} className="flex w-full items-center justify-center gap-1 border-t border-white/[0.05] py-2.5 text-[12.5px] font-semibold text-[#9BE1FF] hover:bg-white/[0.03]">
          {all ? "Fewer metrics" : `All ${rows.length} metrics`} <ChevronDown className={clsx("h-3.5 w-3.5 transition", all && "rotate-180")} />
        </button>
      </div>
    </section>
  );
}

function Tile({ k, v, sub, tone }: { k: string; v: string; sub?: string; tone?: "pos" | "neg" }) {
  return (
    <div className="rounded-[20px] border border-white/[0.07] bg-[#121214]/80 px-4 py-3.5">
      <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/40">{k}</p>
      <p className={clsx("mt-1 text-[24px] font-bold tabular-nums tracking-tight", tone === "pos" ? "text-[#9BE1FF]" : tone === "neg" ? "text-[#FFA3AB]" : "text-white")}>{v}</p>
      {sub && <p className="text-[11.5px] text-white/40">{sub}</p>}
    </div>
  );
}

function SideTile({ label, g, dot }: { label: string; g?: Group; dot: string }) {
  return (
    <div className="rounded-[20px] border border-white/[0.07] bg-[#121214]/80 px-4 py-3.5">
      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-white">
        <span className={clsx("h-2 w-2 rounded-full", dot)} /> {label}
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <div>
          <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-white/40">Count</p>
          <p className="text-[18px] font-bold tabular-nums text-white">{g?.n ?? 0}</p>
        </div>
        <div>
          <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-white/40">Win</p>
          <p className="text-[18px] font-bold tabular-nums text-white">{g?.n ? pct(g.wins / g.n, 1) : "—"}</p>
        </div>
        <div>
          <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-white/40">P&amp;L</p>
          <p className={clsx("truncate text-[18px] font-bold tabular-nums", (g?.pnl ?? 0) >= 0 ? "text-[#9BE1FF]" : "text-[#FFA3AB]")}>{g ? money(g.pnl) : "—"}</p>
        </div>
      </div>
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
  const DH = 64;
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
    <Card title="Equity curve" aside={<Seg size="sm" value={unit} onChange={setUnit} options={[{ v: "usd" as const, l: "$" }, { v: "r" as const, l: "R" }]} />}>
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
          <div className={clsx("pointer-events-none absolute top-1 z-10 w-[210px] rounded-2xl bg-[#1C1C1F]/95 px-3 py-2 text-[12px] ring-1 ring-white/10 backdrop-blur", x(h) / W > 0.6 ? "-translate-x-[calc(100%+12px)]" : "translate-x-3")} style={{ left: `${(x(h) / W) * 100}%` }}>
            <p className="font-semibold text-white">{fmt(vals[h])}</p>
            <p className="text-white/55">{tr ? `Trade ${tr.n} · ${dateOf(tr.exitT)} · ${r2(tr.r)}` : "Start"}</p>
          </div>
        )}
        <span className="pointer-events-none absolute right-0 top-0 text-[11px] tabular-nums text-white/40">{fmt(hi)}</span>
        <span className="pointer-events-none absolute bottom-0 right-0 text-[11px] tabular-nums text-white/40">{fmt(lo)}</span>
      </div>
      <p className="mb-1 mt-3 text-[11.5px] font-semibold text-white/45">Drawdown from peak · deepest {fmt(ddMin)}</p>
      <svg viewBox={`0 0 ${W} ${DH}`} preserveAspectRatio="none" className="h-[64px] w-full">
        <path d={ddPath} fill={NEG} fillOpacity="0.22" stroke={NEG} strokeOpacity="0.7" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        {h != null && <line x1={x(h)} x2={x(h)} y1="0" y2={DH} stroke="rgba(255,255,255,0.3)" vectorEffect="non-scaling-stroke" />}
      </svg>
    </Card>
  );
}

// ── Monthly (or yearly) P&L ──

function MonthlyCard({ months }: { months: Group[] }) {
  const [unit, setUnit] = useState<"m" | "y">(months.length > 30 ? "y" : "m");
  const [hover, setHover] = useState<number | null>(null);
  const rows = useMemo(() => {
    if (unit === "m") return months.map((g) => ({ ...g, label: new Date(`${g.key}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }), full: new Date(`${g.key}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) }));
    const m = new Map<string, Group>();
    for (const g of months) {
      const y = g.key.slice(0, 4);
      const x = m.get(y) ?? { key: y, n: 0, wins: 0, netR: 0, pnl: 0 };
      x.n += g.n;
      x.wins += g.wins;
      x.netR += g.netR;
      x.pnl += g.pnl;
      m.set(y, x);
    }
    return [...m.values()].map((g) => ({ ...g, label: `'${g.key.slice(2)}`, full: g.key }));
  }, [months, unit]);
  const max = Math.max(1, ...rows.map((g) => Math.abs(g.pnl)));
  const green = rows.filter((g) => g.pnl > 0).length;
  const bw = 100 / Math.max(rows.length, 1);
  const hv = hover != null ? rows[hover] : null;
  return (
    <Card title={unit === "m" ? "Monthly P&L" : "Yearly P&L"} aside={<Seg size="sm" value={unit} onChange={setUnit} options={[{ v: "m" as const, l: "Month" }, { v: "y" as const, l: "Year" }]} />}>
      <p className="-mt-1 mb-2 truncate text-[12px] text-white/45">
        {green} of {rows.length} {unit === "m" ? "months" : "years"} green
        {hv && (
          <span className="ml-2 text-white/80">
            · {hv.full}: <span className="font-semibold">{money(hv.pnl)}</span> · {hv.n} trades
          </span>
        )}
      </p>
      <div className="relative h-[230px]" onPointerLeave={() => setHover(null)}>
        <span className="absolute inset-x-0 top-1/2 h-px bg-white/15" />
        {rows.map((g, i) => {
          const h = (Math.abs(g.pnl) / max) * 46;
          return (
            <button key={g.key} onPointerEnter={() => setHover(i)} onFocus={() => setHover(i)} aria-label={`${g.full} ${money(g.pnl)}`} className="absolute inset-y-0" style={{ left: `${i * bw}%`, width: `${bw}%` }}>
              <span className="absolute left-1/2 w-[70%] max-w-[22px] -translate-x-1/2 rounded-[4px] transition-opacity" style={{ height: `${Math.max(0.8, h)}%`, top: g.pnl >= 0 ? `${50 - h}%` : "50%", background: g.pnl >= 0 ? CY : NEG, opacity: hover == null || hover === i ? 0.9 : 0.4 }} />
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex text-[10px] text-white/35">
        {rows.map((g, i) => (
          <span key={g.key} className="text-center" style={{ width: `${bw}%` }}>
            {rows.length <= 18 || i % Math.ceil(rows.length / 12) === 0 ? g.label : ""}
          </span>
        ))}
      </div>
    </Card>
  );
}

// ── Each strategy on its own ──

function League({ rows, onUse }: { rows: LeagueRow[]; onUse: (r: ReaderId) => void }) {
  const ranked = [...rows].sort((a, b) => b.stats.pnl - a.stats.pnl);
  return (
    <Card title={<span className="flex items-center gap-1.5"><Trophy className="h-3.5 w-3.5" /> Your Vision strategies, each on its own</span>}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-[13px] tabular-nums">
          <thead>
            <tr className="text-left text-[11.5px] text-white/45">
              {["Strategy", "Trades", "Win", "PF", "Exp.", "Sharpe", "Net", ""].map((h, i) => (
                <th key={i} className={clsx("pb-2 font-semibold", i > 0 && "text-right")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ranked.map((r, k) => (
              <tr key={r.reader} className="border-t border-white/[0.05]">
                <td className="py-2.5 font-semibold text-white">
                  {k === 0 && r.stats.pnl > 0 && <span className="mr-1.5 text-[#9BE1FF]">★</span>}
                  {READERS[r.reader].label}
                </td>
                <td className="py-2.5 text-right text-white/70">{r.stats.trades}</td>
                <td className="py-2.5 text-right text-white/70">{r.stats.trades ? pct(r.stats.winRate) : "—"}</td>
                <td className="py-2.5 text-right text-white/70">{r.stats.trades ? pf(r.stats.profitFactor) : "—"}</td>
                <td className="py-2.5 text-right text-white/70">{r.stats.trades ? r2(r.stats.expectancyR) : "—"}</td>
                <td className="py-2.5 text-right text-white/70">{r.stats.trades ? r.stats.sharpe.toFixed(2) : "—"}</td>
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
  { v: "slot" as const, l: "Time (30m)" },
  { v: "hour" as const, l: "Hour" },
  { v: "weekday" as const, l: "Weekday" },
  { v: "month" as const, l: "Month" },
  { v: "reader" as const, l: "Strategy" },
  { v: "side" as const, l: "Side" },
  { v: "outcome" as const, l: "Exit" },
  { v: "vix" as const, l: "VIX" },
  { v: "fomc" as const, l: "FOMC" },
];
const OUTCOME: Record<string, string> = { target: "Target", stop: "Stop", breakeven: "Break-even", time: "Time exit" };

function Breakdowns({ by }: { by: BacktestResult["by"] }) {
  const [dim, setDim] = useState<(typeof DIMENSIONS)[number]["v"]>("slot");
  const [metric, setMetric] = useState<"pnl" | "r">("pnl");
  const rows: Group[] = by[dim];
  const v = (g: Group) => (metric === "pnl" ? g.pnl : g.netR);
  const max = Math.max(1e-9, ...rows.map((g) => Math.abs(v(g))));
  const name = (k: string) =>
    dim === "reader" ? strategyOf(k as ReaderId | "custom") : dim === "hour" ? `${k}:00 ET` : dim === "slot" ? slotName(k) : dim === "outcome" ? OUTCOME[k] ?? k : dim === "month" ? new Date(`${k}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }) : k;
  const best = rows.length > 1 ? rows.reduce((a, b) => (v(b) > v(a) ? b : a)) : null;
  const worst = rows.length > 1 ? rows.reduce((a, b) => (v(b) < v(a) ? b : a)) : null;
  return (
    <Card title="Where the edge is" aside={<Seg size="sm" value={metric} onChange={setMetric} options={[{ v: "pnl" as const, l: "$" }, { v: "r" as const, l: "R" }]} />}>
      <div className="-mx-1 mb-3 flex gap-1 overflow-x-auto px-1 pb-1">
        {DIMENSIONS.map((d) => (
          <button key={d.v} onClick={() => setDim(d.v)} className={clsx("whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-semibold", dim === d.v ? "bg-white/[0.14] text-white" : "text-white/50 hover:bg-white/[0.05] hover:text-white/80")}>
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
            <div key={g.key} className="grid grid-cols-[104px_1fr_116px] items-center gap-2 rounded-lg px-1 py-1 hover:bg-white/[0.03]" title={`${name(g.key)}: ${g.n} trades, ${pct(g.wins / g.n)} win, ${money(g.pnl)}, ${r2(g.netR)}`}>
              <span className="truncate text-[12.5px] text-white/70">{name(g.key)}</span>
              <span className="relative h-[14px]">
                <span className="absolute inset-y-0 left-1/2 w-px bg-white/15" />
                <span className="absolute inset-y-[1px] rounded-[4px]" style={{ left: val >= 0 ? "50%" : `${50 - w}%`, width: `${Math.max(0.6, w)}%`, background: val >= 0 ? CY : NEG, opacity: 0.85 }} />
              </span>
              <span className="text-right text-[12px] tabular-nums text-white/60">
                <span className="font-semibold text-white/85">{metric === "pnl" ? money(val) : r2(val)}</span> · {g.n} · {pct(g.wins / g.n)}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── The trade log ──

function TradeLog({ trades, balance, symbol, active, onPick, csv }: { trades: BacktestTrade[]; balance: number; symbol: string; active: number; onPick: (k: number) => void; csv: () => void }) {
  const journal = useVisionStore((s) => s.journal);
  const [filter, setFilter] = useState<"all" | "win" | "loss" | "tagged">("all");
  const [shown, setShown] = useState(150);
  const running = useMemo(() => {
    let b = balance;
    return trades.map((t) => (b += t.pnl));
  }, [trades, balance]);
  const list = trades.map((t, k) => ({ t, k })).filter(({ t }) => filter === "all" || (filter === "win" ? t.r > 0 : filter === "loss" ? t.r <= 0 : !!journal[`${symbol}:${t.entryT}`]));
  return (
    <section className="overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#121214]/80 backdrop-blur-2xl">
      <header className="flex flex-wrap items-center gap-2 px-5 pt-4">
        <h3 className="text-[16px] font-bold text-white">Trade log</h3>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-white/40">Tap a row to plot it</span>
        <button onClick={csv} className="ml-auto rounded-full bg-white/[0.07] px-3 py-1 text-[12px] font-semibold text-white/75 ring-1 ring-white/[0.08] hover:bg-white/[0.12]">
          Export CSV
        </button>
      </header>
      <div className="px-5 py-3">
        <Seg size="sm" value={filter} onChange={setFilter} options={[{ v: "all" as const, l: `All ${trades.length}` }, { v: "win" as const, l: "Winners" }, { v: "loss" as const, l: "Losers" }, { v: "tagged" as const, l: "Journaled" }]} />
      </div>
      <div className="grid grid-cols-[44px_34px_54px_1fr_86px_96px] gap-2 bg-white/[0.03] px-5 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
        <span>#</span>
        <span />
        <span>Side</span>
        <span>Date</span>
        <span className="text-right">P&amp;L</span>
        <span className="text-right">Balance</span>
      </div>
      <div className="max-h-[620px] overflow-y-auto">
        {list.slice(0, shown).map(({ t, k }) => {
          const j = journal[`${symbol}:${t.entryT}`];
          return (
            <button key={t.n} onClick={() => onPick(k)} className={clsx("grid w-full grid-cols-[44px_34px_54px_1fr_86px_96px] items-center gap-2 border-t border-white/[0.04] px-5 py-2 text-left text-[12.5px] tabular-nums transition", active === k ? "bg-[#5AC8FA]/10" : "hover:bg-white/[0.035]")}>
              <span className="text-white/35">#{t.n}</span>
              <span className={clsx("grid h-5 w-6 place-items-center rounded-md text-[10px] font-bold", t.r > 0 ? "bg-[#5AC8FA]/18 text-[#9BE1FF]" : t.outcome === "breakeven" ? "bg-white/[0.08] text-white/60" : "bg-[#FF7A85]/16 text-[#FFA3AB]")}>{t.r > 0 ? "W" : t.outcome === "breakeven" ? "BE" : "L"}</span>
              <span className={clsx("font-semibold", t.side === "long" ? "text-[#9BE1FF]" : "text-[#FFA3AB]")}>{t.side === "long" ? "Long" : "Short"}</span>
              <span className="flex min-w-0 items-center gap-1.5 truncate text-white/70">
                {new Date(t.entryT * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit", timeZone: "America/New_York" })}
                {j && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#BF5AF2]" title={j.tags.join(", ") || "Note"} />}
              </span>
              <span className={clsx("text-right font-semibold", t.pnl >= 0 ? "text-[#9BE1FF]" : "text-[#FFA3AB]")}>{money(t.pnl)}</span>
              <span className="text-right text-white/60">${Math.round(running[k]).toLocaleString("en-US")}</span>
            </button>
          );
        })}
        {list.length > shown && (
          <button onClick={() => setShown(shown + 300)} className="w-full border-t border-white/[0.04] py-2.5 text-[12.5px] font-semibold text-white/60 hover:bg-white/[0.04]">
            Show more ({list.length - shown} left)
          </button>
        )}
        {!list.length && <p className="py-8 text-center text-[12.5px] text-white/40">Nothing here yet.</p>}
      </div>
    </section>
  );
}
