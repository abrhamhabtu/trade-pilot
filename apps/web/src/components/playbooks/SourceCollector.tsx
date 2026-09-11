'use client';
/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, FileText, ImagePlus, Link2, Loader2, X } from 'lucide-react';
import type { AiSource } from '@/lib/playbookAI';

export interface CollectedSource extends AiSource {
  id: string;
  quality?: 'transcript' | 'caption' | 'page' | 'metadata';
  message?: string;
}
export interface CollectedImage {
  id: string;
  title: string;
  dataUrl: string;
}

const QUALITY: Record<string, { label: string; cls: string }> = {
  transcript: { label: 'Full transcript', cls: 'bg-tp-green/10 text-tp-green' },
  page: { label: 'Page text', cls: 'bg-tp-green/10 text-tp-green' },
  caption: { label: 'Caption only', cls: 'bg-tp-yellow/10 text-tp-yellow' },
  metadata: { label: 'Title only', cls: 'bg-tp-red/10 text-tp-red' },
};

const uid = () => Math.random().toString(36).slice(2, 10);

/** Shrink an image to ≤1600px JPEG so it fits comfortably in a model request. */
export async function imageToDataUrl(file: Blob): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function SourceCollector({
  sources,
  setSources,
  images,
  setImages,
  notes,
  setNotes,
  notesPlaceholder,
  extraImages,
}: {
  sources: CollectedSource[];
  setSources: (s: CollectedSource[]) => void;
  images: CollectedImage[];
  setImages: (i: CollectedImage[]) => void;
  notes: string;
  setNotes: (v: string) => void;
  notesPlaceholder?: string;
  /** Optional chooser for screenshots already saved elsewhere (e.g. the playbook Workspace). */
  extraImages?: React.ReactNode;
}) {
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const fetchLink = async () => {
    const url = link.trim();
    if (!url || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/playbooks/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not read that link.');
      const s = data.source;
      const content = [s.author && `Creator: ${s.author}`, s.description && `Caption/description:\n${s.description}`, s.transcript && `Transcript:\n${s.transcript}`]
        .filter(Boolean)
        .join('\n\n');
      setSources([
        ...sources,
        { id: uid(), kind: s.kind, title: s.title, url: s.url, content, quality: s.quality, message: s.message },
      ]);
      setLink('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that link.');
    } finally {
      setBusy(false);
    }
  };

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const next = [...images];
    for (const f of Array.from(files).slice(0, 4 - images.length)) {
      if (!f.type.startsWith('image/')) continue;
      next.push({ id: uid(), title: f.name, dataUrl: await imageToDataUrl(f) });
    }
    setImages(next);
  };

  return (
    <div className="space-y-4">
      {/* Link */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-zinc-300" htmlFor="ai-link">
          Paste a link — YouTube, TikTok, Instagram, X or any article
        </label>
        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl bg-black/30 px-3 ring-1 ring-inset ring-white/[0.09] focus-within:ring-tp-green/40">
            <Link2 className="h-4 w-4 shrink-0 text-zinc-500" />
            <input
              id="ai-link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), fetchLink())}
              placeholder="https://www.youtube.com/watch?v=…"
              className="w-full bg-transparent py-2.5 text-[15px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={fetchLink}
            disabled={!link.trim() || busy}
            className="inline-flex items-center gap-2 rounded-xl bg-white/[0.08] px-4 text-sm font-semibold text-zinc-100 hover:bg-white/[0.12] disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy ? 'Reading…' : 'Read it'}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-tp-red">{error}</p>}
      </div>

      {/* Fetched sources */}
      {sources.length > 0 && (
        <ul className="space-y-2">
          {sources.map((s) => {
            const q = s.quality ? QUALITY[s.quality] : null;
            const expanded = open === s.id;
            return (
              <li key={s.id} className="rounded-xl border border-white/[0.07] bg-black/20">
                <div className="flex items-start gap-3 p-3">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[15px] font-medium text-zinc-100">{s.title}</span>
                      {q && <span className={clsx('rounded-md px-1.5 py-0.5 text-[11px] font-semibold', q.cls)}>{q.label}</span>}
                      <span className="text-xs tabular-nums text-zinc-500">{s.content.length.toLocaleString()} chars</span>
                    </div>
                    {s.message && <p className="mt-0.5 text-sm text-zinc-500">{s.message}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : s.id)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100"
                  >
                    {expanded ? 'Hide' : 'View / edit'}
                    <ChevronDown className={clsx('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${s.title}`}
                    onClick={() => setSources(sources.filter((x) => x.id !== s.id))}
                    className="rounded-md p-1 text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {expanded && (
                  <textarea
                    value={s.content}
                    onChange={(e) => setSources(sources.map((x) => (x.id === s.id ? { ...x, content: e.target.value } : x)))}
                    rows={10}
                    placeholder="Paste the transcript or what the video says…"
                    className="block w-full resize-y border-t border-white/[0.06] bg-transparent p-3 font-mono text-[13px] leading-relaxed text-zinc-300 focus:outline-none"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Notes */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-zinc-300" htmlFor="ai-notes">
          Your notes, a pasted transcript, or rules from a Discord / thread
        </label>
        <textarea
          id="ai-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder={notesPlaceholder}
          className="block w-full resize-y rounded-xl bg-black/30 p-3 text-[15px] leading-relaxed text-zinc-100 ring-1 ring-inset ring-white/[0.09] placeholder:text-zinc-600 focus:outline-none focus:ring-tp-green/40"
        />
      </div>

      {/* Screenshots */}
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-zinc-300">Chart screenshots (optional, up to 4)</span>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={images.length >= 4}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100 disabled:opacity-40"
          >
            <ImagePlus className="h-4 w-4" /> Upload
          </button>
          <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
        </div>
        {extraImages}
        {images.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {images.map((img, i) => (
              <div key={img.id} className="group relative h-20 w-32 overflow-hidden rounded-lg ring-1 ring-white/[0.1]">
                <img src={img.dataUrl} alt={img.title} className="h-full w-full object-cover" />
                <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 text-[11px] text-zinc-100">{i + 1}</span>
                <button
                  type="button"
                  aria-label={`Remove ${img.title}`}
                  onClick={() => setImages(images.filter((x) => x.id !== img.id))}
                  className="absolute right-1 top-1 rounded bg-black/70 p-0.5 text-zinc-200 opacity-0 group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Flatten collected material into the API payload. */
export function toPayload(sources: CollectedSource[], notes: string, images: CollectedImage[]) {
  return {
    sources: [
      ...(notes.trim() ? [{ kind: 'note' as const, title: 'Trader notes', content: notes.trim() }] : []),
      ...sources.map(({ kind, title, url, content }) => ({ kind, title, url, content })),
    ],
    images: images.map((i) => i.dataUrl),
  };
}
