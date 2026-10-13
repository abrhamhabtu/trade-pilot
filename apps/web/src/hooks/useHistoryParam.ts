'use client';

import { useCallback, useSyncExternalStore } from 'react';

// Views inside a page (an open playbook, a tab, a day review) live in the URL
// so the browser's Back and Forward buttons step through them like pages.

const CHANGE = 'tp:history-change';
let patched = false;

// Next's own navigations call pushState without telling anyone, so a sidebar
// link back to the bare page would otherwise leave the old view on screen.
function patchHistory() {
  if (patched) return;
  patched = true;
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = window.history[method];
    window.history[method] = function (this: History, ...args: Parameters<History['pushState']>) {
      const result = original.apply(this, args);
      queueMicrotask(() => window.dispatchEvent(new Event(CHANGE)));
      return result;
    };
  }
}

function subscribe(onChange: () => void) {
  patchHistory();
  window.addEventListener('popstate', onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

function normalise(params: URLSearchParams) {
  params.sort();
  return params.toString();
}

/** The search string after applying a patch; null removes a key. */
export function patchSearch(search: string, patch: Record<string, string | null>) {
  const params = new URLSearchParams(search);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  return normalise(params);
}

export function setHistoryParams(patch: Record<string, string | null>, options: { replace?: boolean } = {}) {
  const current = normalise(new URLSearchParams(window.location.search));
  const next = patchSearch(current, patch);
  if (next === current) return;
  const url = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash}`;
  const state = window.history.state as { tpPrev?: string } | null;
  if (options.replace) {
    window.history.replaceState(typeof state?.tpPrev === 'string' ? { tpPrev: state.tpPrev } : null, '', url);
    return;
  }
  // Closing a view is the same step as pressing Back, so take that step
  // instead of stacking a second copy of the page the trader came from.
  if (state?.tpPrev === next) {
    window.history.back();
    return;
  }
  window.history.pushState({ tpPrev: current }, '', url);
}

export function useHistoryParam(key: string): [string | null, (value: string | null, options?: { replace?: boolean }) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get(key),
    () => null
  );
  const set = useCallback(
    (next: string | null, options?: { replace?: boolean }) => setHistoryParams({ [key]: next }, options),
    [key]
  );
  return [value, set];
}

/** A tab kept in the URL; the first id is the default and leaves the URL bare. */
export function useHistoryTab<T extends string>(key: string, ids: readonly T[]): [T, (tab: T, options?: { replace?: boolean }) => void] {
  const [raw, setRaw] = useHistoryParam(key);
  const tab = ids.includes(raw as T) ? (raw as T) : ids[0];
  const set = useCallback(
    (next: T, options?: { replace?: boolean }) => setRaw(next === ids[0] ? null : next, options),
    // The id list is a constant per call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setRaw]
  );
  return [tab, set];
}
