export interface DisciplineInputs {
  contracts: number;
  stop: number;
  pointValue: number;
  tick: number;
  fees: number;
  slippageTicks: number;
  accounts: number;
  cushion: number;
  winRate: number;
  reward: number;
  trades: number;
  split: number;
  goal: number;
}

/** Fixed-cushion illustrations only: no payout eligibility or survival probability. */
export function disciplineScenario(
  p: DisciplineInputs,
  contracts = p.contracts,
) {
  const valid =
    Object.values(p).every(Number.isFinite) &&
    Number.isInteger(contracts) &&
    contracts >= 1 &&
    Number.isInteger(p.accounts) &&
    p.accounts >= 1 &&
    p.stop > 0 &&
    p.pointValue > 0 &&
    p.tick > 0 &&
    p.fees >= 0 &&
    p.slippageTicks >= 0 &&
    Number.isInteger(p.slippageTicks) &&
    p.cushion > 0 &&
    p.winRate >= 0 &&
    p.winRate <= 100 &&
    p.reward > 0 &&
    p.trades > 0 &&
    p.split >= 0 &&
    p.split <= 100 &&
    p.goal > 0;
  if (!valid) return null;
  const stop = Number((Math.ceil(p.stop / p.tick - 1e-10) * p.tick).toFixed(8));
  const risk = contracts * stop * p.pointValue;
  const costs = contracts * (p.fees + p.slippageTicks * p.tick * p.pointValue);
  const loss = risk + costs;
  const edge =
    ((p.winRate / 100) * p.reward - (1 - p.winRate / 100)) * risk - costs;
  const daily = edge * p.trades * p.accounts;
  const dailyAfterSplit = daily > 0 ? (daily * p.split) / 100 : daily;
  const losses = Math.max(0, Math.ceil(p.cushion / loss) - 1);
  const sessions =
    dailyAfterSplit > 0 ? Math.ceil(p.goal / dailyAfterSplit) : null;
  return {
    contracts,
    risk,
    costs,
    loss,
    edge,
    dailyAfterSplit,
    losses,
    sessions,
    cycle: dailyAfterSplit * 20,
    copiedLoss: loss * p.accounts,
    stop,
  };
}

export function pressurePath(
  cushion: number,
  loss: number,
  wins: number,
  costs: number,
  sequence: number[],
) {
  let balance = cushion;
  let breached = false;
  return [
    cushion,
    ...sequence.map((r) => {
      if (breached) return 0;
      balance += r < 0 ? r * loss : r > 0 ? r * wins - costs : 0;
      if (balance <= 0) {
        balance = 0;
        breached = true;
      }
      return balance;
    }),
  ];
}
