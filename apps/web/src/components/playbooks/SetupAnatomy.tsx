"use client";
/* Browser-local reference images are kept at their native aspect ratio. */
/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useState } from "react";
import clsx from "clsx";
import { ArrowLeft, ArrowRight, ChevronDown, ImagePlus, Maximize2, Pause, Play, ScanLine } from "lucide-react";
import type { PlaybookStrategy } from "../Playbooks";
import type { Evidence } from "@/lib/playbookLibrary";
import { parseR } from "@/lib/futuresSpecs";

type Profile = {
  level: string;
  context: string;
  trigger: string;
  path: number[];
  kind: "break" | "reclaim" | "reversal" | "trend";
  zone?: string;
  levels?: { price: number; label: string }[];
};
const profiles: Record<string, Profile> = {
  orb: {
    level: "Opening range high",
    context: "Define the opening range",
    trigger: "Break, hold, then confirm",
    kind: "break",
    path: [
      47, 52, 48, 56, 50, 53, 49, 56, 54, 52, 58, 68, 76, 70, 65, 69, 79, 86,
      82, 93, 98, 106, 102, 114,
    ],
  },
  breakout: {
    level: "Range resistance",
    context: "A tight range forms",
    trigger: "Confirm the expansion",
    kind: "break",
    path: [
      47, 52, 48, 56, 50, 53, 49, 56, 54, 52, 58, 68, 76, 70, 65, 69, 79, 86,
      82, 93, 98, 106, 102, 114,
    ],
  },
  "support-resistance": {
    level: "Tested support",
    context: "Price returns to support",
    trigger: "Rejection, then confirmation",
    kind: "reversal",
    path: [
      96, 89, 94, 83, 78, 82, 70, 66, 61, 65, 58, 62, 72, 77, 70, 80, 85, 91,
      86, 96, 104, 99, 110, 116,
    ],
  },
  vwap: {
    level: "VWAP reference",
    context: "Price tests fair value",
    trigger: "Reclaim and hold VWAP",
    kind: "reclaim",
    path: [
      87, 78, 82, 72, 67, 71, 61, 56, 48, 45, 52, 61, 72, 76, 67, 72, 80, 87,
      83, 94, 100, 107, 103, 115,
    ],
  },
  "vwap-reclaim": {
    level: "VWAP reference",
    context: "Trade below VWAP",
    trigger: "Reclaim, retest, confirm",
    kind: "reclaim",
    path: [
      87, 78, 82, 72, 67, 71, 61, 56, 48, 45, 52, 61, 72, 76, 67, 72, 80, 87,
      83, 94, 100, 107, 103, 115,
    ],
  },
  "vwap-pullback": {
    level: "Rising VWAP",
    context: "An established uptrend",
    trigger: "Pullback holds VWAP",
    kind: "trend",
    path: [
      38, 45, 42, 53, 60, 57, 70, 81, 75, 69, 64, 70, 78, 86, 81, 91, 98, 94,
      105, 112, 106, 117, 122, 130,
    ],
  },
  "trend-following": {
    level: "Trend support",
    context: "Higher highs, higher lows",
    trigger: "Continuation after a pullback",
    kind: "trend",
    path: [
      38, 45, 42, 53, 60, 57, 70, 81, 75, 69, 64, 70, 78, 86, 81, 91, 98, 94,
      105, 112, 106, 117, 122, 130,
    ],
  },
  "mean-reversion": {
    level: "Lower range boundary",
    context: "Price extends from the mean",
    trigger: "Rejection back into the range",
    kind: "reversal",
    zone: "Mean / fair-value area",
    path: [
      99, 94, 96, 86, 77, 82, 70, 63, 58, 51, 43, 56, 64, 70, 66, 74, 79, 84,
      80, 91, 95, 101, 98, 104,
    ],
  },
  "failed-breakout": {
    level: "Range low",
    context: "Breakdown fails to hold",
    trigger: "Recover the broken level",
    kind: "reclaim",
    path: [
      81, 78, 84, 76, 80, 74, 69, 61, 49, 40, 46, 60, 71, 75, 67, 74, 82, 89,
      83, 96, 101, 109, 105, 116,
    ],
  },
  "liquidity-sweep": {
    level: "Prior swing low",
    context: "Liquidity below the low",
    trigger: "Sweep, reclaim, confirm",
    kind: "reclaim",
    path: [
      83, 77, 81, 72, 67, 74, 69, 63, 59, 37, 50, 62, 73, 78, 70, 79, 87, 82,
      96, 102, 98, 110, 106, 118,
    ],
  },
  "failed-auction": {
    level: "VAL · cheap",
    context: "Price is pushed to the cheap edge",
    trigger: "Auction fails, body closes back through",
    kind: "reclaim",
    levels: [
      { price: 88, label: "POC · fair value" },
      { price: 124, label: "VAH · expensive" },
    ],
    path: [
      85, 79, 84, 77, 72, 78, 69, 64, 53, 42, 49, 61, 73, 78, 71, 80, 86, 92,
      87, 98, 105, 100, 111, 118,
    ],
  },
  "order-blocks": {
    level: "Demand block",
    context: "Displacement leaves a zone",
    trigger: "Retest the demand block",
    kind: "trend",
    zone: "Demand zone",
    path: [
      40, 47, 43, 52, 60, 58, 78, 89, 81, 74, 65, 71, 79, 86, 80, 91, 99, 95,
      104, 112, 108, 119, 125, 133,
    ],
  },
  "ict-fvg": {
    level: "Imbalance midpoint",
    context: "Displacement creates an imbalance",
    trigger: "Retrace into the gap",
    kind: "trend",
    zone: "Fair value gap",
    path: [
      40, 47, 43, 52, 60, 58, 80, 92, 82, 75, 66, 72, 80, 87, 81, 92, 100, 96,
      106, 114, 109, 120, 126, 134,
    ],
  },
};

