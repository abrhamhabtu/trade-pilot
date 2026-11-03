"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FlaskConical, FolderOpen, History, LineChart, ShieldCheck } from "lucide-react";
import { READERS, type ReaderId } from "@/lib/vision/analyze";
import type { BacktestOptions, BacktestResult } from "@/lib/vision/backtest";
import type { BacktestRequest } from "@/lib/vision/backtest.worker";
import { SYMBOLS, isSymbol } from "@/lib/vision/markets";
import { useVisionStore, type BacktestSettings } from "@/store/visionStore";
import { dateOf, useContext, useHistory, useLibrary, useSaved, type Loaded, type SavedItem } from "./data";
import { Library } from "./Library";
import { Replay } from "./Replay";
import { Results, type LeagueRow } from "./Results";
import { SetupPanel } from "./SetupPanel";
import { Card, Pill, Seg } from "./ui";

// Entry windows in New York minutes of the day.
export const SESSIONS = { all: null, rth: [570, 960], open: [570, 690] } as const satisfies Record<string, [number, number] | null>;

type Run = { result: BacktestResult; loaded: Loaded; settings: BacktestSettings; league: LeagueRow[] | null };

const strategyName = (s: BacktestSettings) => (s.reader === "auto" ? "Every strategy" : READERS[s.reader].label);
const flat = (t: Record<string, unknown>) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, /T$/.test(k) && typeof v === "number" ? new Date(v * 1000).toISOString() : v]));

