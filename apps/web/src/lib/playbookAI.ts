// Shared types + sanitizers for the playbook AI (used by the API route and the UI).

export type RuleSection = "entryRules" | "exitRules" | "riskManagement" | "tips" | "commonMistakes";
export const RULE_SECTIONS: { id: RuleSection; label: string }[] = [
  { id: "entryRules", label: "Entry rules" },
  { id: "exitRules", label: "Exit rules" },
  { id: "riskManagement", label: "Risk rules" },
  { id: "tips", label: "Edge tips" },
  { id: "commonMistakes", label: "Mistakes" },
];

export interface AiSource {
  kind: "note" | "youtube" | "tiktok" | "instagram" | "x" | "web" | "video";
  title: string;
  url?: string;
  content: string;
}

export interface ProposedChange {
  id: string;
  section: RuleSection;
  action: "add" | "replace" | "remove";
  number?: number; // 1-based rule number for replace/remove
  text?: string;
  reason: string;
  evidence?: string;
  confidence: "high" | "medium" | "low";
}

export interface ImproveResult {
  summary: string;
  changes: ProposedChange[];
  questions: string[];
  warnings: string[];
}

export interface DraftPlaybook {
  name: string;
  tagline: string;
  description: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  timeframe: string;
  marketCondition: string;
  riskReward: string;
  overview: string;
  glossary: { term: string; meaning: string }[];
  anatomy: { title: string; points: string[] }[];
  entryRules: string[];
  exitRules: string[];
  riskManagement: string[];
  examples: { title: string; description: string; setup: string; entry: string; exit: string; result: string }[];
  tips: string[];
  commonMistakes: string[];
  sizing: { symbol: string; stopPoints: number; note: string };
  tvSetup: { timeframe: string; tools: { name: string; how: string }[]; alerts: string };
  sourceClaims: string[];
  openQuestions: string[];
  confidence: "high" | "medium" | "low";
}

// ─── Sanitizers (model output is untrusted) ─────────────────────────────────

const str = (v: unknown, max = 600) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strs = (v: unknown, n = 10, max = 400) =>
  Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : [];
const oneOf = <T extends string>(v: unknown, opts: readonly T[], d: T): T =>
  opts.includes(v as T) ? (v as T) : d;
const SECTIONS = RULE_SECTIONS.map((s) => s.id);
const MICROS = ["MNQ", "MES", "MYM", "M2K", "MGC", "MCL", "NQ", "ES"] as const;

/** Pull the first JSON object out of a model reply (handles ```json fences and prose). */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The model didn't return JSON. Try again or pick a stronger model.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

export function sanitizeImprove(raw: unknown): ImproveResult {
  const r = (raw || {}) as Record<string, unknown>;
  const changes = (Array.isArray(r.changes) ? r.changes : [])
    .map((c: Record<string, unknown>, i: number): ProposedChange | null => {
      const section = oneOf(c?.section, SECTIONS, "entryRules");
      const action = oneOf(c?.action, ["add", "replace", "remove"] as const, "add");
      const text = str(c?.text, 500);
      const number = Number(c?.number);
      if (action !== "remove" && !text) return null;
      if (action !== "add" && !(number >= 1)) return null;
      return {
        id: `c${i}`,
        section,
        action,
        number: action === "add" ? undefined : Math.floor(number),
        text: action === "remove" ? undefined : text,
        reason: str(c?.reason, 500) || "Suggested improvement.",
        evidence: str(c?.evidence, 300) || undefined,
        confidence: oneOf(c?.confidence, ["high", "medium", "low"] as const, "medium"),
      };
    })
    .filter((c): c is ProposedChange => !!c)
    .slice(0, 12);
  return {
    summary: str(r.summary, 800),
    changes,
    questions: strs(r.questions, 6),
    warnings: strs(r.warnings, 6),
  };
}

