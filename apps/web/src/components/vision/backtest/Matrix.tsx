"use client";

import { useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Grid3x3, Square } from "lucide-react";
import type { BacktestResult } from "@/lib/vision/backtest";
import type { SessionKey } from "@/lib/vision/custom";
import { sideOf, tNeeded } from "@/lib/vision/discover";
import { coinFlipOdds } from "@/lib/vision/lab";
import type { Timeframe } from "@/lib/vision/markets";
import type { PropReport } from "@/lib/vision/prop";
import { programByKey } from "@/lib/proving/firms";
import type { BacktestSettings } from "@/store/visionStore";

const SYMBOLS = ["NQ", "ES", "GC"];
const TFS: Timeframe[] = ["5m", "15m"];
const SESSIONS: { k: SessionKey; l: string }[] = [
  { k: "asia", l: "Asia" },
  { k: "london", l: "London" },
  { k: "open", l: "NY open" },
  { k: "ny", l: "New York" },
];
const CELLS = SYMBOLS.length * TFS.length * SESSIONS.length;

interface Cell {
  key: string;
  patch: Partial<BacktestSettings>;
  trades: number;
  meanR: number;
  t: number;
  newerR: number;
  newerT: number;
  passRate: number | null;
}

/**
 * The current strategy everywhere at once: three markets, two timeframes,
 * four sessions. With 24 tests the best cell is partly luck, so a cell is
 * outlined only when it holds on both halves and clears the bar for 24 tests.
 */
export function Matrix({ settings, run, stop, onOpen }: { settings: BacktestSettings; run: (p: Partial<BacktestSettings>) => Promise<{ result: BacktestResult; prop: PropReport | null } | null>; stop: () => void; onOpen: (p: Partial<BacktestSettings>) => void }) {
  const [cells, setCells] = useState<Map<string, Cell | null>>(new Map());
  const [busy, setBusy] = useState<string | null>(null);
  const cancel = useRef(false);
  const need = tNeeded(CELLS);
  const program = settings.prop.on ? programByKey(settings.prop.program) : null;
  const coin = useMemo(() => (program ? coinFlipOdds(program, { runs: 300 }).rate : null), [program?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = async () => {
    cancel.current = false;
    setCells(new Map());
    for (const symbol of SYMBOLS)
      for (const tf of TFS)
        for (const s of SESSIONS) {
          if (cancel.current) return;
          const key = `${symbol}|${tf}|${s.k}`;
          setBusy(key);
          const patch: Partial<BacktestSettings> = { symbol, tf, session: s.k, source: "library" };
          const r = await run(patch);
          if (cancel.current) return;
          let cell: Cell | null = null;
          if (r) {
            const rs = r.result.trades.map((t) => t.r);
            const all = sideOf(rs);
            const newer = sideOf(rs.slice(Math.floor(rs.length * 0.7)));
            cell = { key, patch, trades: rs.length, meanR: all.avgR, t: all.t, newerR: newer.avgR, newerT: newer.t, passRate: r.prop?.rolling.passRate ?? null };
          }
          setCells((m) => new Map(m).set(key, cell));
        }
    setBusy(null);
  };
  const halt = () => {
    cancel.current = true;
    stop();
    setBusy(null);
  };
  const done = [...cells.values()].length;
  const running = busy != null;

  return (
    <section className="rounded-[26px] border border-white/[0.07] bg-[#121214]/80 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Grid3x3 className="h-4 w-4 text-[#9BE1FF]" />
        <h3 className="mr-auto text-[16px] font-bold text-white">Run everywhere</h3>
        {running ? (
          <button onClick={halt} className="flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-white/[0.12]">
            <Square className="h-3.5 w-3.5" /> Cancel
          </button>
        ) : (
          <button onClick={go} className="rounded-full bg-[#5AC8FA] px-3.5 py-1.5 text-[12.5px] font-bold text-black">
            {done ? "Run all 24 again" : "Run all 24"}
          </button>
        )}
      </div>
      <p className="mt-1.5 text-[12.5px] leading-snug text-white/55">
        24 tests: the best cell is partly luck. Trust cells that hold on the newest data. Outlined cells are positive on both halves and clear t {need.toFixed(1)} on the newest 30%.
      </p>
      {running && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full bg-[#5AC8FA] transition-[width]" style={{ width: `${(done / CELLS) * 100}%` }} />
        </div>
      )}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[620px] border-separate border-spacing-1 text-[11.5px] tabular-nums">
          <thead>
            <tr className="text-white/40">
              <th className="text-left font-semibold" />
              {SESSIONS.map((s) => (
                <th key={s.k} className="font-semibold">
                  {s.l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SYMBOLS.flatMap((symbol) =>
              TFS.map((tf) => (
                <tr key={`${symbol}${tf}`}>
                  <td className="pr-2 font-semibold text-white/70">
                    {symbol} {tf}
                  </td>
                  {SESSIONS.map((s) => {
                    const key = `${symbol}|${tf}|${s.k}`;
                    const c = cells.get(key);
                    const strong = !!c && c.trades >= 30 && c.meanR > 0 && c.newerR > 0 && c.newerT >= need;
                    const heat = c ? Math.max(-1, Math.min(1, c.t / 3)) : 0;
                    return (
                      <td key={s.k}>
                        <button
                          disabled={!c || !c.trades}
                          onClick={() => c && onOpen(c.patch)}
                          title={c ? `${c.trades} trades · ${c.meanR >= 0 ? "+" : ""}${c.meanR.toFixed(3)}R a trade, t ${c.t.toFixed(1)} · newest 30%: ${c.newerR >= 0 ? "+" : ""}${c.newerR.toFixed(3)}R, t ${c.newerT.toFixed(1)}. Click for the full report.` : undefined}
                          className={clsx("w-full rounded-lg px-2 py-1.5 text-left transition", strong ? "ring-2 ring-[#FF8A3D]" : "ring-1 ring-white/[0.05]", busy === key && "animate-pulse")}
                          style={{ background: c ? (heat >= 0 ? `rgba(255,138,61,${0.06 + heat * 0.3})` : `rgba(255,90,78,${0.06 - heat * 0.3})`) : "rgba(255,255,255,0.02)" }}
                        >
                          {c && !c.trades ? (
                            <span className="text-white/35">no trades</span>
                          ) : c ? (
                            <>
                              <span className="block font-semibold text-white">
                                {c.meanR >= 0 ? "+" : ""}
                                {c.meanR.toFixed(2)}R · t {c.t.toFixed(1)}
                              </span>
                              <span className="block text-white/45">
                                new {c.newerR >= 0 ? "+" : ""}
                                {c.newerR.toFixed(2)}R · {c.trades}
                              </span>
                              {c.passRate != null && coin != null && (
                                <span className="block text-white/45">
                                  pass {Math.round(c.passRate * 100)}% vs {Math.round(coin * 100)}%
                                </span>
                              )}
                            </>
                          ) : c === null ? (
                            <span className="text-white/30">no data</span>
                          ) : (
                            <span className="text-white/20">{busy === key ? "running…" : "·"}</span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
      {program && coin != null && <p className="mt-2 text-[11px] text-white/35">Pass rates at {program.firm} {program.sizeLabel}; a trader with no edge passes about {Math.round(coin * 100)}% under the same rules.</p>}
    </section>
  );
}
