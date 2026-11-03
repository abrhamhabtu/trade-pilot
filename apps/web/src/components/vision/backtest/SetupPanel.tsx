"use client";

import clsx from "clsx";
import { Database, Play, Radio } from "lucide-react";
import { READERS, READER_ORDER, type ReaderChoice } from "@/lib/vision/analyze";
import { SYMBOLS, TIMEFRAMES, isSymbol, type Timeframe, type VisionSymbolId } from "@/lib/vision/markets";
import { useVisionStore } from "@/store/visionStore";
import { dateOf, type Library } from "./data";
import { Card, Field, Num, Seg, Toggle } from "./ui";

const MARKETS: VisionSymbolId[] = ["NQ", "ES", "GC", "CL", "BTC", "ETH", "SOL", "XRP"];
const PERIODS = [
  { v: 0, l: "All" },
  { v: 30, l: "30D" },
  { v: 90, l: "90D" },
  { v: 365, l: "1Y" },
  { v: 1095, l: "3Y" },
  { v: -1, l: "Custom" },
];
// Roughly what the free feeds hold at each timeframe.
const FEED_DAYS: Record<"futures" | "crypto", Record<Timeframe, string>> = {
  futures: { "1m": "7 days", "5m": "60 days", "15m": "60 days", "1h": "2 years", "4h": "2 years" },
  crypto: { "1m": "6 days", "5m": "31 days", "15m": "94 days", "1h": "1 year", "4h": "1 year" },
};

