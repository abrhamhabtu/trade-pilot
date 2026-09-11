import type { Trade } from "@/store/tradingStore";

export interface TradovateFill {
  id: number;
  contractId: number;
  timestamp: string;
  qty: number;
  active: boolean;
}
export interface TradovatePair {
  id: number;
  positionId: number;
  buyFillId: number;
  sellFillId: number;
  qty: number;
  buyPrice: number;
  sellPrice: number;
  active: boolean;
}
export interface TradovateContract {
  name: string;
  valuePerPoint: number;
}

export function tradovateTrades(
  pairs: TradovatePair[],
  fills: TradovateFill[],
  contracts: Map<number, TradovateContract>,
  fees: Map<number, number>,
  accountId: number,
  environment: "demo" | "live",
  start: number,
): Trade[] {
  const byId = new Map(fills.map((f) => [f.id, f]));
  const seen = new Set<number>();
  const trades: Trade[] = [];
  for (const pair of pairs) {
    if (!pair.active || seen.has(pair.id)) continue;
    seen.add(pair.id);
    const buy = byId.get(pair.buyFillId),
      sell = byId.get(pair.sellFillId);
    if (!buy || !sell || !buy.active || !sell.active)
      throw new Error(
        "A paired trade is missing an active execution. No records were imported.",
      );
    const long =
      Date.parse(buy.timestamp) < Date.parse(sell.timestamp) ||
      (buy.timestamp === sell.timestamp && buy.id < sell.id);
    const entry = long ? buy : sell,
      exit = long ? sell : buy;
    if (
      !Number.isFinite(Date.parse(entry.timestamp)) ||
      !Number.isFinite(Date.parse(exit.timestamp))
    )
      throw new Error("Invalid execution timestamp.");
    if (Date.parse(exit.timestamp) < start) continue;
    const contract = contracts.get(buy.contractId);
    if (
      buy.contractId !== sell.contractId ||
      !contract ||
      !(contract.valuePerPoint > 0)
    )
      throw new Error(
        "Contract value could not be verified. No records were imported.",
      );
    const buyFee = fees.get(buy.id),
      sellFee = fees.get(sell.id);
    if (!Number.isFinite(buyFee) || !Number.isFinite(sellFee))
      throw new Error(
        "Execution fees are unavailable. Try again after the platform finalizes the trades.",
      );
    if (
      ![pair.qty, buy.qty, sell.qty].every(
        (q) => Number.isSafeInteger(q) && q > 0,
      ) ||
      pair.qty > buy.qty ||
      pair.qty > sell.qty ||
      !Number.isFinite(pair.buyPrice) ||
      !Number.isFinite(pair.sellPrice)
    )
      throw new Error("Invalid paired execution quantities or prices.");
    const commission =
      (buyFee! * pair.qty) / buy.qty + (sellFee! * pair.qty) / sell.qty;
    const netPL =
      Math.round(
        ((pair.sellPrice - pair.buyPrice) * pair.qty * contract.valuePerPoint -
          commission) *
          100,
      ) / 100;
    trades.push({
      id: `tradovate-${environment}:${accountId}:${pair.id}`,
      symbol: contract.name,
      date: new Date(exit.timestamp).toISOString(),
      time: new Date(exit.timestamp).toISOString().slice(11, 19),
      entryPrice: long ? pair.buyPrice : pair.sellPrice,
      exitPrice: long ? pair.sellPrice : pair.buyPrice,
      quantity: pair.qty,
      commission,
      netPL,
      duration:
        (Date.parse(exit.timestamp) - Date.parse(entry.timestamp)) / 60000,
      outcome: netPL > 0 ? "win" : "loss",
      side: long ? "Long" : "Short",
      notes:
        "Tradovate matched fill pair · UTC · reported execution fees included. Partial exits are separate records.",
    });
  }
  return trades;
}
