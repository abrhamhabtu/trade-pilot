"use client";
/* Browser-local reference images are kept at their native aspect ratio. */
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import clsx from "clsx";
import { ArrowRight, ChevronDown, ImagePlus, Maximize2, ScanLine } from "lucide-react";
import type { PlaybookStrategy } from "../Playbooks";
import type { Evidence } from "@/lib/playbookLibrary";

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

const STAGE_META = [
  { name: "Context", hint: "Is this even my setup?", color: "#91bdf1" },
  { name: "Confirmation", hint: "What makes me click buy/sell", color: "#00D68F" },
  { name: "Invalidation", hint: "Where I'm wrong — the stop", color: "#FF4868" },
  { name: "Objective", hint: "Where I get paid — the target", color: "#c9c2f7" },
];

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
  const profile = profiles[strategy.id] || profiles["support-resistance"];
  const reference = screenshots.find((s) => s.id === selectedImage);
  const stages = buildStages(strategy, profile);

  return (
    <section
      id="anatomy"
      aria-label="Setup anatomy"
      className="scroll-mt-36 overflow-hidden rounded-2xl border border-white/[0.06] bg-tp-card"
    >
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.06] p-5 sm:p-7">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-tp-green">The visual playbook</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-[28px]">Anatomy of the setup</h2>
          <p className="mt-1 text-[15px] text-zinc-400">Four decisions, in order. Click a step to see it on the chart.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-black/25 p-1 ring-1 ring-inset ring-white/[0.07]">
            <button
              aria-pressed={!reference}
              disabled={!ready}
              onClick={() => selectImage("")}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium",
                !reference ? "bg-white/[0.09] text-zinc-50" : "text-zinc-400 hover:text-zinc-100",
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
                  "cursor-pointer appearance-none rounded-lg bg-transparent py-1.5 pl-3 pr-7 text-sm font-medium focus:outline-none disabled:cursor-not-allowed",
                  reference ? "bg-white/[0.09] text-zinc-50" : "text-zinc-400",
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
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.04] px-3.5 py-2 text-sm font-medium text-zinc-100 hover:bg-white/[0.08] disabled:opacity-40"
          >
            <ImagePlus className="h-4 w-4" />
            Add your chart
          </button>
        </div>
      </header>

      {reference ? (
        <div className="grid gap-0 lg:grid-cols-[1.6fr_1fr]">
          <button
            className="group relative block bg-black/30"
            onClick={() => openImage(reference)}
            aria-label={`Enlarge ${reference.title}`}
          >
            <img src={reference.image} alt={reference.title} className="mx-auto max-h-[560px] w-auto" />
            <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1.5 text-xs text-zinc-100 opacity-0 transition-opacity group-hover:opacity-100">
              <Maximize2 className="h-3.5 w-3.5" />
              View full size
            </span>
          </button>
          <div className="border-t border-white/[0.06] p-6 lg:border-l lg:border-t-0">
            <h3 className="text-lg font-semibold text-zinc-50">{reference.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-zinc-300">
              {reference.notes || "Add your observations in Workspace → Chart screenshots."}
            </p>
            <p className="mt-4 text-xs text-zinc-500">{reference.source || "Your chart"} · Saved on this device</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-0 2xl:grid-cols-[1.55fr_1fr]">
          {/* Chart */}
          <div className="border-b border-white/[0.06] bg-[#101c2c] 2xl:border-b-0 2xl:border-r">
            <AnatomyChart profile={profile} step={step} />
            <p className="px-5 pb-4 text-xs text-zinc-500">
              Schematic long example, not a historical trade. Shorts are the mirror image.
            </p>
          </div>

          {/* Stepper */}
          <ol className="grid gap-2 p-4 sm:p-5 md:grid-cols-2 2xl:flex 2xl:flex-col" aria-label="Setup stages">
            {stages.map((s, i) => {
              const meta = STAGE_META[i];
              const active = step === i;
              return (
                <li key={meta.name}>
                  <button
                    aria-pressed={active}
                    onClick={() => setStep(i)}
                    className={clsx(
                      "w-full rounded-xl border p-4 text-left transition-colors",
                      active ? "border-white/[0.14] bg-white/[0.04]" : "border-transparent hover:bg-white/[0.025]",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold"
                        style={
                          active
                            ? { background: meta.color, color: "#0D1628" }
                            : { boxShadow: `inset 0 0 0 1.5px ${meta.color}`, color: meta.color }
                        }
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: meta.color }}>
                          {meta.name}
                          <span className="ml-2 font-normal normal-case tracking-normal text-zinc-500">{meta.hint}</span>
                        </div>
                        <div className="text-base font-semibold text-zinc-50">{s.title}</div>
                      </div>
                    </div>
                    {active && (
                      <ul className="mt-3 space-y-2 pl-11">
                        {s.points.map((p) => (
                          <li key={p} className="flex gap-2 text-[15px] leading-relaxed text-zinc-300">
                            <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: meta.color }} />
                            {p}
                          </li>
                        ))}
                      </ul>
                    )}
                  </button>
                </li>
              );
            })}
            <div className="mt-auto flex items-center justify-between gap-2 px-1 pt-2 md:col-span-2">
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100 disabled:opacity-30"
              >
                ← Back
              </button>
              <span className="text-xs tabular-nums text-zinc-500">Step {step + 1} of 4</span>
              <button
                onClick={() => setStep((s) => Math.min(3, s + 1))}
                disabled={step === 3}
                className="inline-flex items-center gap-1 rounded-lg bg-white/[0.06] px-3 py-1.5 text-sm font-medium text-zinc-100 hover:bg-white/[0.1] disabled:opacity-30"
              >
                Next <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </ol>
        </div>
      )}
    </section>
  );
}

