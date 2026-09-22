'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Account } from '@/store/accountStore';
import { useRoutineStore } from '@/store/routineStore';
import { localSessionDate } from '@/lib/sessionRisk';
import { evaluateDailyStop, type DailyStop } from '@/lib/dailyStop';

/** Today's stop for an account, using the limits committed in Preflight. Re-checks each minute for the stop time. */
export function useDailyStop(account: Account | null): DailyStop | null {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const today = localSessionDate(now);
  const plan = useRoutineStore((s) => s.gamePlans[today]);

  return useMemo(
    () =>
      account
        ? evaluateDailyStop(
            account,
            today,
            { maxLoss: plan?.maxLoss, maxProfit: plan?.maxProfit, maxTrades: plan?.maxTrades, stopTime: plan?.stopTime },
            now,
          )
        : null,
    [account, today, plan, now],
  );
}
