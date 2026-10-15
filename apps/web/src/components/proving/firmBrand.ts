// How each prop firm shows up in Proving Ground: its logo when the app has
// one, otherwise a monogram on the firm's colour.

const BRANDS: Record<string, { logo?: string; color: string; mono: string }> = {
  lucid: { logo: "/logos/lucid-trading.png", color: "#7C5CFF", mono: "L" },
  toponefutures: { logo: "/logos/topone-futures.png", color: "#F5B700", mono: "1" },
  tof: { logo: "/logos/topone-futures.png", color: "#F5B700", mono: "1" },
  "futures-elite": { logo: "/logos/futures-elite.svg", color: "#2FD3A0", mono: "FE" },
  tradeify: { color: "#3B82F6", mono: "T" },
  fundednext: { logo: "/logos/funded-next.png", color: "#5B5BF7", mono: "FN" },
  takeprofittrader: { color: "#22C55E", mono: "TP" },
  topstep: { logo: "/logos/topstep.png", color: "#E8E8E8", mono: "TS" },
  apex: { logo: "/logos/apex.png", color: "#FF8A00", mono: "A" },
  myfundedfutures: { logo: "/logos/my-funded-futures.png", color: "#22D3EE", mono: "M" },
  custom: { color: "#71717A", mono: "★" },
};

/** Firm ids are program ids like "lucid-flex" or "tof-elite"; match on their prefix. */
export function firmBrand(firmId: string) {
  const key = Object.keys(BRANDS).find((k) => firmId === k || firmId.startsWith(`${k}-`)) ?? "custom";
  return BRANDS[key];
}

/** The order firms are offered in: the ones this trader uses most first. */
export const FIRM_ORDER = ["Lucid Trading", "Top One Futures", "Futures Elite", "Tradeify", "FundedNext", "Take Profit Trader", "Topstep", "Apex Trader Funding", "My Funded Futures"];
