'use client';

import { useEffect, useState } from 'react';
import { Cpu, KeyRound, Pencil } from 'lucide-react';
import { PROVIDERS, type Provider } from '@/lib/pilot/models';
import { modelReady, useModelStore } from '@/lib/pilot/modelStore';

const REMOTE = (Object.keys(PROVIDERS) as Provider[]).filter((p) => p !== 'local');

/**
 * Shows which model the playbook AI will use (shared with Pilot AI → Settings)
 * and lets the trader connect one inline. The key lives in memory only.
 */
export function AiModelGate() {
  const { model, setModel, hydrate } = useModelStore();
  const [editing, setEditing] = useState(false);
  useEffect(() => hydrate(), [hydrate]);
  const ready = modelReady(model);

  if (ready && !editing)
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-400">
        <Cpu className="h-4 w-4 text-tp-green" />
        Using <span className="font-medium text-zinc-100">{model.model}</span> via {PROVIDERS[model.provider].label}
        <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200">
          <Pencil className="h-3 w-3" /> Change
        </button>
      </div>
    );

  const provider = model.provider === 'local' ? 'openrouter' : model.provider;
  return (
    <div className="rounded-xl border border-tp-yellow/25 bg-tp-yellow/[0.05] p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
        <KeyRound className="h-4 w-4 text-tp-yellow" />
        {model.provider !== 'local' && model.model && !model.apiKey ? 'Re-enter your API key' : 'Connect an AI model'}
      </div>
      <p className="mt-1 text-sm text-zinc-400">
        Same model as Pilot AI. The key stays in this tab&apos;s memory only — it&apos;s never saved to disk.
        {' '}For long transcripts and screenshots, pick a strong vision model (e.g. a Claude or GPT model on OpenRouter).
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[160px_1fr_1fr]">
        <select
          aria-label="Provider"
          value={provider}
          onChange={(e) => setModel({ ...model, provider: e.target.value as Provider })}
          className="rounded-lg bg-black/30 px-3 py-2 text-sm text-zinc-100 ring-1 ring-inset ring-white/[0.1] focus:outline-none"
        >
          {REMOTE.map((p) => (
            <option key={p} value={p}>
              {PROVIDERS[p].label}
            </option>
          ))}
        </select>
        <input
          aria-label="Model ID"
          placeholder="Model ID, e.g. anthropic/claude-sonnet-5"
          value={model.model}
          onChange={(e) => setModel({ ...model, provider, model: e.target.value })}
          className="rounded-lg bg-black/30 px-3 py-2 text-sm text-zinc-100 ring-1 ring-inset ring-white/[0.1] placeholder:text-zinc-600 focus:outline-none"
        />
        <input
          aria-label="API key"
          type="password"
          autoComplete="off"
          placeholder={provider === 'ollama' ? 'No key needed' : 'API key'}
          value={model.apiKey}
          onChange={(e) => setModel({ ...model, provider, apiKey: e.target.value })}
          className="rounded-lg bg-black/30 px-3 py-2 text-sm text-zinc-100 ring-1 ring-inset ring-white/[0.1] placeholder:text-zinc-600 focus:outline-none"
        />
      </div>
      {provider === 'custom' && (
        <input
          aria-label="Base URL"
          placeholder="https://your-endpoint/v1"
          value={model.baseUrl}
          onChange={(e) => setModel({ ...model, provider, baseUrl: e.target.value })}
          className="mt-2 w-full rounded-lg bg-black/30 px-3 py-2 text-sm text-zinc-100 ring-1 ring-inset ring-white/[0.1] placeholder:text-zinc-600 focus:outline-none"
        />
      )}
      {ready && (
        <button onClick={() => setEditing(false)} className="mt-3 rounded-lg bg-tp-green px-3 py-1.5 text-sm font-semibold text-[#0D1628]">
          Done
        </button>
      )}
    </div>
  );
}