export function BacktestWorkspace() {
  const tab = useVisionStore((s) => s.btTab);
  const bt = useVisionStore((s) => s.bt);
  const set = useVisionStore((s) => s.set);
  const setBt = useVisionStore((s) => s.setBt);
  const library = useLibrary();
  const saved = useSaved();
  const { ctx, has } = useContext(bt.symbol);
  const history = useHistory(library.lib);
  const [run, setRun] = useState<Run | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [replay, setReplay] = useState<{ loaded: Loaded; settings: BacktestSettings } | null>(null);
  const worker = useRef<Worker | null>(null);
  const seq = useRef(0);
  useEffect(() => () => worker.current?.terminate(), []);

  const sym = isSymbol(bt.symbol) ? SYMBOLS[bt.symbol] : null;

  const start = useCallback(
    async (override?: Partial<BacktestSettings>) => {
      const s = { ...useVisionStore.getState().bt, ...override };
      if (override) setBt(override);
      setError("");
      setRunning(true);
      setProgress(null);
      const loaded = await history.load(s);
      if (!loaded) {
        setRunning(false);
        return;
      }
      const m = isSymbol(s.symbol) ? SYMBOLS[s.symbol] : null;
      const crypto = m?.kind === "crypto";
      const options: BacktestOptions = {
        reader: s.reader,
        anchor: crypto ? "utc" : "rth",
        side: s.side,
        pointValue: crypto || !m ? 1 : s.micro ? m.pointValue!.micro : m.pointValue!.full,
        contracts: Math.max(1, s.contracts),
        riskDollars: crypto ? s.riskDollars : undefined,
        commission: s.commission,
        slippageTicks: s.slippageTicks,
        tick: m?.tick ?? 0.25,
        maxHold: s.maxHold,
        skipFomc: s.skipFomc && has.fomc,
        skipEarly: s.skipEarly && has.early,
        vix: has.vix ? s.vix : "any",
        hours: SESSIONS[s.session ?? "all"],
        context: ctx,
      };
      worker.current ??= new Worker(new URL("../../../lib/vision/backtest.worker.ts", import.meta.url));
      const id = ++seq.current;
      worker.current.onmessage = (e: MessageEvent) => {
        const msg = e.data;
        if (msg.id !== seq.current) return;
        if (msg.type === "progress") setProgress(msg.done / msg.total);
        else if (msg.type === "done") {
          setRun({ result: msg.result, loaded, settings: s, league: null });
          setSaveState("idle");
          setRunning(false);
          setProgress(null);
        } else if (msg.type === "league") setRun((r) => (r ? { ...r, league: msg.rows } : r));
        else if (msg.type === "error") {
          setError(msg.error);
          setRunning(false);
        }
      };
      worker.current.postMessage({ id, bars: loaded.bars, options, league: true } satisfies BacktestRequest);
    },
    [history, ctx, has, setBt],
  );

  const startReplay = async () => {
    const s = useVisionStore.getState().bt;
    setError("");
    setRunning(true);
    const loaded = await history.load(s);
    setRunning(false);
    if (loaded) setReplay({ loaded, settings: s });
  };

  const saveRun = async () => {
    if (!run) return;
    setSaveState("saving");
    const { result, settings } = run;
    const st = result.stats;
    const item = await saved.save({
      item: {
        kind: "backtest",
        name: `${strategyName(settings)} · ${settings.symbol} ${settings.tf} · ${dateOf(result.from)} – ${dateOf(result.to)}`,
        symbol: settings.symbol,
        tf: settings.tf,
        summary: { trades: st.trades, winRate: st.winRate, netR: st.netR, pnl: st.pnl, profitFactor: st.profitFactor === Infinity ? 999 : st.profitFactor, maxDrawdown: st.maxDrawdown, from: result.from, to: result.to },
      },
      settings,
      trades: result.trades.map((t) => flat({ ...t } as unknown as Record<string, unknown>)),
      extra: { stats: result.stats, by: result.by, skipped: result.skipped, source: run.loaded.label, league: run.league },
    });
    setSaveState(item ? "saved" : "error");
  };

  const openSaved = async (s: SavedItem) => {
    const r = await fetch(`/api/library/saved?id=${s.id}`, { cache: "no-store" });
    if (!r.ok) return;
    const j = await r.json();
    set({ btTab: "test" });
    start(j.settings as BacktestSettings);
  };

  const stale = run && JSON.stringify(run.settings) !== JSON.stringify(bt);
  const nq = library.lib?.series.NQ;

  return (
    <div className="space-y-5">
      {/* You are in backtest mode */}
      <section className="flex flex-wrap items-center gap-4 rounded-[24px] border border-[#5AC8FA]/25 bg-[linear-gradient(100deg,rgba(90,200,250,0.16),rgba(90,200,250,0.04)_60%,rgba(18,18,20,0.6))] px-5 py-3.5 backdrop-blur-2xl">
        <span className="relative grid h-10 w-10 place-items-center rounded-[13px] bg-gradient-to-br from-[#A6E8FF] to-[#2FA8EE] text-black shadow-[0_12px_28px_-12px_rgba(90,200,250,0.9)]">
          <FlaskConical className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[15px] font-bold text-white">
            Backtesting <Pill tone="cyan">HISTORY ONLY</Pill>
          </p>
          <p className="text-[13px] text-white/60">Your strategies run over past bars. Nothing here touches your paper book, your stats or a broker.</p>
        </div>
        <span className="flex items-center gap-1.5 text-[12.5px] text-white/50">
          <ShieldCheck className="h-4 w-4 text-[#9BE1FF]" />
          {nq ? `NQ ${new Date(nq.from * 1000).getUTCFullYear()}–${new Date(nq.to * 1000).getUTCFullYear()} in your library` : "Free feeds · add files for years of history"}
        </span>
      </section>

      <Seg
        value={tab}
        onChange={(btTab) => set({ btTab })}
        label="Backtest section"
        options={[
          {
            v: "test" as const,
            l: (
              <span className="flex items-center gap-1.5">
                <LineChart className="h-4 w-4" /> Strategy test
              </span>
            ),
          },
          {
            v: "replay" as const,
            l: (
              <span className="flex items-center gap-1.5">
                <History className="h-4 w-4" /> Replay
              </span>
            ),
          },
          {
            v: "library" as const,
            l: (
              <span className="flex items-center gap-1.5">
                <FolderOpen className="h-4 w-4" /> Library{saved.items?.length ? ` · ${saved.items.length}` : ""}
              </span>
            ),
          },
        ]}
      />

      {(error || history.error) && <p className="rounded-2xl bg-[#FF7A85]/12 px-4 py-2.5 text-[13.5px] text-[#FFA3AB]">{error || history.error}</p>}

      {tab === "test" && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-3">
            {stale && !running && (
              <button onClick={() => start()} className="flex w-full items-center justify-between rounded-2xl bg-white/[0.05] px-4 py-2.5 text-left text-[13px] text-white/65 ring-1 ring-white/[0.06] hover:bg-white/[0.08]">
                <span>Settings changed since this run.</span>
                <span className="font-semibold text-[#9BE1FF]">Run again</span>
              </button>
            )}
            {run ? (
              <Results
                result={run.result}
                bars={run.loaded.bars}
                sym={isSymbol(run.settings.symbol) ? SYMBOLS[run.settings.symbol] : null}
                anchor={isSymbol(run.settings.symbol) && SYMBOLS[run.settings.symbol].kind === "crypto" ? "utc" : "rth"}
                label={`${strategyName(run.settings)} · ${run.settings.symbol} ${run.settings.tf} · ${run.loaded.label}${run.loaded.truncated ? " · latest bars only" : ""}`}
                onSave={saveRun}
                saved={saveState}
                league={run.league}
                onUse={(reader: ReaderId) => start({ reader })}
              />
            ) : (
              <Intro running={running} />
            )}
          </div>
          <div className="xl:sticky xl:top-4 xl:self-start">
            <SetupPanel lib={library.lib} has={has} onRun={() => start()} running={running} progress={progress} />
          </div>
        </div>
      )}

      {tab === "replay" &&
        (replay && isSymbol(replay.settings.symbol) ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="cyan">
                {replay.settings.symbol} · {replay.settings.tf}
              </Pill>
              <Pill>
                {dateOf(replay.loaded.bars[0].t)} – {dateOf(replay.loaded.bars[replay.loaded.bars.length - 1].t)}
              </Pill>
              <Pill>Vision reads with {strategyName(replay.settings)}</Pill>
              <button onClick={() => setReplay(null)} className="ml-auto rounded-full bg-white/[0.07] px-3 py-1.5 text-[12.5px] font-semibold text-white/75 hover:bg-white/[0.12]">
                Change market or period
              </button>
            </div>
            <Replay
              loaded={replay.loaded}
              sym={SYMBOLS[replay.settings.symbol]}
              anchor={SYMBOLS[replay.settings.symbol].kind === "crypto" ? "utc" : "rth"}
              reader={replay.settings.reader}
              contracts={replay.settings.contracts}
              micro={replay.settings.micro}
              riskDollars={replay.settings.riskDollars}
              onSave={async ({ trades, from, to }) => {
                const net = trades.reduce((a, t) => a + t.pnl, 0);
                const item = await saved.save({
                  item: {
                    kind: "replay",
                    name: `Replay · ${replay.settings.symbol} ${replay.settings.tf} · ${dateOf(from)}${dateOf(to) !== dateOf(from) ? ` – ${dateOf(to)}` : ""}`,
                    symbol: replay.settings.symbol,
                    tf: replay.settings.tf,
                    summary: { trades: trades.length, winRate: trades.filter((t) => t.pnl > 0).length / trades.length, pnl: net, netR: trades.reduce((a, t) => a + t.r, 0) },
                  },
                  settings: replay.settings,
                  trades: trades.map((t) => flat({ ...t } as unknown as Record<string, unknown>)),
                });
                return !!item;
              }}
            />
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Card>
              <span className="grid h-12 w-12 place-items-center rounded-[15px] bg-[#5AC8FA]/14 text-[#9BE1FF]">
                <History className="h-6 w-6" />
              </span>
              <h2 className="mt-4 text-[26px] font-bold tracking-tight text-white">Trade the past, one bar at a time</h2>
              <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-white/60">
                Pick a market and period, then play it forward. The future stays hidden, you place trades with a stop and target, and Vision marks setups as they form so you can practise taking them. Jump to any date, or straight to the
                next setup.
              </p>
              <ul className="mt-4 grid gap-2 text-[13.5px] text-white/65 sm:grid-cols-2">
                <li>▸ Play, pause, step one or ten bars, up to 25×</li>
                <li>▸ Buy and sell with keys: B, S, X</li>
                <li>▸ Take Vision&apos;s plan in one tap</li>
                <li>▸ Save the session to your Library</li>
              </ul>
            </Card>
            <SetupPanel lib={library.lib} has={has} onRun={startReplay} running={running} progress={null} rules={false} runLabel="Start replay" />
          </div>
        ))}

      {tab === "library" && <Library lib={library.lib} error={library.error} refresh={library.refresh} saved={saved.items} onRemoveSaved={saved.remove} onOpenRun={openSaved} />}

      {sym == null && tab !== "library" && <p className="text-[12.5px] text-white/45">{bt.symbol} is in your library only; pick it with Library as the data source.</p>}
    </div>
  );
}

