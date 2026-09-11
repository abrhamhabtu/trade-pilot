'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import {
  AlertTriangle,
  Check,
  CircleHelp,
  Loader2,
  Plus,
  RotateCcw,
  Sparkles,
  Undo2,
  Video,
  Wand2,
  X,
} from 'lucide-react';
import type { PlaybookStrategy } from '../Playbooks';
import { readLibrary, type Evidence, type VideoReference } from '@/lib/playbookLibrary';
import { applyChanges, RULE_SECTIONS, type ImproveResult, type ProposedChange } from '@/lib/playbookAI';
import { modelReady, useModelStore } from '@/lib/pilot/modelStore';
import { usePlaybookStore } from '@/store/playbookStore';
import { AiModelGate } from './AiModelGate';
import { imageToDataUrl, SourceCollector, toPayload, type CollectedImage, type CollectedSource } from './SourceCollector';

const GOALS = [
  'Sharpen my entry trigger',
  'Make exits more consistent',
  'Tighten risk for a prop eval',
  'Add no-trade filters',
];

async function asDataUrl(src: string) {
  if (src.startsWith('data:image/')) return src;
  const blob = await fetch(src).then((r) => r.blob());
  return imageToDataUrl(blob);
}

export function PlaybookAI({
  strategy,
  base,
  screenshots,
}: {
  strategy: PlaybookStrategy; // with edits applied
  base: PlaybookStrategy; // original, for the edit history
  screenshots: Evidence[];
}) {
  const model = useModelStore((s) => s.model);
  const { edits, applyEdit, undoEdit, resetEdit } = usePlaybookStore();
  const edit = edits[strategy.id];

  const [sources, setSources] = useState<CollectedSource[]>([]);
  const [images, setImages] = useState<CollectedImage[]>([]);
  const [notes, setNotes] = useState('');
  const [goals, setGoals] = useState<string[]>([]);
  const [videos, setVideos] = useState<VideoReference[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImproveResult | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState(0);

  useEffect(() => {
    readLibrary(strategy.id).then((lib) => setVideos(lib.videos)).catch(() => setVideos([]));
  }, [strategy.id]);

  const addSavedVideo = async (v: VideoReference) => {
    setError('');
    try {
      const res = await fetch('/api/playbooks/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: v.url }),
      });
      const data = await res.json();
      const s = data.source;
      setSources([
        ...sources,
        {
          id: v.id,
          kind: s?.kind || 'video',
          title: s?.title || v.title,
          url: v.url,
          content: [v.notes && `Trader's notes: ${v.notes}`, s?.description && `Caption/description:\n${s.description}`, s?.transcript && `Transcript:\n${s.transcript}`]
            .filter(Boolean)
            .join('\n\n'),
          quality: s?.quality,
          message: s?.message || data.error,
        },
      ]);
    } catch {
      setError(`Couldn't read "${v.title}".`);
    }
  };

  const addScreenshot = async (e: Evidence) => {
    if (images.length >= 4 || images.some((i) => i.id === e.id)) return;
    try {
      setImages([...images, { id: e.id, title: e.title, dataUrl: await asDataUrl(e.image) }]);
    } catch {
      setError(`Couldn't load "${e.title}".`);
    }
  };

  const run = async () => {
    setBusy(true);
    setError('');
    setResult(null);
    setApplied(0);
    try {
      const payload = toPayload(sources, notes, images);
      const res = await fetch('/api/playbooks/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...model,
          mode: 'improve',
          intent: goals.join('; '),
          strategy,
          ...payload,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'The AI request failed.');
      setResult(data.result);
      setAccepted(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The AI request failed.');
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!result) return;
    const chosen = result.changes.filter((c) => accepted.has(c.id));
    applyEdit(base, applyChanges(strategy, chosen));
    setApplied(chosen.length);
    // Rule numbers refer to the pre-edit lists, so leftover suggestions would now point at the wrong rules.
    setResult({ ...result, changes: [] });
    setAccepted(new Set());
  };

  const hasMaterial = sources.length > 0 || notes.trim() || images.length > 0;
  const ready = modelReady(model);
  const unusedVideos = videos.filter((v) => !sources.some((s) => s.id === v.id));
  const unusedShots = screenshots.filter((s) => !images.some((i) => i.id === s.id));

  return (
    <section
      id="pilot-ai"
      className="scroll-mt-36 overflow-hidden rounded-2xl border border-tp-green/20 bg-tp-card"
      style={{ backgroundImage: 'radial-gradient(60% 50% at 100% 0%, rgba(0,214,143,0.08) 0%, transparent 70%)' }}
    >
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.06] p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-tp-green/25 to-tp-blue/20 ring-1 ring-inset ring-white/10">
            <Sparkles className="h-5 w-5 text-tp-green" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-tp-green">Pilot AI</div>
            <h2 className="text-xl font-semibold tracking-tight text-zinc-50">Improve this playbook</h2>
            <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
              Drop in anything you find about this setup — videos, notes, chart screenshots. Pilot reads it against the current rules and suggests
              sharper entries, exits and risk. You approve every change.
            </p>
          </div>
        </div>
        {edit && (
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-sm text-zinc-400">
            <Wand2 className="h-4 w-4 text-tp-green" />
            AI edits applied · {new Date(edit.updatedAt).toLocaleDateString()}
            <button onClick={() => undoEdit(strategy.id)} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-zinc-300 hover:bg-white/[0.06]">
              <Undo2 className="h-3.5 w-3.5" /> Undo
            </button>
            <button onClick={() => resetEdit(strategy.id)} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-zinc-300 hover:bg-white/[0.06]">
              <RotateCcw className="h-3.5 w-3.5" /> Original
            </button>
          </div>
        )}
      </header>

      <div className="grid gap-0 xl:grid-cols-[1fr_1.1fr]">
        {/* Inputs */}
        <div className="space-y-5 border-b border-white/[0.06] p-5 sm:p-7 xl:border-b-0 xl:border-r">
          <AiModelGate />

          <div>
            <div className="mb-1.5 text-sm font-medium text-zinc-300">What should Pilot focus on?</div>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => {
                const on = goals.includes(g);
                return (
                  <button
                    key={g}
                    onClick={() => setGoals(on ? goals.filter((x) => x !== g) : [...goals, g])}
                    className={clsx(
                      'rounded-full border px-3 py-1.5 text-sm',
                      on ? 'border-tp-green/40 bg-tp-green/10 text-tp-green' : 'border-white/[0.08] text-zinc-400 hover:text-zinc-100',
                    )}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>

          {unusedVideos.length > 0 && (
            <div>
              <div className="mb-1.5 text-sm font-medium text-zinc-300">Videos saved to this playbook</div>
              <div className="flex flex-wrap gap-2">
                {unusedVideos.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => addSavedVideo(v)}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-white/[0.08] bg-black/20 px-2.5 py-1.5 text-sm text-zinc-300 hover:border-tp-green/30"
                  >
                    <Video className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                    <span className="truncate">{v.title}</span>
                    <Plus className="h-3.5 w-3.5 shrink-0 text-tp-green" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <SourceCollector
            sources={sources}
            setSources={setSources}
            images={images}
            setImages={setImages}
            notes={notes}
            setNotes={setNotes}
            notesPlaceholder="e.g. My losers all came after 11:00. The video says wait for the second touch of VAL…"
            extraImages={
              unusedShots.length > 0 && images.length < 4 ? (
                <div className="flex flex-wrap gap-2">
                  {unusedShots.slice(0, 6).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => addScreenshot(s)}
                      className="group relative h-14 w-24 overflow-hidden rounded-lg opacity-70 ring-1 ring-white/[0.1] hover:opacity-100"
                      title={`Add "${s.title}"`}
                    >
                      <img src={s.image} alt={s.title} className="h-full w-full object-cover" />
                      <span className="absolute inset-0 grid place-items-center bg-black/40">
                        <Plus className="h-4 w-4 text-zinc-100" />
                      </span>
                    </button>
                  ))}
                </div>
              ) : null
            }
          />

          <button
            onClick={run}
            disabled={!ready || !hasMaterial || busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-tp-green px-4 py-3 text-[15px] font-semibold text-[#0D1628] hover:brightness-110 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {busy ? 'Pilot is studying the material…' : 'Suggest improvements'}
          </button>
          {!ready && <p className="-mt-2 text-center text-xs text-zinc-500">Connect a model above to enable.</p>}
          {error && <p className="text-sm text-tp-red">{error}</p>}
        </div>

        {/* Results */}
        <div className="p-5 sm:p-7">
          {!result && !busy && (
            <div className="grid h-full min-h-[240px] place-items-center text-center">
              <div className="max-w-sm">
                <Sparkles className="mx-auto h-8 w-8 text-zinc-600" />
                <h3 className="mt-3 text-base font-semibold text-zinc-200">Suggestions show up here</h3>
                <p className="mt-1 text-[15px] text-zinc-500">
                  Each one is a single edit — replace, add or remove a rule — with the evidence behind it. Nothing changes until you accept.
                </p>
                {applied > 0 && <p className="mt-3 text-sm font-medium text-tp-green">✓ Applied {applied} change{applied === 1 ? '' : 's'} to the playbook above.</p>}
              </div>
            </div>
          )}
          {busy && (
            <div className="grid h-full min-h-[240px] place-items-center text-center text-[15px] text-zinc-400">
              <div>
                <Loader2 className="mx-auto h-7 w-7 animate-spin text-tp-green" />
                <p className="mt-3">Comparing your material with {strategy.entryRules.length + strategy.exitRules.length + strategy.riskManagement.length} rules…</p>
                <p className="mt-1 text-sm text-zinc-500">Long transcripts can take a minute.</p>
              </div>
            </div>
          )}
          {result && (
            <Proposals
              result={result}
              strategy={strategy}
              accepted={accepted}
              setAccepted={setAccepted}
              onApply={apply}
              applied={applied}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function Proposals({
  result,
  strategy,
  accepted,
  setAccepted,
  onApply,
  applied,
}: {
  result: ImproveResult;
  strategy: PlaybookStrategy;
  accepted: Set<string>;
  setAccepted: (s: Set<string>) => void;
  onApply: () => void;
  applied: number;
}) {
  const toggle = (id: string) => {
    const next = new Set(accepted);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setAccepted(next);
  };
  return (
    <div className="space-y-4">
      {applied > 0 && <p className="rounded-lg bg-tp-green/10 px-3 py-2 text-sm font-medium text-tp-green">✓ Applied {applied} change{applied === 1 ? '' : 's'}.</p>}
      {result.summary && <p className="text-[15px] leading-relaxed text-zinc-200">{result.summary}</p>}

      {result.changes.length > 0 ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-zinc-500">
              {result.changes.length} suggestion{result.changes.length === 1 ? '' : 's'} · {accepted.size} selected
            </span>
            <button
              onClick={() => setAccepted(accepted.size === result.changes.length ? new Set() : new Set(result.changes.map((c) => c.id)))}
              className="text-sm font-medium text-zinc-400 hover:text-zinc-100"
            >
              {accepted.size === result.changes.length ? 'Clear' : 'Select all'}
            </button>
          </div>
          <ul className="space-y-2.5">
            {result.changes.map((c) => (
              <ChangeCard key={c.id} change={c} strategy={strategy} on={accepted.has(c.id)} toggle={() => toggle(c.id)} />
            ))}
          </ul>
          <button
            onClick={onApply}
            disabled={!accepted.size}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-tp-green px-4 py-3 text-[15px] font-semibold text-[#0D1628] hover:brightness-110 disabled:opacity-40"
          >
            <Check className="h-4 w-4" />
            Apply {accepted.size || ''} selected change{accepted.size === 1 ? '' : 's'}
          </button>
        </>
      ) : (
        <p className="text-[15px] text-zinc-400">
          {applied > 0
            ? 'Run it again for a fresh set of suggestions against the updated rules.'
            : 'No rule changes suggested — the playbook already covers this material.'}
        </p>
      )}

      {result.warnings.length > 0 && (
        <Callout icon={AlertTriangle} tone="red" title="Watch out" items={result.warnings} />
      )}
      {result.questions.length > 0 && (
        <Callout icon={CircleHelp} tone="blue" title="Decide before you trade it" items={result.questions} />
      )}
    </div>
  );
}

function ChangeCard({ change: c, strategy, on, toggle }: { change: ProposedChange; strategy: PlaybookStrategy; on: boolean; toggle: () => void }) {
  const sectionLabel = RULE_SECTIONS.find((s) => s.id === c.section)?.label ?? c.section;
  const before = c.number ? strategy[c.section]?.[c.number - 1] : undefined;
  const badge =
    c.action === 'add'
      ? { label: `Add to ${sectionLabel}`, cls: 'bg-tp-green/10 text-tp-green' }
      : c.action === 'remove'
        ? { label: `Remove ${sectionLabel} #${c.number}`, cls: 'bg-tp-red/10 text-tp-red' }
        : { label: `Rewrite ${sectionLabel} #${c.number}`, cls: 'bg-tp-blue/10 text-tp-blue' };
  return (
    <li>
      <button
        onClick={toggle}
        aria-pressed={on}
        className={clsx(
          'w-full rounded-xl border p-4 text-left transition-colors',
          on ? 'border-tp-green/40 bg-tp-green/[0.06]' : 'border-white/[0.07] bg-black/15 hover:border-white/[0.14]',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className={clsx('rounded-md px-2 py-0.5 text-xs font-semibold', badge.cls)}>{badge.label}</span>
          <span className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">{c.confidence} confidence</span>
            <span className={clsx('grid h-5 w-5 place-items-center rounded-md', on ? 'bg-tp-green text-[#0D1628]' : 'ring-1 ring-inset ring-white/20')}>
              {on && <Check className="h-3.5 w-3.5" />}
            </span>
          </span>
        </div>
        {before && (
          <p className={clsx('mt-2.5 text-[15px] leading-relaxed text-zinc-500', c.action !== 'add' && 'line-through decoration-zinc-600')}>
            {before}
          </p>
        )}
        {c.text && <p className="mt-2 text-[15px] leading-relaxed text-zinc-100">{c.text}</p>}
        <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">
          <span className="font-medium text-zinc-300">Why: </span>
          {c.reason}
          {c.evidence && <span className="ml-1 rounded bg-white/[0.06] px-1.5 py-0.5 text-xs text-zinc-300">{c.evidence}</span>}
        </p>
      </button>
    </li>
  );
}

export function Callout({ icon: Icon, tone, title, items }: { icon: typeof X; tone: 'red' | 'blue'; title: string; items: string[] }) {
  return (
    <div className={clsx('rounded-xl border p-4', tone === 'red' ? 'border-tp-red/20 bg-tp-red/[0.05]' : 'border-tp-blue/20 bg-tp-blue/[0.05]')}>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-100">
        <Icon className={clsx('h-4 w-4', tone === 'red' ? 'text-tp-red' : 'text-tp-blue')} />
        {title}
      </div>
      <ul className="space-y-1.5">
        {items.map((q) => (
          <li key={q} className="text-[15px] leading-relaxed text-zinc-300">
            • {q}
          </li>
        ))}
      </ul>
    </div>
  );
}
