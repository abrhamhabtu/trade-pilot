'use client';
import { create } from 'zustand';
import type { PlaybookStrategy } from '@/components/Playbooks';
import type { RuleSection } from '@/lib/playbookAI';

const KEY = 'tp_playbooks_v1';

type RuleLists = Pick<PlaybookStrategy, RuleSection>;
export interface PlaybookEdit {
  rules: RuleLists;
  updatedAt: string;
  /** Previous versions, newest last — used for undo. */
  history: RuleLists[];
}

interface Persisted {
  custom: PlaybookStrategy[];
  edits: Record<string, PlaybookEdit>;
}

function read(): Persisted {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    return { custom: Array.isArray(v?.custom) ? v.custom : [], edits: v?.edits && typeof v.edits === 'object' ? v.edits : {} };
  } catch {
    return { custom: [], edits: {} };
  }
}
function write(p: Persisted) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage full or blocked — state still works for this session */
  }
}

const rulesOf = (s: PlaybookStrategy): RuleLists => ({
  entryRules: s.entryRules,
  exitRules: s.exitRules,
  riskManagement: s.riskManagement,
  tips: s.tips,
  commonMistakes: s.commonMistakes,
});

/** Custom (AI-created) playbooks and accepted AI edits to any playbook. Saved on this device. */
export const usePlaybookStore = create<
  Persisted & {
    hydrated: boolean;
    hydrate: () => void;
    addCustom: (p: PlaybookStrategy) => void;
    removeCustom: (id: string) => void;
    applyEdit: (base: PlaybookStrategy, rules: RuleLists) => void;
    undoEdit: (id: string) => void;
    resetEdit: (id: string) => void;
  }
>((set, get) => {
  const commit = (patch: Partial<Persisted>) => {
    set(patch);
    const { custom, edits } = get();
    write({ custom, edits });
  };
  return {
    custom: [],
    edits: {},
    hydrated: false,
    hydrate: () => {
      if (get().hydrated) return;
      set({ ...read(), hydrated: true });
    },
    addCustom: (p) => commit({ custom: [...get().custom.filter((c) => c.id !== p.id), p] }),
    removeCustom: (id) => {
      const { [id]: _drop, ...edits } = get().edits;
      commit({ custom: get().custom.filter((c) => c.id !== id), edits });
    },
    applyEdit: (base, rules) => {
      const prev = get().edits[base.id];
      const current = prev?.rules ?? rulesOf(base);
      commit({
        edits: {
          ...get().edits,
          [base.id]: { rules, updatedAt: new Date().toISOString(), history: [...(prev?.history ?? []), current].slice(-10) },
        },
      });
    },
    undoEdit: (id) => {
      const prev = get().edits[id];
      if (!prev) return;
      const history = [...prev.history];
      const last = history.pop();
      const { [id]: _drop, ...rest } = get().edits;
      commit({ edits: history.length && last ? { ...rest, [id]: { ...prev, rules: last, history } } : rest });
    },
    resetEdit: (id) => {
      const { [id]: _drop, ...rest } = get().edits;
      commit({ edits: rest });
    },
  };
});

/** A playbook with the trader's accepted AI edits applied. */
export function withEdits(s: PlaybookStrategy, edits: Record<string, PlaybookEdit>): PlaybookStrategy {
  const e = edits[s.id];
  return e ? { ...s, ...e.rules } : s;
}
