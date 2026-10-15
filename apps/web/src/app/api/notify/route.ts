import { localOnly, noStore } from "@/lib/server/guard";
import { DISCORD_WEBHOOK, TELEGRAM_TOKEN, detectTelegramChat, getNotify, notify, publicNotify, saveNotify, type AlertKind } from "@/lib/server/notify";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const blocked = localOnly(req);
  if (blocked) return blocked;
  return noStore(publicNotify(await getNotify()));
}

const KINDS: AlertKind[] = ["trades", "accounts", "recap", "live"];

export async function POST(req: Request) {
  const blocked = localOnly(req);
  if (blocked) return blocked;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    if (body.action === "save") {
      const token = typeof body.telegramToken === "string" ? body.telegramToken.trim() : undefined;
      const webhook = typeof body.discordWebhook === "string" ? body.discordWebhook.trim() : undefined;
      if (token && !TELEGRAM_TOKEN.test(token)) return noStore({ error: "That doesn't look like a Telegram bot token (from @BotFather)." }, 400);
      if (webhook && !DISCORD_WEBHOOK.test(webhook)) return noStore({ error: "That isn't a Discord webhook URL." }, 400);
      const saved = await saveNotify((s) => {
        if (token !== undefined && token) s.telegram.token = token;
        if (body.clearTelegram === true) s.telegram = { token: "", chatId: "", enabled: false };
        if (typeof body.telegramChatId === "string") s.telegram.chatId = body.telegramChatId.trim().slice(0, 40);
        if (typeof body.telegramEnabled === "boolean") s.telegram.enabled = body.telegramEnabled;
        if (webhook !== undefined && webhook) s.discord.webhook = webhook;
        if (body.clearDiscord === true) s.discord = { webhook: "", enabled: false };
        if (typeof body.discordEnabled === "boolean") s.discord.enabled = body.discordEnabled;
        const events = body.events as Record<string, unknown> | undefined;
        for (const k of KINDS) if (typeof events?.[k] === "boolean") s.events[k] = events[k] as boolean;
      });
      return noStore(publicNotify(saved));
    }
    if (body.action === "detect-chat") {
      const s = await getNotify();
      if (!s.telegram.token) return noStore({ error: "Save your bot token first." }, 400);
      const chat = await detectTelegramChat(s.telegram.token);
      const saved = await saveNotify((x) => {
        x.telegram.chatId = chat.chatId;
        x.telegram.enabled = true;
      });
      return noStore({ ...publicNotify(saved), chatName: chat.name });
    }
    if (body.action === "test") {
      const out = await notify(null, "✅ TradePilot is connected. Proving Ground and live bot alerts will arrive here. Send /help for commands.", { force: true });
      if (!out.sent.length) return noStore({ error: out.errors.join(" · ") || "No channel is set up yet." }, 400);
      return noStore(out);
    }
    return noStore({ error: "Unknown action." }, 400);
  } catch (e) {
    return noStore({ error: e instanceof Error ? e.message : "Alert settings failed." }, 502);
  }
}
