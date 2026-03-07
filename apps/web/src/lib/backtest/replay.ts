export type ReplayTimeframe = '1m';
export type ReplayDataProvider = 'mock' | 'databento';
export type ReplayPlaybackSpeed = 1 | 2 | 4 | 8;

export interface ReplayCandle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ReplayExecution {
  id: string;
  tradeId: string;
  timestamp: string;
  side: 'Long' | 'Short';
  price: number;
  quantity: number;
  type: 'entry' | 'exit';
  pnl?: number;
  notes?: string;
}

export interface ReplaySessionConfig {
  symbol: string;
  replayDate: string;
  timeframe: ReplayTimeframe;
  provider: ReplayDataProvider;
}

export interface ReplayCursorState {
  candleIndex: number;
  activeTimestamp: string | null;
  isPlaying: boolean;
}

export interface ReplayPlaybackSettings {
  speed: ReplayPlaybackSpeed;
  timeframe: ReplayTimeframe;
}

export interface ReplayChartMarker {
  executionId: string;
  timestamp: string;
  price: number;
  side: 'Long' | 'Short';
  type: 'entry' | 'exit';
  active: boolean;
}

export const REPLAY_SPEEDS: ReplayPlaybackSpeed[] = [1, 2, 4, 8];
export const DEFAULT_REPLAY_SPEED: ReplayPlaybackSpeed = 1;
export const REPLAY_CACHE_PREFIX = 'tradepilot_replay_cache_v1';

const FUTURES_SYMBOL_MAP: Record<string, string> = {
  ES: 'CME_ES1',
  MES: 'CME_MES1',
  NQ: 'CME_NQ1',
  MNQ: 'CME_MNQ1',
  YM: 'CBOT_YM1',
  RTY: 'CME_RTY1',
  CL: 'NYM_CL1',
  MCL: 'NYM_MCL1',
  GC: 'COM_GC1',
};

export function normalizeReplaySymbol(symbol: string): string {
  const upper = symbol.trim().toUpperCase();
  return FUTURES_SYMBOL_MAP[upper] || upper;
}

export function replayCacheKey(config: ReplaySessionConfig): string {
  return [
    REPLAY_CACHE_PREFIX,
    normalizeReplaySymbol(config.symbol),
    config.replayDate,
    config.timeframe,
    config.provider,
  ].join(':');
}

export function buildReplayTimestamp(date: string, time?: string, offsetMinutes = 0): string | undefined {
  if (!date || !time) return undefined;
  const value = new Date(`${date}T${time}:00`);
  if (Number.isNaN(value.getTime())) return undefined;
  value.setMinutes(value.getMinutes() + offsetMinutes);
  return value.toISOString();
}

export function clampIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(index, total - 1));
}

export function getVisibleReplayWindow<T>(items: T[], activeIndex: number, windowSize = 80): T[] {
  if (items.length === 0) return [];
  const end = clampIndex(activeIndex, items.length) + 1;
  const start = Math.max(0, end - windowSize);
  return items.slice(start, end);
}

export function formatReplayTime(timestamp: string | null): string {
  if (!timestamp) return '--:--';
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatReplayDate(timestamp: string | null): string {
  if (!timestamp) return '--';
  return new Date(timestamp).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
