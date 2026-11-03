// Where a Vision trade can be sent. Paper trading happens in the browser;
// everything here sends real orders and runs only after the trader arms a
// venue for the day (see the execute route).
//
// To add a venue (a crypto exchange, another futures broker), implement
// ExecutionVenue and register it in VENUES. The route handles arming, size
// caps, logging and alerts for every venue the same way.

import { SYMBOLS, type VisionSymbolId } from "@/lib/vision/markets";
import * as px from "../live/projectx";
import * as tv from "../live/tradovate";

export interface VenueOrder {
  accountId: number;
  accountName: string;
  symbol: VisionSymbolId;
  micro: boolean;
  side: "long" | "short";
  qty: number;
  /** Last price, used to place bracket prices at the plan's distances. */
  refPx: number;
  stopPts: number;
  targetPts: number;
  tag: string;
}

export interface ExecutionVenue {
  id: string;
  label: string;
  markets: ("futures" | "crypto")[];
  connected(): Promise<boolean>;
  /** Market entry with a broker-held stop and target. Returns the broker's order id. */
  placeBracket(o: VenueOrder): Promise<string>;
  /** Close the position on this symbol and cancel its working orders. */
  flatten(o: Pick<VenueOrder, "accountId" | "symbol" | "micro">): Promise<void>;
}

const root = (symbol: VisionSymbolId, micro: boolean) => {
  const r = SYMBOLS[symbol].roots;
  if (!r) throw new Error(`${symbol} is not a futures market.`);
  return micro ? r.micro : r.full;
};

const tradovate: ExecutionVenue = {
  id: "tradovate",
  label: "Tradovate",
  markets: ["futures"],
  connected: async () => !!(await tv.getSecrets()).sec,
  async placeBracket(o) {
    const c = await tv.frontContract(root(o.symbol, o.micro));
    const id = await tv.placeBracketMarket({ accountId: o.accountId, accountName: o.accountName, symbol: c.name, side: o.side, size: o.qty, refPx: o.refPx, stopPts: o.stopPts, targetPts: o.targetPts, tick: SYMBOLS[o.symbol].tick, tag: o.tag });
    return String(id);
  },
  async flatten(o) {
    const c = await tv.frontContract(root(o.symbol, o.micro));
    await tv.liquidate(o.accountId, c.id);
  },
};

const projectx: ExecutionVenue = {
  id: "projectx",
  label: "TopstepX",
  markets: ["futures"],
  connected: async () => !!(await px.getSecrets()).apiKey,
  async placeBracket(o) {
    const c = await px.frontContract(root(o.symbol, o.micro));
    const id = await px.placeBracketMarket({ accountId: o.accountId, contractId: c.id, side: o.side, size: o.qty, stopTicks: o.stopPts / c.tickSize, targetTicks: o.targetPts / c.tickSize, tag: o.tag });
    return String(id);
  },
  async flatten(o) {
    const c = await px.frontContract(root(o.symbol, o.micro));
    await px.closeContract(o.accountId, c.id);
    await px.cancelOpenOrders(o.accountId, c.id);
  },
};

// Crypto exchanges plug in here (for example Coinbase Advanced Trade with an
// API key and JWT signing). None is connected yet: Vision paper-trades crypto.
export const VENUES: Record<string, ExecutionVenue> = { tradovate, projectx };
