"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight, Pause, Play } from "lucide-react";
import {
  ENTRY_INDEX,
  exampleCandles,
  outcomeOf,
  parseExampleTrade,
  type ExampleText,
  type ExampleTrade,
} from "@/lib/exampleTrade";

// Same four colours as the anatomy above: context, entry, stop, target.
const C = { context: "#64D2FF", entry: "#30D158", stop: "#FF453A", target: "#FFD60A" };
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const BEAT_MS = 2600;

const BEATS = [
  { key: "setup", label: "Setup", hint: "What was on the chart", color: C.context },
  { key: "entry", label: "Entry", hint: "Where the order went in", color: C.entry },
  { key: "exit", label: "Exit", hint: "How it was managed", color: C.target },
] as const;

function formatters(t: ExampleTrade) {
  const price = (n: number) =>
    `${t.unit === "$" ? "$" : ""}${n.toLocaleString("en-US", { minimumFractionDigits: t.decimals, maximumFractionDigits: t.decimals })}`;
  const dist = (n: number) => {
    const d = Math.abs(n) * t.unitFactor;
    if (t.unit === "$") return `$${d.toFixed(2)}`;
    return `${d.toLocaleString("en-US", { maximumFractionDigits: t.unit === "pips" ? 0 : Math.min(2, t.decimals) })} ${t.unit}`;
  };
  return { price, dist };
}

const rLabel = (r: number) => `${r.toFixed(Math.abs(r) >= 10 || Number.isInteger(+r.toFixed(1)) ? 0 : 1)}R`;

