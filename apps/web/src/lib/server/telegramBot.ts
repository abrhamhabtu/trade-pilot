// Two-way Telegram: the trader's chat can ask for status and pull the kill
// switch. Only the chat saved in alert settings is answered.

import { daemonState } from "./provingDaemon";
import { getNotify, telegramCall } from "./notify";
import { flattenAll, liveSummary } from "./live/bots";

const state: { started: boolean; offset: number } = ((globalThis as Record<string, unknown>).__tpTelegram ??= { started: false, offset: 0 }) as never;

const HELP = [
  "TradePilot commands:",
  "/status — every Proving Ground test, today and for life",
  "/live — live bots: mode, position, today's trades",
  "/flatten — close every live bot's position and disarm them all",
  "/help — this list",
].join("\n");

async function answer(text: string): Promise<string> {
  const cmd = text.trim().split(/\s+/)[0].toLowerCase().replace(/@.*/, "");
  if (cmd === "/status") {
    if (!daemonState.summaries.length) return "No running tests on the server yet. Open Proving Ground once so your tests sync.";
    return `Proving Ground\n${daemonState.summaries.map((s) => `• ${s.line}`).join("\n")}`;
  }
  if (cmd === "/live") return liveSummary();
  if (cmd === "/flatten") {
    const out = await flattenAll("Telegram /flatten");
    return out;
  }
  return HELP;
}

export function startTelegramBot() {
  if (state.started) return;
  state.started = true;
  const loop = async () => {
    let wait = 2_000;
    try {
      const s = await getNotify();
      if (!s.telegram.token || !s.telegram.chatId || !s.telegram.enabled) {
        wait = 30_000;
      } else {
        const updates = (await telegramCall(s.telegram.token, "getUpdates", { offset: state.offset, timeout: 25, allowed_updates: ["message"] })) as {
          update_id: number;
          message?: { chat?: { id: number }; text?: string };
        }[];
        for (const u of updates) {
          state.offset = u.update_id + 1;
          if (String(u.message?.chat?.id) !== s.telegram.chatId || !u.message?.text?.startsWith("/")) continue;
          const reply = await answer(u.message.text).catch((e) => (e instanceof Error ? e.message : "That failed."));
          await telegramCall(s.telegram.token, "sendMessage", { chat_id: s.telegram.chatId, text: reply.slice(0, 4000) });
        }
      }
    } catch {
      wait = 15_000;
    }
    setTimeout(loop, wait);
  };
  setTimeout(loop, 3_000);
}
