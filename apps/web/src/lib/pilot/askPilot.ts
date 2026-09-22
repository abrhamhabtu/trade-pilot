export type { PilotMessage } from './prepEngine';
export { answerPilot, suggestedPrompts } from './prepEngine';

/** A link that opens Pilot on the right account with a question already asked. */
export function pilotHref(question: string, accountId?: string | null): string {
  const params = new URLSearchParams({ ask: question.slice(0, 500) });
  if (accountId) params.set('account', accountId);
  return `/app/pilot?${params.toString()}`;
}
