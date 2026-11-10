"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { BookOpen, ChevronDown, Eye, FlaskConical, Images, Pin, PinOff, Settings2, Sparkles, Target, X } from "lucide-react";
import { isReader, type SetupSource } from "@/lib/vision/analyze";
import { DISCOVER_DEFAULTS, fitLine, isNew, sourceLine, type ChartRead, type Dials, type Ranked, type Scenario, type Verdict } from "@/lib/vision/discover";
import { BUCKET_LABEL, type Bucket } from "@/lib/vision/levels";
import type { Family } from "@/lib/vision/patterns";
import type { DiscoverData } from "@/lib/vision/useDiscover";

export const VERDICT: Record<Verdict, { label: string; cls: string }> = {
  proven: { label: "Proven", cls: "bg-[#FF8A3D] text-black" },
  promising: { label: "Promising", cls: "bg-[#FF8A3D]/15 text-[#FFB27D] ring-1 ring-inset ring-[#FF8A3D]/30" },
  unproven: { label: "Unproven", cls: "bg-white/[0.08] text-white/60" },
  losing: { label: "Losing", cls: "bg-[#FF5A4E]/15 text-[#FF8D85]" },
};

export function VerdictBadge({ v, title }: { v: Verdict; title?: string }) {
  return (
    <span title={title} className={clsx("rounded-full px-2 py-0.5 text-[10.5px] font-bold tracking-[0.03em]", VERDICT[v].cls)}>
      {VERDICT[v].label}
    </span>
  );
}

export const NewBadge = () => <span className="rounded-full bg-white px-1.5 py-0.5 text-[9.5px] font-black tracking-[0.08em] text-black">NEW</span>;

/** The fit chip: shown only when the scenario moves this idea by 0.05R or more. */
export function FitChip({ r }: { r: Ranked }) {
  if (!r.fit || !r.study || Math.abs(r.fit.fit) < 0.05) return null;
  const up = r.fit.fit > 0;
  return (
    <span title={fitLine(r.fit, r.study)} className={clsx("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", up ? "bg-[#FF8A3D]/12 text-[#FFB27D]" : "bg-white/[0.06] text-white/50")}>
      {up ? "fits now" : "against the grain"}
    </span>
  );
}

export const statLine = (r: Ranked) => {
  const st = r.study;
  if (!st) return "Not studied yet";
  if (!st.trades) return "No trades in the history";
  return `${st.newer.avgR >= 0 ? "+" : ""}${st.newer.avgR.toFixed(2)}R lately · ${Math.round(st.winRate * 100)}% won · t ${st.newer.t.toFixed(1)} · ${st.trades.toLocaleString("en-US")} trades`;
};

function Spark({ points }: { points: number[] }) {
  if (points.length < 2) return <span className="h-5 w-[72px]" />;
  const lo = Math.min(0, ...points);
  const hi = Math.max(0, ...points);
  const span = hi - lo || 1;
  const d = points.map((p, k) => `${k ? "L" : "M"}${((k / (points.length - 1)) * 72).toFixed(1)},${(20 - ((p - lo) / span) * 20).toFixed(1)}`).join(" ");
  const zero = 20 - ((0 - lo) / span) * 20;
  const up = points[points.length - 1] >= 0;
  return (
    <svg width="72" height="20" className="shrink-0" aria-hidden>
      <line x1="0" x2="72" y1={zero} y2={zero} stroke="rgba(255,255,255,0.12)" strokeDasharray="2 2" />
      <path d={d} fill="none" stroke={up ? "#FF8A3D" : "#FF5A4E"} strokeWidth="1.5" />
    </svg>
  );
}

const FAMILIES: (Family | "all")[] = ["all", "reversal", "breakout", "continuation", "mean-reversion"];
const BUCKETS: (Bucket | "all")[] = ["all", "asia", "london", "ny-open", "ny-mid", "ny-pm"];
const VERDICTS: (Verdict | "all")[] = ["all", "proven", "promising", "unproven", "losing"];

