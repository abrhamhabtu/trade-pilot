"use client";
/* Browser-local reference images are kept at their native aspect ratio. */
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { ArrowRight, ImagePlus, Maximize2, ScanLine } from "lucide-react";
import type { PlaybookStrategy } from "../Playbooks";
import type { Evidence } from "@/lib/playbookLibrary";
import "./anatomy.css";

type Profile = {
  level: string;
  context: string;
  trigger: string;
  path: number[];
  kind: "break" | "reclaim" | "reversal" | "trend";
  zone?: string;
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
    level: "Value area low",
    context: "Auction outside value",
    trigger: "Failure below value, then re-entry",
    kind: "reclaim",
    zone: "Value area",
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
  const stages = [
    {
      name: "Context",
      title: profile.context,
      body: strategy.entryRules[0] || strategy.overview,
    },
    {
      name: "Confirmation",
      title: profile.trigger,
      body:
        strategy.entryRules.find((rule) =>
          /enter on|enter only|enter when|entry trigger/i.test(rule),
        ) ||
        strategy.entryRules[1] ||
        strategy.entryRules[0],
    },
    {
      name: "Invalidation",
      title: "Know where the idea fails",
      body: strategy.riskManagement[0],
    },
    {
      name: "Objective",
      title: "Plan the exit before the entry",
      body: strategy.exitRules[0],
    },
  ];
  return (
    <section className="sa" aria-label="Setup anatomy">
      <header className="sa-heading">
        <div>
          <span className="sa-eyebrow">THE VISUAL PLAYBOOK</span>
          <h2>
            Anatomy of the setup<span>.</span>
          </h2>
          <p>See the sequence. Understand the decision. Make it your own.</p>
        </div>
        <button className="sa-button" disabled={!ready} onClick={addImage}>
          <ImagePlus size={16} />
          Add your own chart
        </button>
      </header>
      <div className="sa-source-bar">
        <div className="sa-source-tabs">
          <button
            aria-pressed={!reference}
            disabled={!ready}
            onClick={() => selectImage("")}
          >
            <ScanLine size={14} />
            Illustrated guide
          </button>
          <label>
            Your examples{" "}
            <select
              aria-label="Anatomy example"
              disabled={!ready || !screenshots.length}
              value={reference?.id || ""}
              onChange={(e) => selectImage(e.target.value)}
            >
              <option value="">
                {screenshots.length
                  ? "Choose a saved chart"
                  : "Add a chart to begin"}
              </option>
              {screenshots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <span className="sa-source-note">
          {reference ? "YOUR REFERENCE" : "ILLUSTRATIVE · LONG SCENARIO"}
        </span>
      </div>
      {reference ? (
        <div className="sa-reference">
          <button
            className="sa-reference-image"
            onClick={() => openImage(reference)}
            aria-label={`Enlarge ${reference.title}`}
          >
            <img src={reference.image} alt={reference.title} />
            <span>
              <Maximize2 size={15} />
              View full size
            </span>
          </button>
          <div className="sa-caption">
            <div>
              <h3>{reference.title}</h3>
              <p>
                {reference.notes ||
                  "Add your observations in Workspace → Chart screenshots."}
              </p>
            </div>
            <span>
              {reference.source || "Your chart"} · Saved on this device
            </span>
          </div>
        </div>
      ) : (
        <>
          <div className="sa-diagram">
            <AnatomyChart profile={profile} step={step} />
          </div>
          <div className="sa-steps" aria-label="Setup stages">
            {stages.map((s, i) => (
              <button
                key={s.name}
                aria-pressed={step === i}
                onClick={() => setStep(i)}
              >
                <span className="sa-step-number">0{i + 1}</span>
                <span>{s.name}</span>
                <ArrowRight size={14} />
              </button>
            ))}
          </div>
          <div className="sa-explanation" aria-live="polite">
            <div>
              <span className="sa-eyebrow">STEP 0{step + 1} / 04</span>
              <h3>{stages[step].title}</h3>
            </div>
            <p>{stages[step].body}</p>
          </div>
          <p className="sa-footnote">
            Schematic price action, not a historical trade. Zones and distances
            are illustrative; use the strategy’s rules to define an actual
            trade.
          </p>
        </>
      )}
      <div className="sa-upload-tip">
        <ImagePlus size={16} />
        <p>
          <strong>Your charts belong here.</strong> Upload or paste a
          screenshot, add its source and what you noticed. It’s saved with this
          strategy and available in Workspace.
        </p>
        <button onClick={addImage} disabled={!ready}>
          Add example <ArrowRight size={14} />
        </button>
      </div>
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
      <text x="35" y="29" fill="#b6c3d6" fontSize="10" letterSpacing="2">
        PRICE ACTION / EXECUTION MAP
      </text>
      <text x="883" y="29" textAnchor="end" fill="#8294aa" fontSize="10">
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
        <text x="50" y={y(level) + 34} fill="#8cadd6" fontSize="11">
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
            y={y(line.price) - 13}
            width="160"
            height="26"
            rx="5"
            fill={line.active ? line.color : "#192a3f"}
          />
          <text
            x="738"
            y={y(line.price) + 4}
            fontSize="11"
            fill={line.active ? "#111e2d" : line.color}
          >
            {line.label}
          </text>
        </g>
      ))}
      <text x="52" y={y(level) - 17} fontSize="11" fill="#91bdf1">
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
            fontSize="11"
            fontWeight="600"
          >
            {i + 1}
          </text>
        </g>
      ))}
      <text x="52" y="394" fill="#8294aa" fontSize="10">
        OBSERVE THE CONTEXT
      </text>
      <path d="M240 390 H550 l-6 -4 m6 4 l-6 4" stroke="#536a85" fill="none" />
      <text x="581" y="394" fill="#8294aa" fontSize="10">
        WAIT FOR CONFIRMATION
      </text>
    </svg>
  );
}
