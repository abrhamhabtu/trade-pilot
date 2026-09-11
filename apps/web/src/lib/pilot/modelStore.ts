"use client";
import { create } from "zustand";
import { DEFAULT_MODEL, PROVIDERS, type ModelConfig } from "@/lib/pilot/models";

const KEY = "pilot_model_v1";

/**
 * The model chosen in Pilot AI → Settings, shared with Playbooks.
 * Provider/model/baseUrl persist in localStorage; the API key stays in memory
 * for this browser session only (never written to storage).
 */
export const useModelStore = create<{
  model: ModelConfig;
  hydrated: boolean;
  hydrate: () => void;
  setModel: (value: ModelConfig) => void;
}>((set, get) => ({
  model: DEFAULT_MODEL,
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) return;
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (saved && Object.hasOwn(PROVIDERS, saved.provider))
        set({ model: { ...DEFAULT_MODEL, ...saved, apiKey: "" } });
    } catch {
      /* keep default */
    }
    set({ hydrated: true });
  },
  setModel: (value) => {
    set({ model: value });
    try {
      const { apiKey: _omit, ...safe } = value;
      localStorage.setItem(KEY, JSON.stringify(safe));
    } catch {
      /* in-memory config still works */
    }
  },
}));

/** Ready to call a remote model: provider chosen, model ID set, key present (unless loopback). */
export function modelReady(m: ModelConfig) {
  if (m.provider === "local" || !m.model.trim()) return false;
  if (m.provider === "custom" && !m.baseUrl.trim()) return false;
  if (m.provider === "ollama") return true;
  return !!m.apiKey.trim();
}
