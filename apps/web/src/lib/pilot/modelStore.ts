"use client";
import { create } from "zustand";
import { DEFAULT_MODEL, PROVIDERS, type ModelConfig } from "@/lib/pilot/models";

const KEY = "pilot_model_v1";

/**
 * The model chosen in Pilot AI → Settings, shared with Playbooks.
 *
 * The whole config, API key included, persists in this browser's localStorage
 * until the trader clears it, so a reload does not cost them the key. That is
 * a deliberate trade: the key is readable by anything with access to this
 * origin and this device, and `forgetKey` is the way back out.
 */
export const useModelStore = create<{
  model: ModelConfig;
  hydrated: boolean;
  hydrate: () => void;
  setModel: (value: ModelConfig) => void;
  forgetKey: () => void;
}>((set, get) => ({
  model: DEFAULT_MODEL,
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) return;
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (saved && Object.hasOwn(PROVIDERS, saved.provider))
        set({ model: { ...DEFAULT_MODEL, ...saved } });
    } catch {
      /* keep default */
    }
    set({ hydrated: true });
  },
  setModel: (value) => {
    set({ model: value });
    try {
      localStorage.setItem(KEY, JSON.stringify(value));
    } catch {
      /* in-memory config still works */
    }
  },
  forgetKey: () => {
    const model = { ...get().model, apiKey: "" };
    set({ model });
    try {
      localStorage.setItem(KEY, JSON.stringify(model));
    } catch {
      /* the in-memory clear is what matters */
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