/** The example drawn to scale: its real entry, stop and target, with a plausible path between them. */
function ReplayChart({ trade, beat, onBeat }: { trade: ExampleTrade; beat: number; onBeat: (i: number) => void }) {
  const W = 760, H = 360;
  const candles = useMemo(() => exampleCandles(trade), [trade]);
  const { price, dist } = formatters(trade);
  const svg = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const last = candles.length - 1;
  const left = 38, right = 548, top = 34, bottom = H - 34;
  const step = (right - left) / last;
  const x = (i: number) => left + i * step;
  const prices = [trade.stop, trade.target, ...candles.flatMap((c) => [c.high, c.low])];
  const span = Math.max(...prices) - Math.min(...prices);
  const hi = Math.max(...prices) + span * 0.08;
  const lo = Math.min(...prices) - span * 0.08;
  const y = (p: number) => top + ((hi - p) / (hi - lo)) * (bottom - top);
  const priceAt = (py: number) => hi - ((py - top) / (bottom - top)) * (hi - lo);

  const dir = trade.direction === "long" ? 1 : -1;
  const lost = trade.outcome === "loss";
  const reveal = [ENTRY_INDEX - 1, ENTRY_INDEX + 1, last][beat];
  const from = beat ? [ENTRY_INDEX - 1, ENTRY_INDEX + 1][beat - 1] : 0;
  const fade = (on: boolean, delay = 0): React.CSSProperties => ({
    opacity: on ? 1 : 0,
    transition: `opacity 0.5s ${EASE} ${on ? delay : 0}ms`,
  });

  const zoneLeft = x(ENTRY_INDEX) - step * 0.45;
  const zoneW = right + 12 - zoneLeft;
  const tags = [
    { p: trade.target, label: trade.targetAssumed ? "Target*" : "Target", color: C.target, since: 2, sub: `+${dist(trade.reward)}` },
    { p: trade.entry, label: "Entry", color: C.entry, since: 1, sub: trade.direction === "long" ? "Long" : "Short" },
    { p: trade.stop, label: "Stop", color: C.stop, since: 1, sub: `−${dist(trade.risk)}` },
  ];
  const mark = (i: number, above: boolean) => ({
    x: x(i),
    y: above ? y(candles[i].high) - 22 : y(candles[i].low) + 22,
  });
  // Numbers sit on the far side of price from where it is heading, clear of the candles.
  const markers = [mark(7, dir === 1), mark(ENTRY_INDEX, dir !== 1), mark(last, lost ? dir !== 1 : dir === 1)];

  const hoverR = hover !== null ? ((priceAt(hover) - trade.entry) * dir) / trade.risk : 0;

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full touch-none select-none"
      role="img"
      aria-label={`${trade.direction === "long" ? "Long" : "Short"} from ${price(trade.entry)}, stop ${price(trade.stop)}, target ${price(trade.target)}: ${rLabel(trade.r)} of reward for 1R of risk.`}
      onMouseMove={(e) => {
        const box = svg.current?.getBoundingClientRect();
        if (!box) return;
        const py = ((e.clientY - box.top) / box.height) * H;
        const px = ((e.clientX - box.left) / box.width) * W;
        setHover(py >= top && py <= bottom && px <= right + 12 ? py : null);
      }}
      onMouseLeave={() => setHover(null)}
    >
      {[0.2, 0.4, 0.6, 0.8].map((f) => (
        <line key={f} x1="0" x2={W} y1={top + f * (bottom - top)} y2={top + f * (bottom - top)} stroke="#fff" strokeOpacity=".035" />
      ))}

      {/* Before the entry there is only a level price is working toward */}
      <g style={{ opacity: beat === 0 ? 1 : 0.5, transition: `opacity 0.5s ${EASE}` }}>
        <line x1="0" x2={zoneLeft} y1={y(trade.entry)} y2={y(trade.entry)} stroke={C.context} strokeWidth="1.5" strokeDasharray="5 5" strokeOpacity=".8" />
        <rect x="0" y={y(trade.entry) - 9} width={zoneLeft} height="18" fill={C.context} style={{ fillOpacity: beat === 0 ? 0.14 : 0.04, transition: `fill-opacity 0.5s ${EASE}` }} />
        <text x="16" y={y(trade.entry) + (dir === 1 ? 30 : -18)} fontSize="12.5" fontWeight="600" fill={C.context}>
          The level in play
        </text>
      </g>

      {/* Reward and risk, at their true proportions */}
      <g style={fade(beat >= 2, 150)}>
        <rect x={zoneLeft} y={Math.min(y(trade.target), y(trade.entry))} width={zoneW} height={Math.abs(y(trade.entry) - y(trade.target))} rx="6" fill={C.target} fillOpacity=".09" />
        <text
          x={zoneLeft + 12}
          y={dir === 1 ? y(trade.target) + 30 : y(trade.target) - 12}
          fontSize="24"
          fontWeight="700"
          fill={C.target}
          style={{ fontFamily: "ui-rounded, 'SF Pro Rounded', system-ui" }}
        >
          +{rLabel(trade.r)}
        </text>
      </g>
      <g style={fade(beat >= 1, 150)}>
        <rect x={zoneLeft} y={Math.min(y(trade.stop), y(trade.entry))} width={zoneW} height={Math.abs(y(trade.stop) - y(trade.entry))} rx="6" fill={C.stop} fillOpacity={beat === 1 ? ".15" : ".08"} style={{ transition: `fill-opacity 0.5s ${EASE}` }} />
        <text
          x={zoneLeft + zoneW - 12}
          y={dir === 1 ? y(trade.stop) - 9 : y(trade.stop) + 20}
          textAnchor="end"
          fontSize="14"
          fontWeight="700"
          fill={C.stop}
          style={{ fontFamily: "ui-rounded, 'SF Pro Rounded', system-ui" }}
        >
          −1R
        </text>
      </g>

      {/* Candles: what has not happened yet stays a ghost */}
      {candles.map((c, i) => {
        const up = c.close >= c.open;
        const shown = i <= reveal;
        const fill = up ? "#30D158" : "#8E94A3";
        const bodyTop = y(Math.max(c.open, c.close));
        return (
          <g key={i} style={{ opacity: shown ? 1 : 0.07, transition: `opacity 0.45s ${EASE} ${shown ? Math.max(0, i - from) * 60 : 0}ms` }}>
            <line x1={x(i)} x2={x(i)} y1={y(c.high)} y2={y(c.low)} stroke={fill} strokeWidth="1.5" strokeLinecap="round" />
            <rect x={x(i) - step * 0.3} width={step * 0.6} y={bodyTop} height={Math.max(2.5, y(Math.min(c.open, c.close)) - bodyTop)} rx="2.5" fill={fill} />
          </g>
        );
      })}

      {/* The three prices the example names */}
      {tags.map((t) => {
        const active = (t.label === "Entry" && beat === 1) || (t.label.startsWith("Target") && beat === 2 && !lost) || (t.label === "Stop" && beat === 2 && lost);
        return (
          <g key={t.label} style={fade(beat >= t.since, 250)}>
            <line x1={zoneLeft} x2="572" y1={y(t.p)} y2={y(t.p)} stroke={t.color} strokeOpacity={active ? 1 : 0.55} strokeWidth={active ? 2 : 1.25} strokeDasharray={active ? "" : "4 4"} />
            <rect x="572" y={y(t.p) - 15} width="176" height="30" rx="15" fill={active ? t.color : "rgb(var(--tp-raised))"} />
            <text x="587" y={y(t.p) + 4.5} fontSize="13" fontWeight="700" fill={active ? "#0A0D14" : t.color}>
              {t.label}
            </text>
            <text x="735" y={y(t.p) + 4.5} fontSize="13" fontWeight="600" textAnchor="end" fill={active ? "#0A0D14" : "#E6E9F0"} style={{ fontVariantNumeric: "tabular-nums" }}>
              {price(t.p)}
            </text>
          </g>
        );
      })}

      {/* Read any price off the chart as a multiple of the risk */}
      {hover !== null && (
        <g pointerEvents="none">
          <line x1="0" x2={right + 12} y1={hover} y2={hover} stroke="#fff" strokeOpacity=".45" strokeDasharray="2 4" />
          <rect x="6" y={hover - 13} width="150" height="26" rx="13" fill="#F2F4F8" />
          <text x="18" y={hover + 4.5} fontSize="12.5" fontWeight="700" fill="#0A0D14" style={{ fontVariantNumeric: "tabular-nums" }}>
            {price(priceAt(hover))}
          </text>
          <text x="144" y={hover + 4.5} fontSize="12.5" fontWeight="700" textAnchor="end" fill={hoverR >= 0 ? "#1B7F3A" : "#C2271D"} style={{ fontVariantNumeric: "tabular-nums" }}>
            {hoverR >= 0 ? "+" : "−"}
            {Math.abs(hoverR).toFixed(1)}R
          </text>
        </g>
      )}

      {/* The three beats, tappable on the chart */}
      {markers.map((m, i) => {
        const active = beat === i;
        const color = i === 2 && lost ? C.stop : BEATS[i].color;
        return (
          <g key={i} style={{ ...fade(beat >= i, 300), cursor: "pointer" }} onClick={() => onBeat(i)}>
            {active && <circle cx={m.x} cy={m.y} r="14" fill={color} className="tp-flow-pulse" />}
            <circle cx={m.x} cy={m.y} r={active ? 14 : 10.5} fill={active ? color : "rgb(var(--tp-panel))"} stroke={color} strokeWidth="1.75" style={{ transition: `r 0.4s ${EASE}` }} />
            <text x={m.x} y={m.y + 4.5} textAnchor="middle" fill={active ? "#0A0D14" : color} fontSize="12.5" fontWeight="700">
              {i + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: React.ReactNode; sub?: React.ReactNode; color?: string }) {
  return (
    <div className="min-w-0 bg-tp-card px-4 py-3.5 sm:px-5">
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
        {color && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
        {label}
      </dt>
      <dd className="mt-1 truncate text-[20px] font-bold leading-tight tracking-tight tabular-nums text-white">{value}</dd>
      {sub && <dd className="mt-0.5 truncate text-[12px] tabular-nums text-zinc-500">{sub}</dd>}
    </div>
  );
}

/** One worked example: a to-scale replay when its prices can be read, a three-beat storyboard when they cannot. */
export function WorkedExample({ example, index, targetR }: { example: ExampleText; index: number; targetR: number }) {
  const trade = useMemo(() => parseExampleTrade(example, targetR), [example, targetR]);
  // An example opens finished, so the whole trade is readable before anything moves.
  const [beat, setBeat] = useState(2);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      if (beat >= 2) setPlaying(false);
      else setBeat(beat + 1);
    }, BEAT_MS);
    return () => clearTimeout(t);
  }, [playing, beat]);

  const go = (i: number) => {
    setPlaying(false);
    setBeat(i);
  };
  const togglePlay = () => {
    if (!playing) setBeat(0);
    setPlaying(!playing);
  };

  const outcome = trade?.outcome ?? outcomeOf(example.result);
  const text = [example.setup, example.entry, example.exit];
  const fmt = trade ? formatters(trade) : null;
  const Side = trade?.direction === "short" ? ArrowDownRight : ArrowUpRight;

  return (
    <article className="pt-8 first:pt-0">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-start gap-4">
          <span className="mt-1 font-mono text-[13px] font-semibold tracking-[0.18em] text-zinc-500">{String(index + 1).padStart(2, "0")}</span>
          <div className="min-w-0">
            <h3 className="text-[22px] font-bold leading-tight tracking-[-0.03em] text-white">{example.title}</h3>
            <p className="mt-1 text-[15px] leading-snug text-zinc-400">{example.description}</p>
          </div>
        </div>
        {trade && (
          <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold">
            {trade.symbol && <span className="rounded-full bg-tp-fill px-2.5 py-1 text-zinc-200">{trade.symbol}</span>}
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1"
              style={{ background: `${trade.direction === "long" ? C.entry : C.stop}22`, color: trade.direction === "long" ? C.entry : C.stop }}
            >
              <Side className="h-3.5 w-3.5" strokeWidth={2.6} />
              {trade.direction === "long" ? "Long" : "Short"}
            </span>
          </div>
        )}
      </header>

      <div className={clsx("mt-5 grid gap-5", trade ? "lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]" : "")}>
        {trade && (
          <figure className="min-w-0">
            <div className="relative overflow-hidden rounded-[22px] bg-tp-base/80 ring-1 ring-inset ring-white/[0.06]">
              <ReplayChart trade={trade} beat={beat} onBeat={go} />
              <button
                onClick={togglePlay}
                aria-label={playing ? "Pause the replay" : "Replay this trade"}
                className="tp-press tp-material-thin absolute left-3.5 top-3.5 inline-flex items-center gap-2 rounded-full py-1.5 pl-2.5 pr-3.5 text-[13px] font-semibold text-white ring-1 ring-inset ring-white/[0.1] hover:bg-white/[0.14]"
              >
                {playing ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                {playing ? "Pause" : "Replay"}
              </button>
            </div>
            <figcaption className="mt-2.5 px-1 text-[12px] leading-relaxed text-zinc-500">
              Entry, stop and target are the example’s own prices, drawn to scale. The candles between them are an illustration, not the historical tape.
              {trade.targetAssumed && ` *No target price is given, so it is placed at the playbook’s ${rLabel(targetR)}.`}
            </figcaption>
          </figure>
        )}

        {/* The three beats, in the playbook's own words */}
        <ol className={clsx("min-w-0", trade ? "flex flex-col gap-2" : "grid gap-3 md:grid-cols-3")}>
          {BEATS.map((b, i) => {
            const active = !!trade && beat === i;
            const color = i === 2 && outcome === "loss" ? C.stop : b.color;
            const body = (
              <>
                <span className="flex items-center gap-2.5">
                  <span
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold"
                    style={active || !trade ? { background: color, color: "#0A0D14" } : { boxShadow: `inset 0 0 0 1.5px ${color}`, color }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-[15px] font-bold tracking-tight text-white">{b.label}</span>
                  <span className="truncate text-[12px] text-zinc-500">{b.hint}</span>
                </span>
                <span className="mt-2 block text-[15px] leading-relaxed text-zinc-300">{text[i]}</span>
                {active && playing && (
                  <span className="mt-3 block h-0.5 overflow-hidden rounded-full bg-white/[0.08]">
                    <span key={`${i}-${playing}`} className="tp-stage-fill block h-full rounded-full" style={{ background: color, animationDuration: `${BEAT_MS}ms` }} />
                  </span>
                )}
              </>
            );
            return (
              <li key={b.key} className="min-w-0">
                {trade ? (
                  <button
                    type="button"
                    onClick={() => go(i)}
                    aria-current={active ? "step" : undefined}
                    className={clsx(
                      "tp-press block w-full rounded-2xl p-4 text-left ring-1 ring-inset",
                      active ? "bg-white/[0.07] ring-white/[0.12]" : "ring-transparent hover:bg-white/[0.04]",
                    )}
                  >
                    {body}
                  </button>
                ) : (
                  <div className="h-full rounded-2xl bg-tp-base/60 p-5 ring-1 ring-inset ring-white/[0.06]">{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* What it paid, and what it risked to get there */}
      <dl className={clsx("mt-5 grid gap-px overflow-hidden rounded-2xl bg-white/[0.07] ring-1 ring-inset ring-white/[0.07]", trade ? "grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.7fr]" : "grid-cols-1")}>
        {trade && fmt && (
          <>
            <Stat label="Risk" color={C.stop} value={fmt.dist(trade.risk)} sub={`${fmt.price(trade.entry)} → ${fmt.price(trade.stop)}`} />
            <Stat label="Reward" color={C.target} value={fmt.dist(trade.reward)} sub={`${fmt.price(trade.entry)} → ${fmt.price(trade.target)}`} />
            <Stat label="Reward to risk" value={`${trade.r.toFixed(1)} : 1`} sub="from these prices" />
          </>
        )}
        <div className={clsx("min-w-0 bg-tp-card px-4 py-3.5 sm:px-5", trade && "col-span-2 lg:col-span-1")}>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
            {outcome === "win" ? "Result" : outcome === "loss" ? "Result · a loser" : "Result · as planned"}
          </dt>
          <dd className={clsx("mt-1 text-[16px] font-semibold leading-snug tracking-tight", outcome === "win" ? "text-tp-green" : outcome === "loss" ? "text-tp-red" : "text-zinc-100")}>
            {example.result}
          </dd>
        </div>
      </dl>
    </article>
  );
}