function AnatomyChart({ profile, step }: { profile: Profile; step: number }) {
  const y = (price: number) => 370 - price * 2.1;
  const x = (index: number) => 65 + index * 27;
  const level = profile.kind === "trend" ? 68 : 60;
  const entryIndex = 12;
  const entry = profile.path[entryIndex];
  const stop =
    profile.kind === "trend" ? 57 : profile.kind === "reversal" ? 44 : 35;
  const target = profile.path[23] - 5;
  const colors = ["#91bdf1", "#b8e6d5", "#e6a2a8", "#c9c2f7"];
  const markers = [
    { x: x(7), y: y(profile.path[7]) - 34 },
    { x: x(entryIndex), y: y(entry) - 27 },
    { x: x(16), y: y(stop) },
    { x: x(22), y: y(target) },
  ];
  return (
    <svg
      viewBox="0 0 920 410"
      className="block h-auto w-full"
      role="img"
      aria-label={`${profile.context}; ${profile.trigger}. Entry, invalidation and objective are illustrated.`}
    >
      <title>
        {profile.context} — {profile.trigger}
      </title>
      <rect width="920" height="410" fill="#101c2c" />
      {[85, 140, 195, 250, 305, 360].map((v) => (
        <line
          key={v}
          x1="35"
          x2="882"
          y1={v}
          y2={v}
          stroke="#a9bad2"
          strokeOpacity=".065"
        />
      ))}
      {[90, 225, 360, 495, 630, 765].map((v) => (
        <line
          key={v}
          x1={v}
          x2={v}
          y1="50"
          y2="365"
          stroke="#a9bad2"
          strokeOpacity=".05"
        />
      ))}
      <text x="35" y="29" fill="#b6c3d6" fontSize="12" letterSpacing="2">
        PRICE ACTION / EXECUTION MAP
      </text>
      <text x="883" y="29" textAnchor="end" fill="#8294aa" fontSize="12">
        CONCEPTUAL · NOT TO SCALE
      </text>
      {profile.kind === "break" && (
        <rect
          x="48"
          y={y(59)}
          width="265"
          height={y(45) - y(59)}
          fill="#91bdf1"
          fillOpacity=".08"
          stroke="#91bdf1"
          strokeOpacity=".2"
        />
      )}
      <rect
        x="42"
        y={y(level + 4)}
        width="658"
        height="19"
        fill="#91bdf1"
        fillOpacity={step === 0 ? ".14" : ".06"}
      />
      <path
        d={
          profile.kind === "trend"
            ? `M42 ${y(44)} Q240 ${y(55)},700 ${y(95)}`
            : `M42 ${y(level)} H700`
        }
        fill="none"
        stroke="#91bdf1"
        strokeWidth="1.5"
        strokeDasharray={profile.kind === "trend" ? "" : "5 5"}
      />
      {profile.zone && (
        <text x="50" y={y(level) + 34} fill="#8cadd6" fontSize="13">
          {profile.zone}
        </text>
      )}
      <rect
        x={x(entryIndex) - 9}
        y={y(target)}
        width="294"
        height={y(entry) - y(target)}
        fill="#b8e6d5"
        fillOpacity={step === 3 ? ".13" : ".055"}
      />
      <rect
        x={x(entryIndex) - 9}
        y={y(entry)}
        width="294"
        height={y(stop) - y(entry)}
        fill="#e6a2a8"
        fillOpacity={step === 2 ? ".13" : ".055"}
      />
      {profile.path.map((close, i) => {
        const open = i ? profile.path[i - 1] : close - 3;
        const up = close >= open;
        return (
          <g key={i} opacity={step === 0 && i > 11 ? ".4" : "1"}>
            <line
              x1={x(i)}
              x2={x(i)}
              y1={y(Math.max(open, close) + 3 + (i % 3))}
              y2={y(Math.min(open, close) - 3 - (i % 2))}
              stroke={up ? "#b5ddce" : "#ad8191"}
              strokeWidth="1.3"
            />
            <rect
              x={x(i) - 5}
              width="10"
              y={y(Math.max(open, close))}
              height={Math.max(2, Math.abs(close - open) * 2.1)}
              rx="1"
              fill={up ? "#b5ddce" : "#ad8191"}
            />
          </g>
        );
      })}
      {[
        {
          price: target,
          label: "Planned objective",
          color: colors[3],
          active: step === 3,
        },
        {
          price: entry,
          label: "Confirmed entry",
          color: colors[1],
          active: step === 1,
        },
        {
          price: stop,
          label: "Invalidation",
          color: colors[2],
          active: step === 2,
        },
      ].map((line) => (
        <g key={line.label}>
          <line
            x1={x(entryIndex) - 9}
            x2="722"
            y1={y(line.price)}
            y2={y(line.price)}
            stroke={line.color}
            strokeOpacity={line.active ? 1 : 0.5}
            strokeWidth={line.active ? 2 : 1}
            strokeDasharray="4 4"
          />
          <rect
            x="726"
            y={y(line.price) - 14}
            width="176"
            height="28"
            rx="5"
            fill={line.active ? line.color : "#192a3f"}
          />
          <text
            x="738"
            y={y(line.price) + 4}
            fontSize="13"
            fill={line.active ? "#111e2d" : line.color}
          >
            {line.label}
          </text>
        </g>
      ))}
      {profile.levels?.map((l) => (
        <g key={l.label}>
          <line
            x1="42"
            x2="700"
            y1={y(l.price)}
            y2={y(l.price)}
            stroke={l.label.startsWith("POC") ? "#FFB800" : "#91bdf1"}
            strokeOpacity=".7"
            strokeDasharray="6 5"
          />
          <text
            x="52"
            y={y(l.price) - 8}
            fontSize="13"
            fill={l.label.startsWith("POC") ? "#FFB800" : "#91bdf1"}
          >
            {l.label}
          </text>
        </g>
      ))}
      <text x="52" y={y(level) - 17} fontSize="13" fill="#91bdf1">
        {profile.level}
      </text>
      {markers.map((m, i) => (
        <g key={i}>
          <circle
            cx={m.x}
            cy={m.y}
            r={step === i ? 17 : 13}
            fill={step === i ? colors[i] : "#14263b"}
            stroke={colors[i]}
            strokeWidth="1.5"
          />
          <text
            x={m.x}
            y={m.y + 4}
            textAnchor="middle"
            fill={step === i ? "#112030" : colors[i]}
            fontSize="13"
            fontWeight="600"
          >
            {i + 1}
          </text>
        </g>
      ))}
      <text x="52" y="394" fill="#8294aa" fontSize="12">
        OBSERVE THE CONTEXT
      </text>
      <path d="M240 390 H550 l-6 -4 m6 4 l-6 4" stroke="#536a85" fill="none" />
      <text x="581" y="394" fill="#8294aa" fontSize="12">
        WAIT FOR CONFIRMATION
      </text>
    </svg>
  );
}
