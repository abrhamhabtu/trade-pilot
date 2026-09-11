'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { AlertTriangle, ArrowLeft, CircleHelp, Loader2, Save, Sparkles, Wand2, X } from 'lucide-react';
import type { PlaybookStrategy } from '../Playbooks';
import type { DraftPlaybook } from '@/lib/playbookAI';
import { modelReady, useModelStore } from '@/lib/pilot/modelStore';
import { usePlaybookStore } from '@/store/playbookStore';
import { AiModelGate } from './AiModelGate';
import { Callout } from './PlaybookAI';
import { SourceCollector, toPayload, type CollectedImage, type CollectedSource } from './SourceCollector';

const CONFIDENCE = {
  high: 'bg-tp-green/10 text-tp-green',
  medium: 'bg-tp-yellow/10 text-tp-yellow',
  low: 'bg-tp-red/10 text-tp-red',
};

function toStrategy(d: DraftPlaybook, sources: CollectedSource[]): PlaybookStrategy {
  const id = `custom-${Date.now().toString(36)}`;
  const primary = sources.find((s) => s.url);
  return {
    id,
    name: d.name,
    tagline: d.tagline,
    description: d.description,
    difficulty: d.difficulty,
    timeframe: d.timeframe,
    winRate: 0,
    riskReward: d.riskReward,
    marketCondition: d.marketCondition,
    overview: d.overview,
    entryRules: d.entryRules,
    exitRules: d.exitRules,
    riskManagement: d.riskManagement,
    examples: d.examples,
    tips: d.tips,
    commonMistakes: d.commonMistakes,
    anatomy: d.anatomy.length === 4 ? d.anatomy : undefined,
    glossary: d.glossary.length ? d.glossary : undefined,
    sizing: d.sizing,
    tvSetup: d.tvSetup.tools.length ? d.tvSetup : undefined,
    sourceClaims: d.sourceClaims,
    openQuestions: d.openQuestions,
    custom: true,
    createdAt: new Date().toISOString(),
    source: primary ? { url: primary.url, title: primary.title } : undefined,
    seed: {
      videos: sources
        .filter((s) => s.url)
        .map((s, i) => ({ id: `${id}-v${i}`, title: s.title, url: s.url!, notes: 'Source used to build this playbook with Pilot AI.' })),
    },
  };
}

