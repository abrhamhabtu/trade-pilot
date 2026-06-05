import { BotState, BotConfig, RiskStatus, RiskLayerStatus } from './types';

export function calculateRiskStatus(state: BotState, config: BotConfig): RiskStatus {
  const capital = config.capital.totalUsd;

  const dailyLimit = capital * config.risk.dailyMaxLossPct;
  const monthlyLimit = capital * config.risk.monthlyMaxLossPct;
  const drawdownLimit = config.risk.maxDrawdownPct;
  const totalLimit = capital * config.risk.totalMaxLossPct;

  const dailyUsed = Math.abs(state.dailyPnL);
  const monthlyUsed = Math.abs(state.monthlyPnL);
  const drawdownUsed = state.currentDrawdown;
  const totalUsed = Math.abs(state.totalPnL);

  return {
    daily: {
      used: dailyUsed,
      limit: dailyLimit,
      status: getLayerStatus(dailyUsed, dailyLimit, 0.8),
    },
    monthly: {
      used: monthlyUsed,
      limit: monthlyLimit,
      status: getLayerStatus(monthlyUsed, monthlyLimit, 0.8),
    },
    drawdown: {
      used: drawdownUsed,
      limit: drawdownLimit,
      status: getLayerStatus(drawdownUsed, drawdownLimit, 0.8),
    },
    total: {
      used: totalUsed,
      limit: totalLimit,
      status: getLayerStatus(totalUsed, totalLimit, 0.9),
    },
  };
}

function getLayerStatus(used: number, limit: number, warningThreshold: number): RiskLayerStatus {
  if (used >= limit) return 'breached';
  if (used >= limit * warningThreshold) return 'warning';
  return 'ok';
}

export function canTrade(state: BotState, config: BotConfig): { allowed: boolean; reason?: string } {
  if (state.status === 'halted') {
    return { allowed: false, reason: 'Trading permanently halted, total loss limit reached' };
  }

  if (state.status === 'paused' && state.pauseUntil && Date.now() < state.pauseUntil) {
    const mins = Math.ceil((state.pauseUntil - Date.now()) / 60000);
    return { allowed: false, reason: `Bot paused for ${mins} more minutes` };
  }

  const risk = calculateRiskStatus(state, config);

  if (risk.daily.status === 'breached') {
    return { allowed: false, reason: `Daily loss limit breached: $${risk.daily.used.toFixed(2)} / $${risk.daily.limit.toFixed(2)}` };
  }

  if (risk.monthly.status === 'breached') {
    return { allowed: false, reason: `Monthly loss limit breached: $${risk.monthly.used.toFixed(2)} / $${risk.monthly.limit.toFixed(2)}` };
  }

  if (risk.drawdown.status === 'breached') {
    return { allowed: false, reason: `Max drawdown breached: ${(risk.drawdown.used * 100).toFixed(1)}% / ${(risk.drawdown.limit * 100).toFixed(1)}%` };
  }

  if (risk.total.status === 'breached') {
    return { allowed: false, reason: 'Total loss limit reached, trading halted' };
  }

  return { allowed: true };
}

export function calculatePositionSize(
  baseSize: number,
  state: BotState,
  config: BotConfig
): number {
  if (!config.risk.enableDynamicSizing) return baseSize;

  let size = baseSize;

  if (state.consecutiveLosses > 2) {
    const reduction = Math.pow(1 - config.risk.lossSizingReduction, state.consecutiveLosses - 2);
    size *= reduction;
  }

  if (state.consecutiveWins > 3) {
    const increase = 1 + (Math.min(state.consecutiveWins - 3, 5) * config.risk.winSizingIncrease);
    size *= increase;
  }

  size = Math.max(config.risk.minPositionPct, size);
  size = Math.min(config.risk.maxPositionPct, size);

  return size;
}
