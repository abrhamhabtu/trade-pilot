import type { Trade } from "@/store/tradingStore";

export interface ProjectXFill {
  id: number;
  accountId: number;
  contractId: string;
  creationTimestamp: string;
  price: number;
  profitAndLoss: number | null;
  fees: number;
  side: number;
  size: number;
  voided: boolean;
}

/** Provider P&L is authoritative. Pair entry lots solely for prices, direction, duration and entry fees. */
export function projectXTrades(
  fills: ProjectXFill[],
  accountId: number,
): Trade[] {
  const lots = new Map<string, { fill: ProjectXFill; remaining: number }[]>();
  const result: Trade[] = [];
  const seen = new Set<number>();
  for (const f of [...fills].sort(
    (a, b) =>
      Date.parse(a.creationTimestamp) - Date.parse(b.creationTimestamp) ||
      a.id - b.id,
  )) {
    if (f.accountId !== accountId || f.voided || seen.has(f.id)) continue;
    seen.add(f.id);
    if (
      !Number.isSafeInteger(f.id) ||
      !Number.isFinite(f.price) ||
      !Number.isFinite(f.fees) ||
      !Number.isInteger(f.size) ||
      f.size <= 0 ||
      ![0, 1].includes(f.side) ||
      !Number.isFinite(Date.parse(f.creationTimestamp)) ||
      typeof f.contractId !== "string"
    )
      throw new Error(
        "The platform returned an invalid execution. No trades were imported.",
      );
    const queue = lots.get(f.contractId) ?? [];
    if (f.profitAndLoss === null) {
      if (queue.some((l) => l.fill.side !== f.side))
        throw new Error(
          "Reversing positions need reconciliation. No trades were imported.",
        );
      queue.push({ fill: f, remaining: f.size });
      lots.set(f.contractId, queue);
      continue;
    }
    if (!Number.isFinite(f.profitAndLoss))
      throw new Error("Invalid platform P&L. No trades were imported.");
    let left = f.size;
    let entryValue = 0;
    let entryFees = 0;
    let opened = "";
    while (left > 0 && queue.length > 0) {
      const lot = queue[0];
      if (lot.fill.side === f.side) break;
      const quantity = Math.min(left, lot.remaining);
      if (!opened) opened = lot.fill.creationTimestamp;
      entryValue += lot.fill.price * quantity;
      entryFees += (lot.fill.fees * quantity) / lot.fill.size;
      lot.remaining -= quantity;
      left -= quantity;
      if (lot.remaining === 0) queue.shift();
    }
    if (left > 0)
      throw new Error(
        "An exit has no matching entry in this date range. Choose an earlier start date; no trades were imported.",
      );
    const commission = entryFees + f.fees;
    const netPL = Math.round((f.profitAndLoss - commission) * 100) / 100;
    const closed = new Date(f.creationTimestamp);
    result.push({
      id: `projectx:${accountId}:${f.id}`,
      date: closed.toISOString(),
      time: closed.toISOString().slice(11, 19),
      symbol: f.contractId,
      entryPrice: entryValue / f.size,
      exitPrice: f.price,
      quantity: f.size,
      netPL,
      duration: (closed.getTime() - Date.parse(opened)) / 60000,
      outcome: netPL > 0 ? "win" : "loss",
      side: f.side === 1 ? "Long" : "Short",
      commission,
      notes:
        "ProjectX closed execution · UTC · entry and exit fees included. Partial exits are separate records.",
    });
  }
  return result;
}
