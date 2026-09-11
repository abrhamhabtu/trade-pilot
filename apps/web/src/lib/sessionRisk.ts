export interface RiskSnapshot {
  cushion: number;
  dailyRemaining: number;
  personalDailyLimit: number;
  reserve: number;
  contractCap: number;
  nextRequirement: string;
  confirmedAt: string;
}

export const SESSION_INSTRUMENTS = {
  MNQ: { pointValue: 2, tick: 0.25 },
  MES: { pointValue: 5, tick: 0.25 },
  MGC: { pointValue: 10, tick: 0.1 },
  MBT: { pointValue: 0.1, tick: 5 },
  M2K: { pointValue: 5, tick: 0.1 },
  MYM: { pointValue: 0.5, tick: 1 },
  NQ: { pointValue: 20, tick: 0.25 },
  ES: { pointValue: 50, tick: 0.25 },
} as const;

export function localSessionDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function snapshotFresh(
  snapshot: RiskSnapshot | undefined,
  now = Date.now(),
) {
  if (!snapshot) return false;
  const age = now - Date.parse(snapshot.confirmedAt);
  return Number.isFinite(age) && age >= 0 && age <= 30 * 60_000;
}

interface SizingAccount {
  id: string;
  name: string;
  status: string;
  riskSnapshot?: RiskSnapshot;
}
export interface SessionInputs {
  symbol: keyof typeof SESSION_INSTRUMENTS;
  stopPoints: number;
  risk: number;
  fees: number;
  slippagePoints: number;
  maxTrades: number;
  completedTrades: number;
  date: string;
  finishTime: string;
  setup: string;
  lastTradeAt?: string;
}

export function sizeSession(
  plan: SessionInputs,
  accounts: SizingAccount[],
  now = new Date(),
) {
  const reasons: string[] = [];
  const instrument = SESSION_INSTRUMENTS[plan.symbol];
  const numeric = [
    plan.stopPoints,
    plan.risk,
    plan.fees,
    plan.slippagePoints,
    plan.maxTrades,
    plan.completedTrades,
  ];
  if (
    !instrument ||
    numeric.some((v) => !Number.isFinite(v)) ||
    plan.stopPoints <= 0 ||
    plan.risk <= 0 ||
    plan.fees < 0 ||
    plan.slippagePoints < 0 ||
    plan.maxTrades < 1 ||
    !Number.isInteger(plan.maxTrades) ||
    !Number.isInteger(plan.completedTrades) ||
    plan.completedTrades < 0
  )
    reasons.push("Enter valid sizing inputs.");
  if (!plan.setup.trim()) reasons.push("Name the setup you are waiting for.");
  if (!accounts.length) reasons.push("Choose at least one account.");
  if (plan.date !== localSessionDate(now))
    reasons.push("Start a plan for today.");
  const validTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(plan.finishTime);
  if (!validTime) reasons.push("Choose a valid finish time.");
  else if (
    now.getTime() >= new Date(`${plan.date}T${plan.finishTime}:00`).getTime()
  )
    reasons.push("Your session finish time has passed.");
  if (plan.completedTrades >= plan.maxTrades)
    reasons.push("Your planned trade limit is reached.");
  let budget = plan.risk;
  let cap = Number.MAX_SAFE_INTEGER;
  let limitingAccount = "";
  for (const account of accounts) {
    const s = account.riskSnapshot;
    if (account.status !== "active")
      reasons.push(`${account.name}: account is not active.`);
    if (!s || !snapshotFresh(s, now.getTime())) {
      reasons.push(`${account.name}: confirm a fresh risk snapshot.`);
      continue;
    }
    if (
      plan.lastTradeAt &&
      Date.parse(s.confirmedAt) <= Date.parse(plan.lastTradeAt)
    )
      reasons.push(
        `${account.name}: update remaining limits after your last trade.`,
      );
    if (
      [
        s.cushion,
        s.dailyRemaining,
        s.personalDailyLimit,
        s.reserve,
        s.contractCap,
      ].some((v) => !Number.isFinite(v) || v < 0) ||
      !Number.isInteger(s.contractCap) ||
      s.contractCap < 1
    ) {
      reasons.push(`${account.name}: check the risk limits.`);
      continue;
    }
    // Keep at least one cent above the cushion boundary, even with a zero reserve.
    const available = Math.max(
      0,
      Math.min(
        s.cushion - Math.max(s.reserve, 0.01),
        s.dailyRemaining,
        s.personalDailyLimit,
      ),
    );
    if (available < budget) {
      budget = available;
      limitingAccount = account.name;
    }
    cap = Math.min(cap, s.contractCap);
  }
  // Round the stop and slippage UP to valid ticks, never toward a larger position.
  const roundedStop = instrument
    ? Math.ceil(plan.stopPoints / instrument.tick - 1e-10) * instrument.tick
    : 0;
  const roundedSlippage = instrument
    ? Math.ceil(plan.slippagePoints / instrument.tick - 1e-10) * instrument.tick
    : 0;
  const perContract = instrument
    ? (roundedStop + roundedSlippage) * instrument.pointValue + plan.fees
    : 0;
  const contracts =
    reasons.length || !Number.isFinite(perContract) || perContract <= 0
      ? 0
      : Math.max(0, Math.min(cap, Math.floor((budget + 1e-9) / perContract)));
  if (!reasons.length && contracts === 0)
    reasons.push(
      "One contract exceeds the available budget. Skip this setup or use a smaller instrument; do not tighten a valid stop to force a trade.",
    );
  return {
    contracts,
    budget,
    perContract,
    roundedStop,
    perAccountRisk: contracts * perContract,
    totalRisk: contracts * perContract * accounts.length,
    limitingAccount,
    reasons,
  };
}
