export interface PatienceInputs {
  risk: number;
  accounts: number;
  cushion: number;
  winRate: number;
  reward: number;
  trades: number;
  split: number;
  fees: number;
  goal: number;
}

export function patienceScenario(p: PatienceInputs, multiplier = 1) {
  const risk = Math.max(0, p.risk * multiplier);
  const expectancy =
    ((p.winRate / 100) * p.reward - (1 - p.winRate / 100)) * risk - p.fees;
  const daily = expectancy * p.trades;
  const grossCycle = daily * 20 * p.accounts;
  const cycle = grossCycle > 0 ? grossCycle * (p.split / 100) : grossCycle;
  const loss = risk + p.fees;
  return {
    risk,
    daily,
    cycle,
    // A loss that reaches the limit can breach the account, so count only losses strictly below it.
    lossesBeforeLimit:
      loss > 0 ? Math.max(0, Math.ceil(p.cushion / loss) - 1) : 0,
    goalSessions: cycle > 0 ? Math.ceil(p.goal / (cycle / 20)) : null,
    roughWeek: [-2, -2, 0, 1, 2].map(
      (r) => r * risk - (r === 0 ? 0 : 2 * p.fees),
    ),
  };
}
