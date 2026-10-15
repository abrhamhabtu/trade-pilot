// Alerts to the trader's phone: a Telegram bot and/or a Discord webhook.
// Tokens and webhook URLs stay on this machine (notify.json, owner-readable).

import { readJson, updateJson } from "./store";

export type AlertKind = "trades" | "accounts" | "recap" | "live";

export interface NotifySettings {
  telegram: { token: string; chatId: string; enabled: boolean };
  discord: { webhook: string; enabled: boolean };
  events: Record<AlertKind, boolean>;
}

const FILE = "notify.json";
export const DEFAULT_NOTIFY: NotifySettings = {
  telegram: { token: "", chatId: "", enabled: false },
  discord: { webhook: "", enabled: false },
  events: { trades: true, accounts: true, recap: true, live: true },
};

export const TELEGRAM_TOKEN = /^\d{5,15}:[A-Za-z0-9_-]{30,64}$/;
// Only Discord's own webhook hosts: the server will POST to whatever is saved here.
export const DISCORD_WEBHOOK = /^https:\/\/(?:ptb\.|canary\.)?(?:discord|discordapp)\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/;

const normalise = (s: Partial<NotifySettings>): NotifySettings => ({
  telegram: { ...DEFAULT_NOTIFY.telegram, ...s.telegram },
  discord: { ...DEFAULT_NOTIFY.discord, ...s.discord },
  events: { ...DEFAULT_NOTIFY.events, ...s.events },
});

export async function getNotify(): Promise<NotifySettings> {
  return normalise(await readJson<Partial<NotifySettings>>(FILE, {}));
}

export function saveNotify(change: (s: NotifySettings) => void) {
  return updateJson<NotifySettings>(
    FILE,
    DEFAULT_NOTIFY,
    (raw) => {
      const s = normalise(raw);
      change(s);
      return s;
    },
    { secret: true },
  );
}

/** What a browser may see: whether each channel is set up, never the secret itself. */
export function publicNotify(s: NotifySettings) {
  return {
    telegram: { configured: !!s.telegram.token, chatId: s.telegram.chatId, enabled: s.telegram.enabled },
    discord: { configured: !!s.discord.webhook, enabled: s.discord.enabled },
    events: s.events,
  };
}

async function telegram(token: string, method: string, body: unknown) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(35_000),
  });
  const j = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: unknown; description?: string };
  if (!j.ok) throw new Error(j.description ? `Telegram: ${j.description}` : `Telegram request failed (${res.status})`);
  return j.result;
}

export const telegramCall = telegram;

/**
 * Send one alert to every enabled channel. `kind` is checked against the
 * trader's choices; pass `force` for a test message.
 */
export async function notify(kind: AlertKind | null, text: string, opts: { force?: boolean } = {}) {
  const s = await getNotify();
  const sent: string[] = [];
  const errors: string[] = [];
  if (kind && !s.events[kind] && !opts.force) return { sent, errors };
  if (s.telegram.token && s.telegram.chatId && (s.telegram.enabled || opts.force)) {
    try {
      await telegram(s.telegram.token, "sendMessage", { chat_id: s.telegram.chatId, text: text.slice(0, 4000), disable_web_page_preview: true });
      sent.push("telegram");
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Telegram failed");
    }
  }
  if (s.discord.webhook && (s.discord.enabled || opts.force)) {
    try {
      const res = await fetch(s.discord.webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "TradePilot", content: text.slice(0, 1900), allowed_mentions: { parse: [] } }),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`Discord request failed (${res.status})`);
      sent.push("discord");
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Discord failed");
    }
  }
  return { sent, errors };
}

/**
 * The chat to send to: the most recent chat that messaged the bot. The trader
 * sends their bot any message first, then presses Detect.
 */
export async function detectTelegramChat(token: string) {
  const updates = (await telegram(token, "getUpdates", { timeout: 0, allowed_updates: ["message"] })) as {
    message?: { chat?: { id: number; title?: string; username?: string; first_name?: string } };
  }[];
  const chat = [...updates].reverse().find((u) => u.message?.chat)?.message?.chat;
  if (!chat) throw new Error("No messages yet. Send your bot any message in Telegram, then try again.");
  return { chatId: String(chat.id), name: chat.title || chat.username || chat.first_name || String(chat.id) };
}
