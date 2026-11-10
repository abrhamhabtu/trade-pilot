"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import type { Bar } from "@/lib/pilot/market";
import type { BacktestTrade } from "@/lib/vision/backtest";
import { BUCKET_LABEL, bucketOf, type Bucket } from "@/lib/vision/levels";
import { useVisionStore } from "@/store/visionStore";
import { MiniChart } from "./MiniChart";

const CELL_W = 220;
const CELL_H = 120;
const GAP = 10;
const ROW = CELL_H + 38 + GAP;
const GRADES = ["A", "B", "C"] as const;
type Grade = (typeof GRADES)[number];

const gradeOf = (tags: string[] | undefined): Grade | null => (tags?.find((t) => (GRADES as readonly string[]).includes(t)) as Grade | undefined) ?? null;
const sumR = (ts: BacktestTrade[]) => ts.reduce((a, t) => a + t.r, 0);

/**
 * Every trade as a small chart, to see what the pattern really looks like and
 * grade each one. Grades live in the trade journal as tags A, B and C, and the
 * strip on top compares them: the way to learn which versions to take.
 */
export function Gallery({ trades, bars, symbol, onOpen }: { trades: BacktestTrade[]; bars: Bar[]; symbol: string; onOpen: (t: BacktestTrade) => void }) {
  const journal = useVisionStore((s) => s.journal);
  const setJournal = useVisionStore((s) => s.setJournal);
  const [outcome, setOutcome] = useState<"all" | "win" | "loss">("all");
  const [side, setSide] = useState<"all" | "long" | "short">("all");
  const [bucket, setBucket] = useState<Bucket | "all">("all");
  const [month, setMonth] = useState("all");
  const [grade, setGrade] = useState<Grade | "none" | "all">("all");
  const [sel, setSel] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState(0);
  const [width, setWidth] = useState(900);
  const keyOf = (t: BacktestTrade) => `${symbol}:${t.entryT}`;

  const tagged = useMemo(() => trades.map((t) => ({ t, bucket: bucketOf(t.entryT), month: new Date(t.entryT * 1000).toISOString().slice(0, 7) })), [trades]);
  const months = useMemo(() => [...new Set(tagged.map((x) => x.month))].sort(), [tagged]);
  const shown = useMemo(
    () =>
      tagged.filter((x) => {
        if (outcome !== "all" && (outcome === "win") !== x.t.r > 0) return false;
        if (side !== "all" && x.t.side !== side) return false;
        if (bucket !== "all" && x.bucket !== bucket) return false;
        if (month !== "all" && x.month !== month) return false;
        const g = gradeOf(journal[keyOf(x.t)]?.tags);
        if (grade === "none" ? g != null : grade !== "all" && g !== grade) return false;
        return true;
      }),
    [tagged, outcome, side, bucket, month, grade, journal], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => setSel((k) => Math.min(k, Math.max(0, shown.length - 1))), [shown.length]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const cols = Math.max(1, Math.floor((width + GAP) / (CELL_W + GAP)));
  const rows = Math.ceil(shown.length / cols);
  const height = 620;
  const firstRow = Math.max(0, Math.floor(scroll / ROW) - 1);
  const lastRow = Math.min(rows, Math.ceil((scroll + height) / ROW) + 1);

  const setG = (t: BacktestTrade, g: Grade) => {
    const e = journal[keyOf(t)] ?? { tags: [], note: "" };
    const tags = e.tags.filter((x) => !(GRADES as readonly string[]).includes(x));
    setJournal(keyOf(t), { ...e, tags: gradeOf(e.tags) === g ? tags : [...tags, g] });
  };
  // Keys while the wall has focus: arrows move, 1 2 3 grade, Enter opens the trade.
  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key;
    const move = k === "ArrowRight" ? 1 : k === "ArrowLeft" ? -1 : k === "ArrowDown" ? cols : k === "ArrowUp" ? -cols : 0;
    if (move) {
      e.preventDefault();
      const next = Math.max(0, Math.min(shown.length - 1, sel + move));
      setSel(next);
      const r = Math.floor(next / cols) * ROW;
      const el = box.current!;
      if (r < el.scrollTop) el.scrollTop = r;
      else if (r + ROW > el.scrollTop + height) el.scrollTop = r + ROW - height;
      return;
    }
    const t = shown[sel]?.t;
    if (!t) return;
    if (k === "1" || k === "2" || k === "3") setG(t, GRADES[Number(k) - 1]);
    else if (k === "Enter") onOpen(t);
  };

  // The strip: what each grade earned, against everything.
  const strip = useMemo(() => {
    const by = (g: Grade) => trades.filter((t) => gradeOf(journal[keyOf(t)]?.tags) === g);
    return GRADES.map((g) => ({ g, ts: by(g) })).filter((x) => x.ts.length);
  }, [trades, journal]); // eslint-disable-line react-hooks/exhaustive-deps
  const avg = (ts: BacktestTrade[]) => (ts.length ? sumR(ts) / ts.length : 0);
  const sign = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(2)}R`;

  return (
    <section className="rounded-[26px] border border-white/[0.07] bg-[#121214]/80 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto text-[16px] font-bold text-white">Setup gallery</h3>
        <F value={outcome} set={setOutcome} options={[["all", "Wins and losses"], ["win", "Wins"], ["loss", "Losses"]]} />
        <F value={side} set={setSide} options={[["all", "Both sides"], ["long", "Longs"], ["short", "Shorts"]]} />
        <F value={bucket} set={setBucket} options={[["all", "Any session"], ...(["asia", "london", "pre", "ny-open", "ny-mid", "ny-pm"] as Bucket[]).map((b) => [b, BUCKET_LABEL[b]] as [string, string])]} />
        <F value={month} set={setMonth} options={[["all", "Any month"], ...months.map((m) => [m, m] as [string, string])]} />
        <F value={grade} set={setGrade} options={[["all", "Any grade"], ["A", "A"], ["B", "B"], ["C", "C"], ["none", "Ungraded"]]} />
      </div>
      <p className="mt-2 text-[12.5px] text-white/55">
        {strip.length ? (
          <>
            {strip.map((x) => (
              <span key={x.g} className="mr-3">
                Your <b className="text-white">{x.g}</b> setups: <span className={avg(x.ts) >= 0 ? "text-[#FFB27D]" : "text-[#FF8D85]"}>{sign(avg(x.ts))}</span> over {x.ts.length}.
              </span>
            ))}
            All: {sign(avg(trades))} over {trades.length}.
          </>
        ) : (
          <>Grade trades with 1, 2 and 3 (A, B, C) to learn which versions of this setup pay. All {trades.length}: {sign(avg(trades))} a trade.</>
        )}
      </p>
      <p className="mt-0.5 text-[11.5px] text-white/35">
        {shown.length.toLocaleString("en-US")} shown · click the wall, then arrows to move, 1 2 3 to grade, Enter to open
      </p>
      <div ref={box} tabIndex={0} onKeyDown={onKey} onScroll={(e) => setScroll(e.currentTarget.scrollTop)} className="mt-3 overflow-y-auto rounded-2xl outline-none ring-[#FF8A3D]/40 focus:ring-2" style={{ height }}>
        <div className="relative" style={{ height: rows * ROW }}>
          {shown.slice(firstRow * cols, lastRow * cols).map((x, k) => {
            const idx = firstRow * cols + k;
            const row = Math.floor(idx / cols);
            const col = idx % cols;
            const g = gradeOf(journal[keyOf(x.t)]?.tags);
            const win = x.t.r > 0;
            return (
              <button
                key={x.t.entryT}
                onClick={() => setSel(idx)}
                onDoubleClick={() => onOpen(x.t)}
                className={clsx("absolute overflow-hidden rounded-xl bg-white/[0.03] text-left ring-1 transition", idx === sel ? "ring-2 ring-[#FF8A3D]" : "ring-white/[0.06] hover:ring-white/20")}
                style={{ left: col * (CELL_W + GAP), top: row * ROW, width: CELL_W }}
              >
                <span className={clsx("absolute right-0 top-0 h-0 w-0 border-l-[16px] border-t-[16px] border-l-transparent", win ? "border-t-[#FF8A3D]" : "border-t-[#FF5A4E]")} />
                <MiniChart bars={bars} t={x.t} width={CELL_W} height={CELL_H} win={win} />
                <span className="flex items-center gap-2 px-2 py-1.5 text-[11px] tabular-nums">
                  <span className={clsx("font-bold", win ? "text-[#FFB27D]" : "text-[#FF8D85]")}>{sign(x.t.r)}</span>
                  <span className="text-white/45">{x.t.side}</span>
                  <span className="truncate text-white/35">{new Date(x.t.entryT * 1000).toISOString().slice(0, 10)}</span>
                  {g && <span className="ml-auto rounded bg-white px-1.5 text-[10px] font-black text-black">{g}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function F<T extends string>({ value, set, options }: { value: T; set: (v: T) => void; options: [string, string][] }) {
  return (
    <select value={value} onChange={(e) => set(e.target.value as T)} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[12px] font-semibold text-white/75 outline-none">
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}