export function SetupPanel({
  lib,
  has,
  onRun,
  running,
  progress,
  rules = true,
  runLabel = "Run backtest",
}: {
  lib: Library | null;
  has: { fomc: boolean; early: boolean; vix: boolean };
  onRun: () => void;
  running: boolean;
  progress: number | null;
  rules?: boolean;
  runLabel?: string;
}) {
  const bt = useVisionStore((s) => s.bt);
  const setBt = useVisionStore((s) => s.setBt);
  const sym = isSymbol(bt.symbol) ? SYMBOLS[bt.symbol] : null;
  const series = lib?.series[bt.symbol];
  const crypto = sym?.kind === "crypto";
  // Without library data for this market the free feed is used, whatever was picked.
  const source = series ? bt.source : "feed";
  const pickSymbol = (id: VisionSymbolId) => setBt({ symbol: id, source: lib?.series[id] ? "library" : "feed" });

  return (
    <Card className="space-y-5">
      <Field label="Market">
        <div className="grid grid-cols-4 gap-1.5">
          {MARKETS.map((id) => {
            const m = SYMBOLS[id];
            const own = !!lib?.series[id];
            return (
              <button
                key={id}
                onClick={() => pickSymbol(id)}
                className={clsx("relative rounded-[13px] px-2 py-2 text-left ring-1 transition", bt.symbol === id ? "bg-[#5AC8FA]/12 ring-[#5AC8FA]/55" : "bg-white/[0.04] ring-white/[0.06] hover:bg-white/[0.07]")}
              >
                <span className="flex items-center gap-1.5 text-[13.5px] font-bold text-white">
                  <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
                  {id}
                </span>
                <span className="block truncate text-[11px] text-white/45">{m.name}</span>
                {own && <Database className="absolute right-1.5 top-1.5 h-3 w-3 text-[#9BE1FF]" aria-label="In your library" />}
              </button>
            );
          })}
        </div>
      </Field>

      <Field
        label="Data"
        hint={
          source === "library" && series
            ? `${dateOf(series.from)} – ${dateOf(series.to)} · ${Math.round(series.bars).toLocaleString()} one-minute bars${series.years.length > 1 ? ` across ${series.years.length} years` : ""}`
            : sym
              ? `${crypto ? "Coinbase" : "Yahoo, continuous contract"} · about ${FEED_DAYS[crypto ? "crypto" : "futures"][bt.tf]} at ${bt.tf}${series ? "" : ". Add files in Library for years of history."}`
              : ""
        }
      >
        <Seg
          full
          value={source}
          onChange={(source) => setBt({ source })}
          options={[
            {
              v: "library" as const,
              l: (
                <span className="flex items-center justify-center gap-1.5">
                  <Database className="h-3.5 w-3.5" /> Your library
                </span>
              ),
              disabled: !series,
              title: series ? undefined : `No ${bt.symbol} in your library yet`,
            },
            {
              v: "feed" as const,
              l: (
                <span className="flex items-center justify-center gap-1.5">
                  <Radio className="h-3.5 w-3.5" /> Free feed
                </span>
              ),
              disabled: !sym,
            },
          ]}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4">
        <Field label="Timeframe">
          <Seg full size="sm" value={bt.tf} onChange={(tf) => setBt({ tf })} options={TIMEFRAMES.map((t) => ({ v: t, l: t }))} />
        </Field>
        <Field label="Period">
          <Seg full size="sm" value={bt.days} onChange={(days) => setBt({ days })} options={PERIODS} />
          {bt.days === -1 && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                type="date"
                value={bt.from ?? ""}
                onChange={(e) => setBt({ from: e.target.value })}
                className="rounded-xl bg-white/[0.06] px-3 py-2 text-[13px] text-white [color-scheme:dark] ring-1 ring-inset ring-white/[0.07]"
                aria-label="From"
              />
              <input
                type="date"
                value={bt.to ?? ""}
                onChange={(e) => setBt({ to: e.target.value })}
                className="rounded-xl bg-white/[0.06] px-3 py-2 text-[13px] text-white [color-scheme:dark] ring-1 ring-inset ring-white/[0.07]"
                aria-label="To"
              />
            </div>
          )}
        </Field>
      </div>

      <Field label={rules ? "Strategy" : "Vision reads with"}>
        <div className="space-y-1">
          {(["auto", ...READER_ORDER] as ReaderChoice[]).map((r) => (
            <button
              key={r}
              onClick={() => setBt({ reader: r })}
              className={clsx("flex w-full items-start gap-2.5 rounded-[13px] px-3 py-2 text-left transition", bt.reader === r ? "bg-[#5AC8FA]/12 ring-1 ring-[#5AC8FA]/45" : "hover:bg-white/[0.05]")}
            >
              <span className={clsx("mt-1 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full ring-2", bt.reader === r ? "ring-[#5AC8FA]" : "ring-white/25")}>
                {bt.reader === r && <span className="h-1.5 w-1.5 rounded-full bg-[#5AC8FA]" />}
              </span>
              <span>
                <span className="block text-[13.5px] font-semibold text-white">{r === "auto" ? "Every strategy" : READERS[r].label}</span>
                <span className="block text-[11.5px] leading-snug text-white/45">{r === "auto" ? "Takes whichever of your strategies fires first" : READERS[r].blurb}</span>
              </span>
            </button>
          ))}
        </div>
      </Field>

      {rules && (
        <>
          <Field label="Entry hours (New York)" hint={(bt.session ?? "rth") === "open" ? "9:30–11:30, the open drive" : (bt.session ?? "rth") === "rth" ? "9:30–16:00, the cash session" : "Around the clock, including overnight"}>
            <Seg full size="sm" value={bt.session ?? "rth"} onChange={(session) => setBt({ session })} options={[{ v: "open" as const, l: "NY open" }, { v: "rth" as const, l: "RTH" }, { v: "all" as const, l: "All hours" }]} />
          </Field>

          <Field label="Direction">
            <Seg
              full
              size="sm"
              value={bt.side}
              onChange={(side) => setBt({ side })}
              options={[
                { v: "both" as const, l: "Both" },
                { v: "long" as const, l: "Longs" },
                { v: "short" as const, l: "Shorts" },
              ]}
            />
          </Field>

          {crypto ? (
            <Field label="Risk per trade" hint="Each trade is sized so the stop costs this much.">
              <Num value={bt.riskDollars} onChange={(riskDollars) => setBt({ riskDollars })} min={1} prefix="$" />
            </Field>
          ) : (
            sym && (
              <Field label="Size" hint={`${bt.micro ? sym.roots!.micro : sym.roots!.full} · $${bt.micro ? sym.pointValue!.micro : sym.pointValue!.full} a point per contract`}>
                <div className="flex gap-2">
                  <Num value={bt.contracts} onChange={(contracts) => setBt({ contracts: Math.round(contracts) })} min={1} max={50} suffix="contracts" />
                  <Seg
                    size="sm"
                    value={bt.micro ? 1 : 0}
                    onChange={(v) => setBt({ micro: v === 1 })}
                    options={[
                      { v: 1, l: "Micro" },
                      { v: 0, l: "Full" },
                    ]}
                  />
                </div>
              </Field>
            )
          )}

          <div className="grid grid-cols-3 gap-2">
            <Field label={crypto ? "Fees / trade" : "Comm. / RT"}>
              <Num value={bt.commission} onChange={(commission) => setBt({ commission })} min={0} step={0.01} prefix="$" />
            </Field>
            <Field label="Slippage">
              <Num value={bt.slippageTicks} onChange={(slippageTicks) => setBt({ slippageTicks })} min={0} max={20} suffix="tick" />
            </Field>
            <Field label="Max hold">
              <Num value={bt.maxHold} onChange={(maxHold) => setBt({ maxHold: Math.round(maxHold) })} min={2} max={2000} suffix="bars" />
            </Field>
          </div>

          <Field label="Filters" hint={has.fomc || has.vix ? undefined : "Add the free-data pack in Library to filter by FOMC days, early closes and VIX."}>
            <div className="space-y-1 rounded-[15px] bg-white/[0.03] px-3 py-2">
              <Toggle label="Skip FOMC days" on={bt.skipFomc} onChange={(skipFomc) => setBt({ skipFomc })} disabled={!has.fomc} />
              <Toggle label="Skip early-close days" on={bt.skipEarly} onChange={(skipEarly) => setBt({ skipEarly })} disabled={!has.early} />
              <div className="flex items-center justify-between gap-2 py-1">
                <span className={clsx("text-[13.5px]", has.vix ? "text-white/80" : "text-white/35")}>VIX (prior close)</span>
                <Seg
                  size="sm"
                  value={has.vix ? bt.vix : "any"}
                  onChange={(vix) => setBt({ vix })}
                  options={[
                    { v: "any" as const, l: "Any" },
                    { v: "low" as const, l: "<15", disabled: !has.vix },
                    { v: "mid" as const, l: "15–25", disabled: !has.vix },
                    { v: "high" as const, l: "25+", disabled: !has.vix },
                  ]}
                />
              </div>
            </div>
          </Field>
        </>
      )}

      <button
        onClick={onRun}
        disabled={running || !(sym || series)}
        className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-[16px] bg-gradient-to-b from-[#8EE3FF] to-[#3AB4F2] py-3.5 text-[15.5px] font-bold text-black shadow-[0_14px_34px_-12px_rgba(90,200,250,0.85)] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
      >
        {running && progress != null && <span className="absolute inset-y-0 left-0 bg-white/35 transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />}
        <Play className="relative h-4 w-4 fill-current" />
        <span className="relative">{running ? (progress != null ? `Testing… ${Math.round(progress * 100)}%` : "Loading history…") : runLabel}</span>
      </button>
    </Card>
  );
}
