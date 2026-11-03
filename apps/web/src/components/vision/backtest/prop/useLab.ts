"use client";

// Client side of the lab: the trader's limits, firm rule checks, and any long job's progress.

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_LIMITS, type RiskLimits } from "@/lib/vision/limits";
import type { RuleCheck } from "@/lib/vision/scout";

export const labPost = (body: unknown) => fetch("/api/library/lab", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => ({})) }));

export type LabJobView = { stage: string; done: number; total: number; error?: string } | null;

export function useLimits() {
  const [limits, setLimits] = useState<RiskLimits>(DEFAULT_LIMITS);
  const [firms, setFirms] = useState<RuleCheck[]>([]);
  useEffect(() => {
    fetch("/api/library/lab?view=limits", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j) {
          setLimits(j.limits);
          setFirms(j.firms);
        }
      })
      .catch(() => undefined);
  }, []);
  const save = useCallback(async (next: RiskLimits) => {
    setLimits(next);
    await labPost({ action: "limits", limits: next });
  }, []);
  return { limits, firms, save };
}

/** Loads a lab view and keeps polling while its job runs. */
export function useLabView<T>(query: string) {
  const [data, setData] = useState<T | null>(null);
  const [job, setJob] = useState<LabJobView>(null);
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(async () => {
    const r = await fetch(`/api/library/lab?${query}`, { cache: "no-store" }).catch(() => null);
    if (!r?.ok) return setLoaded(true);
    const j = await r.json();
    setData(j);
    setJob(j.job ?? null);
    setLoaded(true);
  }, [query]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!job || job.error) return;
    const id = setInterval(refresh, 1500);
    return () => clearInterval(id);
  }, [job, refresh]);
  return { data, job, setJob, loaded, refresh };
}