export function CreatePlaybook({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const model = useModelStore((s) => s.model);
  const addCustom = usePlaybookStore((s) => s.addCustom);
  const [sources, setSources] = useState<CollectedSource[]>([]);
  const [images, setImages] = useState<CollectedImage[]>([]);
  const [notes, setNotes] = useState('');
  const [intent, setIntent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<DraftPlaybook | null>(null);

  const build = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/playbooks/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...model, mode: 'create', intent, ...toPayload(sources, notes, images) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'The AI request failed.');
      setDraft(data.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The AI request failed.');
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!draft) return;
    const s = toStrategy(draft, sources);
    addCustom(s);
    onCreated(s.id);
  };

  const hasMaterial = sources.length > 0 || notes.trim() || images.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8" role="dialog" aria-modal="true" aria-label="Create a playbook with AI">
      <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0f1a2b] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-white/[0.06] p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-tp-green/25 to-tp-blue/20 ring-1 ring-inset ring-white/10">
              <Wand2 className="h-5 w-5 text-tp-green" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-tp-green">
                Pilot AI · {draft ? 'Step 2 of 2 — review' : 'Step 1 of 2 — material'}
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-zinc-50">
                {draft ? draft.name : 'Build a playbook from a video or idea'}
              </h2>
              {!draft && (
                <p className="mt-1 text-[15px] text-zinc-400">
                  Paste a link and Pilot reads the transcript, reverse-engineers the rules, and turns them into a playbook for micros — anatomy,
                  checklist, sizing and TradingView setup included.
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </header>

        {!draft ? (
          <div className="space-y-5 p-5 sm:p-7">
            <AiModelGate />
            <SourceCollector
              sources={sources}
              setSources={setSources}
              images={images}
              setImages={setImages}
              notes={notes}
              setNotes={setNotes}
              notesPlaceholder="Describe the strategy in your own words, or paste a transcript / post…"
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300" htmlFor="ai-intent">
                Anything specific? (optional)
              </label>
              <input
                id="ai-intent"
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                placeholder="e.g. I trade MNQ in the NY morning on a 50k eval, max $250 risk"
                className="block w-full rounded-xl bg-black/30 px-3 py-2.5 text-[15px] text-zinc-100 ring-1 ring-inset ring-white/[0.09] placeholder:text-zinc-600 focus:outline-none focus:ring-tp-green/40"
              />
            </div>
            {error && <p className="text-sm text-tp-red">{error}</p>}
            <button
              onClick={build}
              disabled={!modelReady(model) || !hasMaterial || busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-tp-green px-4 py-3 text-[15px] font-semibold text-[#0D1628] hover:brightness-110 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {busy ? 'Reverse-engineering the strategy… (up to a minute)' : 'Build my playbook'}
            </button>
          </div>
        ) : (
          <DraftPreview draft={draft} />
        )}

        {draft && (
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] p-5 sm:px-7">
            <button onClick={() => setDraft(null)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100">
              <ArrowLeft className="h-4 w-4" /> Back to material
            </button>
            <div className="flex gap-2">
              <button onClick={build} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.1] px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-white/[0.05] disabled:opacity-40">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Regenerate
              </button>
              <button onClick={save} className="inline-flex items-center gap-1.5 rounded-xl bg-tp-green px-4 py-2.5 text-sm font-semibold text-[#0D1628] hover:brightness-110">
                <Save className="h-4 w-4" /> Save playbook
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}

function DraftPreview({ draft: d }: { draft: DraftPlaybook }) {
  return (
    <div className="space-y-5 p-5 sm:p-7">
      <div className="flex flex-wrap items-center gap-2">
        <span className={clsx('rounded-full px-2.5 py-1 text-xs font-semibold', CONFIDENCE[d.confidence])}>{d.confidence} confidence</span>
        <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs text-zinc-300">{d.difficulty}</span>
        <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs text-zinc-300">{d.timeframe}</span>
        <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs text-zinc-300">Target {d.riskReward}</span>
        <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs text-zinc-300">
          {d.sizing.symbol} · {d.sizing.stopPoints}-pt stop
        </span>
      </div>
      {d.tagline && <p className="text-lg font-medium text-tp-green">“{d.tagline}”</p>}
      <p className="text-[15px] leading-relaxed text-zinc-300">{d.description}</p>

      {d.anatomy.length === 4 && (
        <div className="grid gap-2 sm:grid-cols-4">
          {d.anatomy.map((a, i) => (
            <div key={i} className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {['Context', 'Confirmation', 'Invalidation', 'Objective'][i]}
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-100">{a.title}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <List title="Entry checklist" items={d.entryRules} numbered />
        <List title="Exit plan" items={d.exitRules} />
        <List title="Risk rules" items={d.riskManagement} />
      </div>

      {d.sourceClaims.length > 0 && <Callout icon={AlertTriangle} tone="red" title="Creator claims (unverified)" items={d.sourceClaims} />}
      {d.openQuestions.length > 0 && <Callout icon={CircleHelp} tone="blue" title="Decide before you trade it" items={d.openQuestions} />}
      <p className="text-xs text-zinc-500">
        After saving you get the full page: anatomy, glossary, sizer, TradingView setup and the Improve panel. You can edit it with AI any time.
      </p>
    </div>
  );
}

function List({ title, items, numbered }: { title: string; items: string[]; numbered?: boolean }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/15 p-4">
      <div className="mb-2 text-sm font-semibold text-zinc-100">{title}</div>
      <ul className="space-y-2">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-zinc-300">
            <span className="shrink-0 text-zinc-500">{numbered ? `${i + 1}.` : '•'}</span>
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
