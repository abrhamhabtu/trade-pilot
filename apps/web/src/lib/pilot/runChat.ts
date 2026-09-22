// Drives one question to an answer: stream the model's reply, run any lookups
// it asks for against the local journal, send the results back, repeat.
// Returns the full transcript, lookups included, so a later question (or a
// resumed chat) continues from exactly what the model saw.

import type { ModelConfig } from '@/lib/pilot/models';
import type { ChatTurn, StreamEvent } from '@/lib/pilot/chatTypes';
import { runPilotTool, type ToolContext } from '@/lib/pilot/tools';
import { toolLabel } from '@/lib/pilot/toolDefs';

const MAX_ROUNDS = 6;

export interface TurnCallbacks {
  /** The visible answer so far, across lookup rounds. */
  onText: (text: string) => void;
  /** What Pilot is doing right now: 'Thinking…', a lookup label, or null. */
  onStatus: (status: string | null) => void;
}

async function oneRound(config: ModelConfig, turns: ChatTurn[], context: unknown, signal: AbortSignal, onDelta: (d: string) => void, onThinking: () => void) {
  const response = await fetch('/api/pilot/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...config, stream: true, messages: turns, context }),
    signal,
  });
  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Could not reach the model.');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let done: Extract<StreamEvent, { t: 'done' }> | null = null;
  for (;;) {
    const { value, done: end } = await reader.read();
    if (end) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as StreamEvent;
      if (event.t === 'text') onDelta(event.v);
      else if (event.t === 'thinking') onThinking();
      else if (event.t === 'error') throw new Error(event.v);
      else if (event.t === 'done') done = event;
    }
  }
  if (!done) throw new Error('The answer was cut off. Try again.');
  return done;
}

export async function runPilotTurn(args: {
  config: ModelConfig;
  history: ChatTurn[];
  question: string;
  context: unknown;
  toolContext: ToolContext;
  signal: AbortSignal;
} & TurnCallbacks): Promise<ChatTurn[]> {
  const turns: ChatTurn[] = [...args.history, { role: 'user', content: args.question }];
  let shown = '';

  for (let round = 0; round < MAX_ROUNDS; round++) {
    let roundText = '';
    args.onStatus('Thinking…');
    const done = await oneRound(
      args.config,
      turns,
      args.context,
      args.signal,
      (delta) => {
        if (!roundText && shown) shown += '\n\n';
        roundText += delta;
        shown += delta;
        args.onStatus(null);
        args.onText(shown);
      },
      () => args.onStatus('Thinking…'),
    );

    turns.push({
      role: 'assistant',
      content: roundText,
      toolCalls: done.toolCalls.length ? done.toolCalls : undefined,
      raw: done.raw,
      provider: args.config.provider,
    });
    if (!done.toolCalls.length) {
      args.onStatus(null);
      return turns;
    }

    for (const call of done.toolCalls) {
      const input = (call.input && typeof call.input === 'object' ? call.input : {}) as Record<string, unknown>;
      args.onStatus(`${toolLabel(call.name, input)}…`);
      const result = runPilotTool(call.name, call.input, args.toolContext);
      turns.push({ role: 'tool', toolCallId: call.id, name: call.name, content: result.content, isError: result.isError || undefined });
    }
  }
  throw new Error('Pilot needed too many lookups for that. Ask a narrower question.');
}

/** Lookups made while answering, as short labels for the transcript. */
export function lookupsIn(turns: ChatTurn[]): string[] {
  return turns.flatMap((t) =>
    t.role === 'assistant' && t.toolCalls
      ? t.toolCalls.map((c) => toolLabel(c.name, (c.input && typeof c.input === 'object' ? c.input : {}) as Record<string, unknown>))
      : [],
  );
}
