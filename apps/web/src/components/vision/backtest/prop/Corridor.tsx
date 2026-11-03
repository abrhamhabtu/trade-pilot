"use client";

import clsx from "clsx";
import { DD_LABEL, type FirmProgram } from "@/lib/proving/firms";

const usd = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const short = (n: number) => (Math.abs(n) >= 1000 ? `$${+(Math.abs(n) / 1000).toFixed(1)}k` : usd(n));

/**
 * The deal, to scale: the room you may lose on the left, the distance you must
 * make on the right. A lopsided bar is a hard account, whatever the marketing says.
 * Chevrons on the floor side mean it follows you up.
 */
export function Corridor({ p, size = "md", balance, floor }: { p: FirmProgram; size?: "sm" | "md" | "lg"; balance?: number; floor?: number }) {
  const instant = p.model === "instant" || !p.target;
  const right = instant ? p.drawdown : p.target;
  const span = p.drawdown + right;
  const startAt = (p.drawdown / span) * 100;
  const h = size === "lg" ? "h-5" : size === "md" ? "h-3" : "h-2";
  const pos = (v: number) => Math.max(0, Math.min(100, ((v - (p.size - p.drawdown)) / span) * 100));
  const trailing = p.ddType !== "static";
  return (
    <div className="w-full">
      <div className={clsx("relative flex w-full overflow-hidden rounded-full bg-white/[0.06]", h)} role="img" aria-label={`${usd(p.drawdown)} of room against ${instant ? "no fixed target" : `a ${usd(p.target)} target`}, ${DD_LABEL[p.ddType].toLowerCase()} drawdown`}>
        <span className="transition-[width] duration-500" style={{ width: `${startAt}%`, background: p.ddType === "trailing-intraday" ? "repeating-linear-gradient(115deg,#FF7A85 0 6px,#C9505B 6px 9px)" : p.ddType === "trailing-eod" ? "repeating-linear-gradient(115deg,#FF7A85 0 12px,#DD626D 12px 14px)" : "#FF7A85" }} />
        <span className={clsx("flex-1 transition-[width] duration-500", instant ? "bg-white/[0.12]" : "bg-[#30D158]")} />
        {balance != null && <span className="absolute inset-y-0 w-[3px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] transition-[left] duration-700" style={{ left: `${pos(balance)}%` }} />}
        {floor != null && floor > p.size - p.drawdown && <span className="absolute inset-y-0 left-0 bg-black/60" style={{ width: `${pos(floor)}%` }} />}
      </div>
      {size !== "sm" && (
        <div className={clsx("mt-1.5 flex justify-between tabular-nums", size === "lg" ? "text-[13px]" : "text-[11.5px]")}>
          <span className="text-[#FFA3AB]">
            {short(p.drawdown)} room{trailing ? (p.ddType === "trailing-intraday" ? ", trails live" : ", trails at close") : ", fixed"}
          </span>
          <span className={instant ? "text-white/40" : "text-[#7CE59A]"}>{instant ? "No target" : `${short(p.target)} to make`}</span>
        </div>
      )}
    </div>
  );
}