// Options playbooks reuse the price paths of the futures setup they are built on.
profiles["opt-vwap-double-break"] = { ...profiles.orb, level: "Opening range high, VWAP inside", context: "Range and VWAP line up", trigger: "Both breaks confirm" };
profiles["opt-orb-0dte"] = { ...profiles.orb, level: "Opening range high", context: "Let the first 15 minutes print", trigger: "Close outside the range" };
profiles["opt-trend-pullback-spread"] = { ...profiles["vwap-pullback"] };
profiles["opt-failed-break-reversal"] = { ...profiles["failed-breakout"], level: "Opening range low", context: "A break that fails", trigger: "Close back inside the range" };

const STAGE_META = [
  { name: "Context", hint: "Is this even my setup?", color: "#64D2FF" },
  { name: "Confirmation", hint: "What makes me click buy or sell?", color: "#30D158" },
  { name: "Invalidation", hint: "Where am I wrong?", color: "#FF453A" },
  { name: "Objective", hint: "Where do I get paid?", color: "#FFD60A" },
];
/** How long each stage holds while the walkthrough plays. */
const STAGE_MS = 4200;

const isTrigger = (r: string) =>
  /^enter|enter on|enter only|enter when|entry trigger|enter immediately/i.test(r);
const isFail = (r: string) =>
  /exit if|exit immediately|exit on|closes (back|fully|decisively)/i.test(r);

/** Build four stages with 2–3 concrete points each from the strategy rules. */
function buildStages(strategy: PlaybookStrategy, profile: Profile) {
  if (strategy.anatomy?.length === 4) return strategy.anatomy;
  const triggers = strategy.entryRules.filter(isTrigger);
  const context = strategy.entryRules.filter((r) => !isTrigger(r));
  const fails = strategy.exitRules.filter(isFail);
  const targets = strategy.exitRules.filter((r) => !isFail(r));
  return [
    { title: profile.context, points: context.slice(0, 3) },
    {
      title: profile.trigger,
      points: (triggers.length ? triggers : strategy.entryRules.slice(-2)).slice(0, 3),
    },
    {
      title: "Know exactly where the idea fails",
      points: [strategy.riskManagement[0], ...fails].filter(Boolean).slice(0, 3),
    },
    {
      title: "Plan the exit before the entry",
      points: (targets.length ? targets : strategy.exitRules).slice(0, 3),
    },
  ];
}