export function sanitizeDraft(raw: unknown): DraftPlaybook {
  const r = (raw || {}) as Record<string, any>;
  const anatomy = (Array.isArray(r.anatomy) ? r.anatomy : [])
    .map((a: any) => ({ title: str(a?.title, 120), points: strs(a?.points, 4, 300) }))
    .filter((a: { title: string }) => a.title)
    .slice(0, 4);
  const draft: DraftPlaybook = {
    name: str(r.name, 80) || "Untitled playbook",
    tagline: str(r.tagline, 90),
    description: str(r.description, 400),
    difficulty: oneOf(r.difficulty, ["Beginner", "Intermediate", "Advanced"] as const, "Intermediate"),
    timeframe: str(r.timeframe, 40) || "1m - 5m",
    marketCondition: str(r.marketCondition, 80) || "Intraday futures",
    riskReward: /^1:\d+(\.\d+)?$/.test(str(r.riskReward)) ? str(r.riskReward) : "1:2",
    overview: str(r.overview, 3000),
    glossary: (Array.isArray(r.glossary) ? r.glossary : [])
      .map((g: any) => ({ term: str(g?.term, 40), meaning: str(g?.meaning, 300) }))
      .filter((g: { term: string; meaning: string }) => g.term && g.meaning)
      .slice(0, 8),
    anatomy: anatomy.length === 4 ? anatomy : [],
    entryRules: strs(r.entryRules, 8),
    exitRules: strs(r.exitRules, 6),
    riskManagement: strs(r.riskManagement, 6),
    examples: (Array.isArray(r.examples) ? r.examples : [])
      .map((e: any) => ({
        title: str(e?.title, 100),
        description: str(e?.description, 300),
        setup: str(e?.setup, 400),
        entry: str(e?.entry, 300),
        exit: str(e?.exit, 300),
        result: str(e?.result, 120) || "Illustrative",
      }))
      .filter((e: { title: string }) => e.title)
      .slice(0, 3),
    tips: strs(r.tips, 8),
    commonMistakes: strs(r.commonMistakes, 8),
    sizing: {
      symbol: oneOf(r.sizing?.symbol, MICROS, "MNQ"),
      stopPoints: Math.min(500, Math.max(0.25, Number(r.sizing?.stopPoints) || 10)),
      note: str(r.sizing?.note, 200),
    },
    tvSetup: {
      timeframe: str(r.tvSetup?.timeframe, 80),
      tools: (Array.isArray(r.tvSetup?.tools) ? r.tvSetup.tools : [])
        .map((t: any) => ({ name: str(t?.name, 60), how: str(t?.how, 400) }))
        .filter((t: { name: string }) => t.name)
        .slice(0, 4),
      alerts: str(r.tvSetup?.alerts, 300),
    },
    sourceClaims: strs(r.sourceClaims, 6, 300),
    openQuestions: strs(r.openQuestions, 6, 300),
    confidence: oneOf(r.confidence, ["high", "medium", "low"] as const, "medium"),
  };
  if (!draft.entryRules.length) throw new Error("The model couldn't find clear entry rules in that material.");
  return draft;
}

/** Apply accepted changes to rule lists. Numbers refer to the ORIGINAL list. */
export function applyChanges<T extends Record<RuleSection, string[]>>(base: T, accepted: ProposedChange[]): Pick<T, RuleSection> {
  const out = {} as Record<RuleSection, string[]>;
  for (const section of SECTIONS) {
    const rows: (string | null)[] = [...(base[section] || [])];
    const adds: string[] = [];
    for (const c of accepted.filter((c) => c.section === section)) {
      const i = (c.number ?? 0) - 1;
      if (c.action === "add" && c.text) adds.push(c.text);
      else if (i >= 0 && i < rows.length) rows[i] = c.action === "remove" ? null : c.text ?? rows[i];
    }
    out[section] = [...rows.filter((r): r is string => r !== null), ...adds];
  }
  return out as Pick<T, RuleSection>;
}
