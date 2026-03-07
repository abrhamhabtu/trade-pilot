'use client';

import { useEffect, useMemo, useState } from 'react';
import type { BacktestSession } from '@/store/backtestStore';
import { getReplayProvider } from '@/lib/backtest/providers';
import {
  buildReplayTimestamp,
  clampIndex,
  DEFAULT_REPLAY_SPEED,
  formatReplayDate,
  formatReplayTime,
  getVisibleReplayWindow,
  ReplayCandle,
  ReplayExecution,
  ReplayPlaybackSpeed,
} from '@/lib/backtest/replay';

function buildReplayExecutions(session: BacktestSession): ReplayExecution[] {
  return session.trades.flatMap((trade) => {
    const entryTime = trade.enteredAt || buildReplayTimestamp(trade.date, trade.time);
    const exitTime = trade.exitedAt || buildReplayTimestamp(trade.date, trade.time, trade.duration || 1);
    const executions: ReplayExecution[] = [];

    if (entryTime) {
      executions.push({
        id: `${trade.id}:entry`,
        tradeId: trade.id,
        timestamp: entryTime,
        side: trade.side,
        price: trade.entryPrice,
        quantity: trade.quantity,
        type: 'entry',
        notes: trade.notes,
      });
    }

    if (exitTime) {
      executions.push({
        id: `${trade.id}:exit`,
        tradeId: trade.id,
        timestamp: exitTime,
        side: trade.side,
        price: trade.exitPrice,
        quantity: trade.quantity,
        type: 'exit',
        pnl: trade.netPL,
        notes: trade.notes,
      });
    }

    return executions;
  }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function indexForTimestamp(candles: ReplayCandle[], timestamp: string | null): number {
  if (!timestamp || candles.length === 0) return 0;
  const target = new Date(timestamp).getTime();
  const found = candles.findIndex((candle) => new Date(candle.timestamp).getTime() >= target);
  return found === -1 ? candles.length - 1 : found;
}

export function useReplaySession(session: BacktestSession) {
  const [candles, setCandles] = useState<ReplayCandle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candleIndex, setCandleIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<ReplayPlaybackSpeed>(
    session.replaySettings?.speed || DEFAULT_REPLAY_SPEED
  );
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);

  const replayDate = session.replayDate || session.startDate || new Date().toISOString().slice(0, 10);
  const providerId = session.dataProvider || 'mock';
  const timeframe = session.replaySettings?.timeframe || '1m';

  useEffect(() => {
    let mounted = true;

    async function loadCandles() {
      try {
        setIsLoading(true);
        setError(null);
        const provider = getReplayProvider(providerId);
        const nextCandles = await provider.fetchCandles({
          symbol: session.symbol,
          replayDate,
          timeframe,
          provider: providerId,
        });
        if (!mounted) return;
        setCandles(nextCandles);
        setCandleIndex((current) => clampIndex(current, nextCandles.length));
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load replay candles');
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadCandles();

    return () => {
      mounted = false;
    };
  }, [providerId, replayDate, session.symbol, timeframe]);

  const executions = useMemo(() => buildReplayExecutions(session), [session]);

  useEffect(() => {
    if (!isPlaying || candles.length === 0) return undefined;

    const interval = window.setInterval(() => {
      setCandleIndex((current) => {
        if (current >= candles.length - 1) {
          setIsPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, Math.max(180, 900 / playbackSpeed));

    return () => {
      window.clearInterval(interval);
    };
  }, [candles.length, isPlaying, playbackSpeed]);

  const activeCandle = candles[candleIndex] || null;
  const activeTimestamp = activeCandle?.timestamp || null;
  const visibleCandles = useMemo(
    () => getVisibleReplayWindow(candles, candleIndex, 90),
    [candles, candleIndex]
  );

  const visibleExecutions = useMemo(() => {
    if (visibleCandles.length === 0) return [];
    const start = new Date(visibleCandles[0].timestamp).getTime();
    const end = new Date(visibleCandles[visibleCandles.length - 1].timestamp).getTime();
    return executions.filter((execution) => {
      const time = new Date(execution.timestamp).getTime();
      return time >= start && time <= end;
    });
  }, [executions, visibleCandles]);

  const selectedExecution =
    executions.find((execution) => execution.id === selectedExecutionId) || executions[0] || null;
  const selectedTrade =
    session.trades.find((trade) => trade.id === selectedExecution?.tradeId) || session.trades[0] || null;

  useEffect(() => {
    if (selectedExecutionId || !selectedExecution) return;
    setSelectedExecutionId(selectedExecution.id);
  }, [selectedExecution, selectedExecutionId]);

  const dayStats = useMemo(() => {
    const wins = session.trades.filter((trade) => trade.outcome === 'win').length;
    const losses = session.trades.filter((trade) => trade.outcome === 'loss').length;
    const averageTrade = session.totalTrades > 0 ? session.totalPnL / session.totalTrades : 0;
    return {
      wins,
      losses,
      averageTrade,
      replayDateLabel: formatReplayDate(activeTimestamp || replayDate),
      replayTimeLabel: formatReplayTime(activeTimestamp),
    };
  }, [activeTimestamp, replayDate, session]);

  return {
    candles,
    visibleCandles,
    executions,
    visibleExecutions,
    selectedExecution,
    selectedTrade,
    selectedExecutionId,
    setSelectedExecutionId,
    activeCandle,
    activeTimestamp,
    candleIndex,
    isLoading,
    error,
    isPlaying,
    playbackSpeed,
    setPlaybackSpeed,
    setIsPlaying,
    stepForward: () => setCandleIndex((current) => clampIndex(current + 1, candles.length)),
    stepBackward: () => setCandleIndex((current) => clampIndex(current - 1, candles.length)),
    jumpToIndex: (index: number) => setCandleIndex(clampIndex(index, candles.length)),
    jumpToExecution: (executionId: string) => {
      const execution = executions.find((item) => item.id === executionId);
      if (!execution) return;
      setSelectedExecutionId(execution.id);
      setCandleIndex(indexForTimestamp(candles, execution.timestamp));
    },
    dayStats,
  };
}