export function SetupAnatomy({
  strategy,
  screenshots,
  selectedImage,
  selectImage,
  addImage,
  openImage,
  ready,
}: {
  strategy: PlaybookStrategy;
  screenshots: Evidence[];
  selectedImage: string;
  selectImage: (id: string) => void;
  addImage: () => void;
  openImage: (image: Evidence) => void;
  ready: boolean;
}) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const profile = profiles[strategy.id] || profiles["support-resistance"];
  const reference = screenshots.find((s) => s.id === selectedImage);
  const stages = buildStages(strategy, profile);
  const meta = STAGE_META[step];
  const stage = stages[step];

  // The walkthrough advances itself, then rests on the last stage.
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      if (step >= 3) setPlaying(false);
      else setStep(step + 1);
    }, STAGE_MS);
    return () => clearTimeout(t);
  }, [playing, step]);

  const go = (i: number) => {
    setPlaying(false);
    setStep(Math.min(3, Math.max(0, i)));
  };
  const togglePlay = () => {
    if (!playing && step === 3) setStep(0);
    setPlaying(!playing);
  };

  return (
    <section
      id="anatomy"
      aria-label="Setup anatomy"
      className="scroll-mt-36 overflow-hidden rounded-3xl bg-tp-card shadow-lift ring-1 ring-inset ring-white/[0.07] [overflow-anchor:none]"
    >
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 p-5 sm:p-8 sm:pb-6">
        <div>
          <h2 className="text-[28px] font-bold leading-tight tracking-[-0.03em] text-white">Anatomy of the setup</h2>
          <p className="mt-1 text-[17px] text-zinc-400">Four decisions, in the order you make them.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-[11px] bg-tp-fill p-[3px]">
            <button
              aria-pressed={!reference}
              disabled={!ready}
              onClick={() => selectImage("")}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold",
                !reference
                  ? "bg-[#5B6478]/70 text-white shadow-[0_1px_3px_rgba(0,0,0,0.35),inset_0_0.5px_0_rgba(255,255,255,0.14)]"
                  : "text-zinc-400 hover:text-zinc-100",
              )}
            >
              <ScanLine className="h-4 w-4" />
              Illustrated
            </button>
            <label className="relative inline-flex items-center">
              <span className="sr-only">Your examples</span>
              <select
                aria-label="Anatomy example"
                disabled={!ready || !screenshots.length}
                value={reference?.id || ""}
                onChange={(e) => selectImage(e.target.value)}
                className={clsx(
                  "cursor-pointer appearance-none rounded-lg bg-transparent py-1.5 pl-3 pr-7 text-[13px] font-semibold focus:outline-none disabled:cursor-not-allowed",
                  reference ? "bg-[#5B6478]/70 text-white" : "text-zinc-400",
                )}
              >
                <option value="">{screenshots.length ? "My charts" : "My charts (none yet)"}</option>
                {screenshots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-zinc-500" />
            </label>
          </div>
          <button
            disabled={!ready}
            onClick={addImage}
            className="tp-press inline-flex items-center gap-2 rounded-full bg-tp-fill px-3.5 py-[7px] text-[13px] font-semibold text-zinc-100 hover:bg-white/[0.14] disabled:opacity-40"
          >
            <ImagePlus className="h-4 w-4" />
            Add your chart
          </button>
        </div>
      </header>

      {reference ? (
        <div className="grid gap-0 border-t border-white/[0.06] lg:grid-cols-[1.6fr_1fr]">
          <button
            className="group relative block bg-black/30"
            onClick={() => openImage(reference)}
            aria-label={`Enlarge ${reference.title}`}
          >
            <img src={reference.image} alt={reference.title} className="mx-auto max-h-[560px] w-auto" />
            <span className="tp-material-thin absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] text-zinc-100 opacity-0 transition-opacity group-hover:opacity-100">
              <Maximize2 className="h-3.5 w-3.5" />
              View full size
            </span>
          </button>
          <div className="border-t border-white/[0.06] p-6 lg:border-l lg:border-t-0">
            <h3 className="text-[20px] font-bold tracking-tight text-white">{reference.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-zinc-300">
              {reference.notes || "Add your observations in Workspace → Chart screenshots."}
            </p>
            <p className="mt-4 text-[13px] text-zinc-500">{reference.source || "Your chart"} · Saved on this device</p>
          </div>
        </div>
      ) : (
        <div
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") go(step + 1);
            if (e.key === "ArrowLeft") go(step - 1);
          }}
          className="focus:outline-none"
        >
          {/* Chart stage */}
          <div className="relative mx-3 overflow-hidden rounded-[22px] bg-tp-base/80 ring-1 ring-inset ring-white/[0.06] sm:mx-5">
            <AnatomyChart profile={profile} step={step} onStep={go} targetR={parseR(strategy.riskReward)} />
            <button
              onClick={togglePlay}
              aria-label={playing ? "Pause walkthrough" : "Play walkthrough"}
              className="tp-press tp-material-thin absolute left-4 top-4 inline-flex items-center gap-2 rounded-full py-2 pl-3 pr-4 text-[14px] font-semibold text-white ring-1 ring-inset ring-white/[0.1] hover:bg-white/[0.16]"
            >
              {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
              {playing ? "Pause" : step === 3 ? "Replay" : "Play the trade"}
            </button>
            <span className="absolute right-4 top-5 hidden text-[12px] text-zinc-500 sm:block">
              Schematic long, not to scale · shorts mirror it
            </span>
          </div>

          {/* Stage tabs: each carries its own progress bar */}
          <ol className="grid grid-cols-4 gap-2 px-3 pt-4 sm:gap-3 sm:px-5" aria-label="Setup stages">
            {stages.map((s, i) => {
              const m = STAGE_META[i];
              const active = step === i;
              const done = i < step;
              return (
                <li key={m.name} className="min-w-0">
                  <button
                    aria-pressed={active}
                    onClick={() => go(i)}
                    className={clsx(
                      "tp-press group w-full rounded-2xl px-3 pb-3 pt-2.5 text-left sm:px-4",
                      active ? "bg-white/[0.07]" : "hover:bg-white/[0.04]",
                    )}
                  >
                    <span className="block h-[3px] overflow-hidden rounded-full bg-white/[0.1]">
                      <span
                        key={`${i}-${step}-${playing}`}
                        className={clsx("block h-full rounded-full", active && playing && "tp-stage-fill")}
                        style={{
                          background: m.color,
                          width: done || (active && !playing) ? "100%" : active ? undefined : "0%",
                          animationDuration: `${STAGE_MS}ms`,
                        }}
                      />
                    </span>
                    <span className="mt-2.5 flex items-center gap-2">
                      <span
                        className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold tabular-nums"
                        style={
                          active || done
                            ? { background: m.color, color: "#0A0D14" }
                            : { background: "rgba(255,255,255,0.1)", color: "#A1A1AA" }
                        }
                      >
                        {i + 1}
                      </span>
                      <span className={clsx("truncate text-[14px] font-semibold", active ? "text-white" : "text-zinc-400 group-hover:text-zinc-200")}>
                        {m.name}
                      </span>
                    </span>
                    <span className="mt-1 hidden truncate text-[13px] text-zinc-500 md:block">{s.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>

          {/* The active decision */}
          <div key={step} className="tp-rise grid gap-6 p-5 sm:p-8 lg:min-h-[260px] lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">
            <div>
              <div className="text-[13px] font-semibold" style={{ color: meta.color }}>
                Decision {step + 1} of 4 · {meta.name}
              </div>
              <div className="mt-2 text-[30px] font-bold leading-[1.1] tracking-[-0.03em] text-white">{meta.hint}</div>
              <div className="mt-2 text-[17px] leading-snug text-zinc-400">{stage.title}</div>
              <div className="mt-6 flex items-center gap-2">
                <button
                  onClick={() => go(step - 1)}
                  disabled={step === 0}
                  aria-label="Previous decision"
                  className="tp-press grid h-10 w-10 place-items-center rounded-full bg-tp-fill text-zinc-200 hover:bg-white/[0.14] disabled:opacity-30"
                >
                  <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
                </button>
                <button
                  onClick={() => go(step + 1)}
                  disabled={step === 3}
                  className="tp-press inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-5 text-[15px] font-semibold text-black hover:bg-zinc-200 disabled:opacity-30"
                >
                  {step === 3 ? "That's the trade" : `Next: ${STAGE_META[step + 1].name}`}
                  {step < 3 && <ArrowRight className="h-4 w-4" strokeWidth={2.4} />}
                </button>
              </div>
            </div>
            <ul className="overflow-hidden rounded-2xl bg-white/[0.04]">
              {stage.points.map((p, i) => (
                <li key={p} className="relative flex gap-3.5 px-5 py-4 text-[16px] leading-relaxed text-zinc-200">
                  {i > 0 && <span className="absolute left-[3.25rem] right-0 top-0 h-px bg-white/[0.06]" aria-hidden />}
                  <span
                    className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold tabular-nums"
                    style={{ background: `${meta.color}26`, color: meta.color }}
                  >
                    {i + 1}
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

/** Candles revealed at each stage: you only ever see what you would have seen. */
const REVEAL = [11, 13, 17, 23];

function AnatomyChart({ profile, step, onStep, targetR }: { profile: Profile; step: number; onStep: (i: number) => void; targetR: number }) {
  const W = 920, H = 356;
  const y = (price: number) => 334 - price * 2.1;
  const x = (index: number) => 58 + index * 27;
  const level = profile.kind === "trend" ? 68 : 60;
  const entryIndex = 12;
  const entry = profile.path[entryIndex];
  const stop = profile.kind === "trend" ? 57 : profile.kind === "reversal" ? 44 : 35;
  const target = profile.path[23] - 5;
  // The label is the playbook's own target; the drawing is not to scale.
  const rr = `${targetR}R`;
  const colors = STAGE_META.map((m) => m.color);
  const reveal = REVEAL[step];
  const from = step ? REVEAL[step - 1] : 0;
  const ease = "cubic-bezier(0.32, 0.72, 0, 1)";
  const fade = (on: boolean, delay = 0): React.CSSProperties => ({
    opacity: on ? 1 : 0,
    transition: `opacity 0.5s ${ease} ${on ? delay : 0}ms`,
  });
  const zoneLeft = x(entryIndex) - 9;
  const zoneW = x(23) + 14 - zoneLeft;
  const markers = [
    { x: x(7), y: y(profile.path[7]) - 34 },
    { x: x(entryIndex), y: y(entry) - 30 },
    { x: x(15), y: y(stop) },
    { x: x(21), y: y(target) },
  ];
  const tags = [
    { price: target, label: "Target", sub: `+${rr}`, color: colors[3], stage: 3 },
    { price: entry, label: "Entry", sub: "Confirmed", color: colors[1], stage: 1 },
    { price: stop, label: "Stop", sub: "−1R", color: colors[2], stage: 2 },
  ];
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full"
      role="img"
      aria-label={`${profile.context}; ${profile.trigger}. Entry, invalidation and objective are illustrated.`}
    >
      <title>
        {profile.context} — {profile.trigger}
      </title>
      {[59, 118, 177, 236, 295].map((v) => (
        <line key={v} x1="0" x2={W} y1={v} y2={v} stroke="#fff" strokeOpacity=".04" />
      ))}

      {/* Opening range box for breakouts */}
      {profile.kind === "break" && (
        <rect x="44" y={y(59)} width="270" height={y(45) - y(59)} rx="6" fill={colors[0]} fillOpacity=".07" stroke={colors[0]} strokeOpacity=".25" />
      )}

      {/* The level the whole idea hangs on */}
      <rect
        x="0"
        y={y(level + 4)}
        width="716"
        height="18"
        fill={colors[0]}
        style={{ fillOpacity: step === 0 ? 0.16 : 0.05, transition: `fill-opacity 0.5s ${ease}` }}
      />
      <path
        d={profile.kind === "trend" ? `M0 ${y(42)} Q240 ${y(55)},716 ${y(96)}` : `M0 ${y(level)} H716`}
        fill="none"
        stroke={colors[0]}
        strokeWidth="1.5"
        strokeDasharray={profile.kind === "trend" ? "" : "5 5"}
        style={{ strokeOpacity: step === 0 ? 1 : 0.55, transition: `stroke-opacity 0.5s ${ease}` }}
      />
      <text x="20" y={y(level) - 16} fontSize="13" fontWeight="600" fill={colors[0]}>
        {profile.level}
      </text>
      {profile.zone && (
        <text x="20" y={y(level) + 34} fill={colors[0]} fillOpacity=".7" fontSize="12">
          {profile.zone}
        </text>
      )}
      {profile.levels?.map((l) => (
        <g key={l.label} opacity=".8">
          <line x1="0" x2="716" y1={y(l.price)} y2={y(l.price)} stroke="#fff" strokeOpacity=".35" strokeDasharray="2 6" />
          <text x="20" y={y(l.price) - 8} fontSize="12" fill="#fff" fillOpacity=".6">
            {l.label}
          </text>
        </g>
      ))}

      {/* Reward and risk, sized against each other */}
      <g style={fade(step >= 3, 250)}>
        <rect x={zoneLeft} y={y(target)} width={zoneW} height={y(entry) - y(target)} rx="6" fill={colors[3]} fillOpacity=".1" />
        <text x={zoneLeft + 14} y={y(target) + 32} fontSize="24" fontWeight="700" fill={colors[3]} style={{ fontFamily: "ui-rounded, 'SF Pro Rounded', system-ui" }}>
          +{rr}
        </text>
      </g>
      <g style={fade(step >= 2, 200)}>
        <rect x={zoneLeft} y={y(entry)} width={zoneW} height={y(stop) - y(entry)} rx="6" fill={colors[2]} fillOpacity={step === 2 ? ".16" : ".08"} />
        <text x={zoneLeft + zoneW - 12} y={y(stop) - 10} textAnchor="end" fontSize="15" fontWeight="700" fill={colors[2]} style={{ fontFamily: "ui-rounded, 'SF Pro Rounded', system-ui" }}>
          −1R
        </text>
      </g>

      {/* Candles: the future stays a ghost until its stage */}
      {profile.path.map((close, i) => {
        const open = i ? profile.path[i - 1] : close - 3;
        const up = close >= open;
        const shown = i <= reveal;
        const fill = up ? "#30D158" : "#8E94A3";
        return (
          <g
            key={i}
            style={{
              opacity: shown ? 1 : 0.07,
              transition: `opacity 0.45s ${ease} ${shown ? Math.max(0, i - from) * 55 : 0}ms`,
            }}
          >
            <line
              x1={x(i)}
              x2={x(i)}
              y1={y(Math.max(open, close) + 3 + (i % 3))}
              y2={y(Math.min(open, close) - 3 - (i % 2))}
              stroke={fill}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <rect x={x(i) - 6} width="12" y={y(Math.max(open, close))} height={Math.max(2.5, Math.abs(close - open) * 2.1)} rx="2.5" fill={fill} />
          </g>
        );
      })}

      {/* Price tags */}
      {tags.map((t) => {
        const active = step === t.stage;
        return (
          <g key={t.label} style={fade(step >= t.stage, 300)}>
            <line
              x1={zoneLeft}
              x2="736"
              y1={y(t.price)}
              y2={y(t.price)}
              stroke={t.color}
              strokeOpacity={active ? 1 : 0.55}
              strokeWidth={active ? 2 : 1.25}
              strokeDasharray={active ? "" : "4 4"}
            />
            <rect x="736" y={y(t.price) - 15} width="166" height="30" rx="15" fill={active ? t.color : "rgb(var(--tp-raised))"} />
            <text x="752" y={y(t.price) + 4.5} fontSize="13" fontWeight="700" fill={active ? "#0A0D14" : t.color}>
              {t.label}
            </text>
            <text x="888" y={y(t.price) + 4.5} fontSize="12" fontWeight="600" textAnchor="end" fill={active ? "#0A0D14" : "#98A1B3"} fillOpacity={active ? 0.7 : 1}>
              {t.sub}
            </text>
          </g>
        );
      })}

      {/* Numbered decisions, tappable on the chart itself */}
      {markers.map((m, i) => {
        const active = step === i;
        return (
          <g key={i} style={{ ...fade(step >= i, 350), cursor: "pointer" }} onClick={() => onStep(i)}>
            {active && <circle cx={m.x} cy={m.y} r="15" fill={colors[i]} className="tp-flow-pulse" />}
            <circle cx={m.x} cy={m.y} r={active ? 15 : 11} fill={active ? colors[i] : "rgb(var(--tp-panel))"} stroke={colors[i]} strokeWidth="1.75" style={{ transition: `r 0.4s ${ease}` }} />
            <text x={m.x} y={m.y + 4.5} textAnchor="middle" fill={active ? "#0A0D14" : colors[i]} fontSize="13" fontWeight="700">
              {i + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