function Intro({ running }: { running: boolean }) {
  return (
    <Card className="min-h-[420px]">
      <span className="grid h-12 w-12 place-items-center rounded-[15px] bg-[#5AC8FA]/14 text-[#9BE1FF]">
        <LineChart className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-[26px] font-bold tracking-tight text-white">{running ? "Running your strategy over history…" : "Test a strategy over years of bars"}</h2>
      <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-white/60">
        Vision runs the same readers you use live, the double-break VWAP, Octavia&apos;s supply and demand, sweeps, the opening range and VWAP pullbacks, over every bar in the period. It takes one trade at a time and counts commission and
        slippage.
      </p>
      <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
        {[
          ["Equity & drawdown", "The curve, the deepest dip and the longest losing run"],
          ["Where the edge is", "By hour, weekday, month, VIX, FOMC, side and strategy"],
          ["Every trade", "Tap one to see it drawn on the chart, exactly as Vision read it"],
        ].map(([a, b]) => (
          <div key={a} className="rounded-[18px] bg-white/[0.04] p-3.5 ring-1 ring-inset ring-white/[0.05]">
            <p className="text-[13.5px] font-semibold text-white">{a}</p>
            <p className="mt-0.5 text-[12.5px] text-white/50">{b}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 text-[12.5px] text-white/40">Pick your settings on the right and press Run.</p>
    </Card>
  );
}
