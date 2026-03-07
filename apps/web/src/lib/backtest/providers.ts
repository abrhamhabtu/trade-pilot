import {
  normalizeReplaySymbol,
  ReplayCandle,
  ReplaySessionConfig,
  replayCacheKey,
} from './replay';

export interface ReplayMarketDataProvider {
  id: 'mock' | 'databento';
  fetchCandles(config: ReplaySessionConfig): Promise<ReplayCandle[]>;
}

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash || 1;
}

function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function basePriceForSymbol(symbol: string): number {
  if (symbol.includes('MNQ') || symbol.includes('NQ')) return 20100;
  if (symbol.includes('MES') || symbol.includes('ES')) return 5670;
  if (symbol.includes('CL') || symbol.includes('MCL')) return 77;
  if (symbol.includes('GC')) return 2150;
  return 1000;
}

function generateMockCandles(config: ReplaySessionConfig): ReplayCandle[] {
  const normalized = normalizeReplaySymbol(config.symbol);
  const seed = hashSeed(`${normalized}:${config.replayDate}`);
  const random = createRandom(seed);
  const candles: ReplayCandle[] = [];
  const dayStart = new Date(`${config.replayDate}T09:30:00`);
  const totalCandles = 240;
  let prevClose = basePriceForSymbol(normalized);

  for (let i = 0; i < totalCandles; i += 1) {
    const timestamp = new Date(dayStart.getTime() + i * 60_000);
    const drift = (random() - 0.48) * (prevClose > 1000 ? 6 : 0.6);
    const open = prevClose;
    const close = Math.max(0.01, open + drift);
    const high = Math.max(open, close) + random() * (prevClose > 1000 ? 4 : 0.35);
    const low = Math.min(open, close) - random() * (prevClose > 1000 ? 4 : 0.35);
    const volume = Math.round(500 + random() * 5000);
    candles.push({
      timestamp: timestamp.toISOString(),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(Math.max(0.01, low).toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });
    prevClose = close;
  }

  return candles;
}

function getCachedCandles(key: string): ReplayCandle[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as ReplayCandle[]) : null;
  } catch {
    return null;
  }
}

function setCachedCandles(key: string, candles: ReplayCandle[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(candles));
  } catch {
    // Ignore cache failures.
  }
}

export const mockReplayProvider: ReplayMarketDataProvider = {
  id: 'mock',
  async fetchCandles(config) {
    const key = replayCacheKey(config);
    const cached = getCachedCandles(key);
    if (cached) return cached;
    const candles = generateMockCandles(config);
    setCachedCandles(key, candles);
    return candles;
  },
};

export const databentoReplayProvider: ReplayMarketDataProvider = {
  id: 'databento',
  async fetchCandles(config) {
    // Placeholder for future paid-provider integration. Falls back to mock data in v1.
    return mockReplayProvider.fetchCandles({ ...config, provider: 'mock' });
  },
};

export function getReplayProvider(id: 'mock' | 'databento'): ReplayMarketDataProvider {
  return id === 'databento' ? databentoReplayProvider : mockReplayProvider;
}