export function DiscoverPanel({
  onClose,
  title,
  scenario,
  ranked,
  data,
  pinned,
  onPin,
  current,
  onShow,
  live,
  firesHere,
  onBacktest,
  dials,
  onDials,
}: {
  onClose: () => void;
  title: string;
  scenario: Scenario | null;
  ranked: Ranked[];
  data: DiscoverData;
  pinned: SetupSource[];
  onPin: (id: SetupSource) => void;
  current: ChartRead;
  onShow: (id: ChartRead) => void;
  live: Set<string>;
  firesHere: Map<string, number> | null;
  onBacktest: (r: Ranked, show?: "gallery" | "drill") => void;
  dials: Dials;
  onDials: (d: Dials) => void;
}) {
  const [family, setFamily] = useState<Family | "all">("all");
  const [bucket, setBucket] = useState<Bucket | "all">("all");
  const [verdict, setVerdict] = useState<Verdict | "all">("all");
  const [onlyNew, setOnlyNew] = useState(false);
  const [settings, setSettings] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      ranked.filter((r) => {
        if (dials.hideLosing && r.judged?.verdict === "losing") return false;
        if (onlyNew && !isNew(r.idea.id, pinned)) return false;
        if (family !== "all" && r.idea.family !== family) return false;
        if (verdict !== "all" && r.judged?.verdict !== verdict) return false;
        if (bucket !== "all" && r.study && !((r.study.dims.bucket[bucket]?.[0] ?? 0) > 0)) return false;
        return true;
      }),
    [ranked, dials.hideLosing, onlyNew, pinned, family, verdict, bucket],
  );
  const facts = scenario
    ? [BUCKET_LABEL[scenario.bucket], scenario.dayType !== "none" && `${scenario.dayType} day`, `${scenario.vol} volatility`, scenario.gap !== "none" && (scenario.gap === "flat" ? "flat open" : `gap ${scenario.gap}`), scenario.side !== "none" && (scenario.side === "above-vwap" ? "above VWAP" : "below VWAP"), scenario.inPriorRange != null && (scenario.inPriorRange ? "inside yesterday" : "outside yesterday"), ...scenario.news.map((n) => (n === "cpi" ? "CPI" : n === "jobs" ? "Jobs report" : "FOMC"))].filter(Boolean)
    : [];
  const tested = data.m || ranked.filter((r) => r.study).length;
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  // A portal: the chart card's blur would otherwise trap a fixed drawer inside the card.
  return createPortal(
    <div className="fixed inset-0 z-[80] flex justify-end" role="dialog" aria-label="Discover">
      <button aria-label="Close Discover" className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="tp-card-in relative flex h-full w-full max-w-[480px] flex-col border-l border-white/[0.08] bg-[#141416]/[0.98] shadow-[0_0_80px_-10px_rgba(0,0,0,0.9)]">
        <header className="border-b border-white/[0.06] px-5 pb-4 pt-5">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#FFB27D] to-[#FF7A2D] text-black">
              <Sparkles className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#FFB27D]">Discover · {title}</p>
              <h2 className="mt-1 text-[16px] font-semibold leading-snug text-white">{scenario?.text || "Reading the chart…"}</h2>
            </div>
            <button aria-label="Discover settings" onClick={() => setSettings((x) => !x)} className={clsx("grid h-8 w-8 place-items-center rounded-full", settings ? "bg-white/15 text-white" : "text-white/50 hover:bg-white/[0.08] hover:text-white")}>
              <Settings2 className="h-4 w-4" />
            </button>
            <button aria-label="Close" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-white/50 hover:bg-white/[0.08] hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          {facts.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {facts.map((f) => (
                <span key={String(f)} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11.5px] capitalize text-white/70">
                  {f}
                </span>
              ))}
            </div>
          )}
          <SourceNote data={data} />
          {settings && <DialsEditor dials={dials} onDials={onDials} />}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Select value={family} options={FAMILIES} label={(v) => (v === "all" ? "Any kind" : v)} onChange={setFamily} />
            <Select value={bucket} options={BUCKETS} label={(v) => (v === "all" ? "Any session" : BUCKET_LABEL[v as Bucket])} onChange={setBucket} />
            <Select value={verdict} options={VERDICTS} label={(v) => (v === "all" ? "Any verdict" : VERDICT_LABEL[v as Verdict])} onChange={setVerdict} />
            <button onClick={() => setOnlyNew((x) => !x)} className={clsx("rounded-full px-2.5 py-1 text-[12px] font-semibold", onlyNew ? "bg-white text-black" : "bg-white/[0.06] text-white/70 hover:bg-white/[0.1]")}>
              New to me only
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          <p className="px-2 pb-1 pt-2 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-white/35">What fits now</p>
          {rows.length === 0 && <p className="px-2 py-6 text-[13px] text-white/45">{data.status === "loading" ? "Rating every idea…" : "Nothing matches these filters."}</p>}
          {rows.map((r) => {
            const v = r.judged?.verdict;
            const isOpen = openRow === r.idea.id;
            const fired = firesHere?.get(r.idea.id);
            const pinnedNow = pinned.includes(r.idea.id);
            return (
              <div key={r.idea.id} className={clsx("rounded-2xl px-2 py-2.5 transition", isOpen ? "bg-white/[0.05]" : "hover:bg-white/[0.03]", v === "losing" && "opacity-55")}>
                <button className="flex w-full items-start gap-3 text-left" onClick={() => setOpenRow(isOpen ? null : r.idea.id)}>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {live.has(r.idea.id) && <span title="Open on the chart right now" className="h-2 w-2 animate-pulse rounded-full bg-[#FF8A3D]" />}
                      <span className="text-[14px] font-semibold text-white">{r.idea.label}</span>
                      {isNew(r.idea.id, pinned) && <NewBadge />}
                      {v && <VerdictBadge v={v} title={r.judged!.reason} />}
                      <FitChip r={r} />
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-white/50">{r.idea.idea}</span>
                    <span className="mt-1 block font-mono text-[11px] tabular-nums text-white/60">{statLine(r)}</span>
                    {fired != null && <span className="mt-0.5 block text-[11px] text-white/40">Fired {fired} time{fired === 1 ? "" : "s"} on the bars loaded here</span>}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <Spark points={r.study?.spark ?? []} />
                    <ChevronDown className={clsx("h-3.5 w-3.5 text-white/35 transition", isOpen && "rotate-180")} />
                  </span>
                </button>
                {isOpen && (
                  <div className="mt-2 space-y-2 pl-0.5">
                    {r.judged && <p className="text-[12px] leading-snug text-white/60">{r.judged.reason}</p>}
                    {r.study && <p className="text-[11px] text-white/35">{sourceLine(r.study)}</p>}
                    {r.fit?.best && r.study && <p className="text-[11px] text-white/45">{fitLine(r.fit, r.study)}</p>}
                    {r.study?.smt && <p className="text-[11px] text-white/45">{smtLine(r.study.smt)}</p>}
                    <div className="flex flex-wrap gap-1.5">
                      <Action on={() => onShow(r.idea.id as ChartRead)} active={current === r.idea.id} icon={<Eye className="h-3.5 w-3.5" />}>
                        {current === r.idea.id ? "On the chart" : "Show on chart"}
                      </Action>
                      <Action on={() => onBacktest(r)} icon={<FlaskConical className="h-3.5 w-3.5" />}>
                        Backtest
                      </Action>
                      <Action on={() => onBacktest(r, "gallery")} icon={<Images className="h-3.5 w-3.5" />}>
                        See examples
                      </Action>
                      <Action on={() => onBacktest(r, "drill")} icon={<Target className="h-3.5 w-3.5" />}>
                        Practise
                      </Action>
                      {!isReader(r.idea.id) && (
                        <Action on={() => onPin(r.idea.id)} active={pinnedNow} icon={pinnedNow ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}>
                          {pinnedNow ? "Unpin" : "Pin to my strategies"}
                        </Action>
                      )}
                      {r.idea.playbooks?.[0] && (
                        <a href={`/app/playbooks?playbook=${r.idea.playbooks[0]}`} className="flex items-center gap-1.5 rounded-full bg-white/[0.07] px-2.5 py-1 text-[12px] font-semibold text-white/80 hover:bg-white/[0.12]">
                          <BookOpen className="h-3.5 w-3.5" /> Open playbook
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <footer className="border-t border-white/[0.06] px-5 py-3 text-[12px] leading-snug text-white/50">
          Tested {tested} idea{tested === 1 ? "" : "s"} on this market. Expect a few to look good by luck; the Proven badge already allows for that.
        </footer>
      </aside>
    </div>,
    document.body,
  );
}

const VERDICT_LABEL: Record<Verdict, string> = { proven: "Proven", promising: "Promising", unproven: "Unproven", losing: "Losing" };

function SourceNote({ data }: { data: DiscoverData }) {
  if (data.job)
    return (
      <div className="mt-3 rounded-xl bg-white/[0.04] p-2.5">
        <p className="text-[12px] text-white/70">{data.job.stage}</p>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.08]">
          <div className="h-full bg-[#FF8A3D] transition-[width]" style={{ width: `${(data.job.done / Math.max(1, data.job.total)) * 100}%` }} />
        </div>
      </div>
    );
  if (data.status === "loading") return <p className="mt-3 text-[12px] text-white/45">{data.progress != null ? `Rating every idea on recent bars… ${Math.round(data.progress * 100)}%` : "Loading the study…"}</p>;
  if (data.status === "error") return <p className="mt-3 text-[12px] text-[#FF8D85]">{data.error}</p>;
  if (data.source === "recent")
    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/[0.04] p-2.5">
        <p className="flex-1 text-[12px] leading-snug text-white/60">About 60 days of history: nothing here can be rated proven.</p>
        {data.canDeep && (
          <button onClick={data.runDeep} className="shrink-0 rounded-full bg-[#FF8A3D] px-3 py-1.5 text-[12px] font-bold text-black">
            Study your library
          </button>
        )}
      </div>
    );
  if (data.source === "library") return <p className="mt-3 text-[11.5px] text-white/40">Rated on your library, {data.studyTf} bars, after fees and a tick of slippage, judged on the newest 30%.</p>;
  return null;
}

function DialsEditor({ dials, onDials }: { dials: Dials; onDials: (d: Dials) => void }) {
  const num = (k: "minTrades" | "minT" | "minGreenYears", step: number) => (
    <label className="flex items-center justify-between gap-2 text-[12px] text-white/65">
      {k === "minTrades" ? "Trades needed" : k === "minT" ? "t-stat needed (newest 30%)" : "Share of green years"}
      <input type="number" step={step} min={0} value={dials[k]} onChange={(e) => Number.isFinite(Number(e.target.value)) && onDials({ ...dials, [k]: Number(e.target.value) })} className="w-20 rounded-lg bg-white/[0.07] px-2 py-1 text-right font-semibold tabular-nums text-white outline-none ring-1 ring-inset ring-white/[0.08]" />
    </label>
  );
  return (
    <div className="mt-3 space-y-2 rounded-xl bg-white/[0.04] p-3">
      {num("minTrades", 50)}
      {num("minT", 0.1)}
      {num("minGreenYears", 0.05)}
      <label className="flex items-center justify-between text-[12px] text-white/65">
        Hide losing ideas
        <input type="checkbox" checked={dials.hideLosing} onChange={(e) => onDials({ ...dials, hideLosing: e.target.checked })} />
      </label>
      <div className="flex items-center justify-between">
        <p className="text-[11px] leading-snug text-white/40">These change what the panel shows. Real orders always use the strict defaults.</p>
        <button onClick={() => onDials({ ...DISCOVER_DEFAULTS })} className="shrink-0 text-[11.5px] font-semibold text-[#FFB27D]">
          Reset
        </button>
      </div>
    </div>
  );
}

function Select<T extends string>({ value, options, label, onChange }: { value: T; options: T[]; label: (v: T) => string; onChange: (v: T) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[12px] font-semibold capitalize text-white/75 outline-none hover:bg-white/[0.1]">
      {options.map((o) => (
        <option key={o} value={o}>
          {label(o)}
        </option>
      ))}
    </select>
  );
}

function Action({ on, icon, children, active }: { on: () => void; icon: React.ReactNode; children: React.ReactNode; active?: boolean }) {
  return (
    <button onClick={on} className={clsx("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold transition", active ? "bg-[#FF8A3D] text-black" : "bg-white/[0.07] text-white/80 hover:bg-white/[0.12]")}>
      {icon}
      {children}
    </button>
  );
}

/** The divergence tag, measured: how sweeps did when the other index joined them, and when it didn't. */
function smtLine(m: { confirmed: [number, number]; diverged: [number, number] }) {
  const avg = ([n, sum]: [number, number]) => (n ? `${sum / n >= 0 ? "+" : ""}${(sum / n).toFixed(2)}R over ${n}` : "no trades");
  return `When the other index didn't confirm: ${avg(m.diverged)}. When it did: ${avg(m.confirmed)}.`;
}
