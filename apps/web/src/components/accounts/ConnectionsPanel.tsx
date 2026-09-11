"use client";
import { useState } from "react";
import { RefreshCw, PlugZap } from "lucide-react";
import { useAccountStore } from "@/store/accountStore";
import {
  projectXRequest,
  connectionRequest,
  syncAccount,
  useSyncStatus,
} from "@/lib/sync";
import { TradovateConnection } from "./TradovateConnection";
import { useThemeClasses } from "../payout/payoutPrimitives";

export function ConnectionsPanel() {
  const { card, text, muted, input, inset } = useThemeClasses();
  const { accounts, addAccount, updateAccount, selectAccount } =
    useAccountStore();
  const { messages } = useSyncStatus();
  const [platform, setPlatform] = useState("tradovate");
  const [firm, setFirm] = useState("Lucid Trading");
  const [userName, setUserName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [remote, setRemote] = useState<{ id: number; name: string }[]>([]);
  const [start, setStart] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState(false);
  const connected = accounts.filter((a) => Boolean(a.syncSource));
  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("Connecting…");
    try {
      const data = await projectXRequest({
        action: "connect",
        userName,
        apiKey,
      });
      setRemote(data.accounts);
      setApiKey("");
      setMessage(
        data.accounts.length
          ? "Choose a history start date before your first entry, then link an account."
          : "Connected. No accounts were returned by the platform.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Connection failed.");
    } finally {
      setBusy(false);
    }
  }
  async function link(id: number, name: string) {
    if (!start || Date.parse(start) > Date.now()) {
      setMessage("Choose a valid history start date first.");
      return;
    }
    setBusy(true);
    const existing = accounts.find(
      (a) =>
        a.syncSource?.provider === "projectx" && a.syncSource.remoteId === id,
    );
    const localId =
      existing?.id ??
      addAccount({
        name,
        broker: "Topstep",
        type: "manual",
        syncSource: {
          provider: "projectx",
          remoteId: id,
          start: `${start}T00:00:00Z`,
          automatic: false,
        },
      });
    selectAccount(localId);
    await syncAccount(localId);
    setBusy(false);
  }
  return (
    <section
      className={`${card} ${text} p-5 sm:p-6 mb-6`}
      aria-label="Trade connections"
    >
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-2">
            <PlugZap size={18} className="text-emerald-500" />
            <h2 className="font-semibold">
              Your trades, without the spreadsheet ritual
            </h2>
          </div>
          <p className={`${muted} text-sm mt-2`}>
            Connect a platform once per session. Keep accounts separate and
            bring in closed executions automatically.
          </p>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="text-sm rounded-lg border border-emerald-500/30 text-emerald-500 px-4 py-2"
        >
          {expanded ? "Hide connections" : "Set up a connection"}
        </button>
      </div>
      {expanded && (
        <div className="mt-5">
          <p className={`${muted} text-sm mb-4`}>
            Start with the platform shown in your account credentials. Your prop
            firm is the account label; the platform determines how trades sync.
          </p>
          <div
            className="grid sm:grid-cols-3 gap-3 mb-5"
            aria-label="Connection platforms"
          >
            {[
              {
                id: "tradovate",
                title: "Tradovate",
                detail:
                  "Default · Lucid, Top One, other firms & personal accounts",
              },
              {
                id: "projectx",
                title: "TopstepX",
                detail: "Topstep · ProjectX API access required",
              },
              {
                id: "other",
                title: "Rithmic / other",
                detail: "No direct connector yet · use file import",
              },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id)}
                aria-pressed={platform === p.id}
                className={`text-left rounded-xl border p-4 ${platform === p.id ? "border-emerald-500/50 bg-emerald-500/10" : "border-current/10"}`}
              >
                <span className="block font-semibold text-sm">{p.title}</span>
                <span className={`${muted} block text-xs leading-relaxed mt-2`}>
                  {p.detail}
                </span>
              </button>
            ))}
          </div>
          <p className={`${muted} text-xs mb-5`}>
            Local app connector · API authorization required · Closed trade
            history only. Production hosting and one-click Tradovate OAuth are
            not available yet.
          </p>
          {platform === "tradovate" && (
            <label className="block text-xs mb-4">
              Account provider
              <select
                value={firm}
                onChange={(e) => setFirm(e.target.value)}
                className={`${input} block border rounded-lg p-2.5 mt-1 w-full sm:max-w-sm`}
              >
                {[
                  "Lucid Trading",
                  "Top One Futures",
                  "Other firms",
                  "Personal brokerage",
                ].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
          )}
          {platform === "projectx" ? (
            <div className={`${inset} p-4 sm:p-5`}>
              <h3 className="font-semibold text-sm">
                TopstepX · API connection
              </h3>
              <p className={`${muted} text-xs leading-relaxed mt-2`}>
                Requires TopstepX API access. Your key is sent to TopstepX to
                obtain a one-hour session and is never saved. This connector
                only reads account and trade history; the provider token itself
                has broader permissions.
              </p>
              <form
                onSubmit={connect}
                className="flex flex-col sm:flex-row gap-3 mt-4"
              >
                <label className="flex-1 text-xs">
                  Platform username
                  <input
                    required
                    autoComplete="username"
                    className={`${input} block w-full border rounded-lg p-2.5 mt-1`}
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                  />
                </label>
                <label className="flex-1 text-xs">
                  API key
                  <input
                    required
                    type="password"
                    autoComplete="off"
                    className={`${input} block w-full border rounded-lg p-2.5 mt-1`}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </label>
                <button
                  disabled={busy}
                  className="self-end py-2.5 px-4 rounded-lg bg-emerald-500 text-zinc-950 text-sm disabled:opacity-40"
                >
                  Connect
                </button>
              </form>
              <div className="flex gap-4 mt-3 text-xs">
                <a
                  href="https://help.topstep.com/en/articles/11187768-topstepx-api-access"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Get API access ↗
                </a>
                <button
                  className="underline"
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const data = await projectXRequest({
                        action: "accounts",
                      });
                      setRemote(data.accounts);
                      setMessage("Session restored.");
                    } catch (e) {
                      setMessage(
                        e instanceof Error ? e.message : "Connect again.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                  disabled={busy}
                >
                  Restore existing session
                </button>
              </div>
              {remote.length > 0 && (
                <div className="mt-4 space-y-3">
                  <label className="text-xs">
                    Import history from (UTC)
                    <input
                      type="date"
                      value={start}
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setStart(e.target.value)}
                      className={`${input} block rounded border p-2 mt-1`}
                    />
                  </label>
                  {remote.map((a) => (
                    <div
                      key={a.id}
                      className="flex justify-between items-center gap-3 text-sm"
                    >
                      <span>{a.name}</span>
                      <button
                        className="text-emerald-500 underline disabled:opacity-40"
                        disabled={busy || !start}
                        onClick={() => link(a.id, a.name)}
                      >
                        {accounts.some(
                          (local) =>
                            local.syncSource?.provider === "projectx" &&
                            local.syncSource.remoteId === a.id,
                        )
                          ? "Refresh linked account"
                          : "Link as new account"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p role="status" className="text-xs mt-3">
                {message}
              </p>
              <p className={`${muted} text-xs mt-3`}>
                Creates a dedicated account to avoid mixing CSV imports with API
                records. UTC dates, provider contract IDs and partial exits are
                retained. If an entry is missing, the import stops and asks for
                more history.
              </p>
            </div>
          ) : platform === "tradovate" ? (
            <TradovateConnection key={firm} firm={firm} />
          ) : (
            <div className={`${inset} p-5`}>
              <h3 className="font-semibold text-sm">
                Match the connection to your login
              </h3>
              <p className={`${muted} text-sm mt-2 leading-relaxed`}>
                Rithmic accounts need a separate integration, even if you trade
                through NinjaTrader or another supported charting app. A
                TradingView login alone is not a trade-history connection. This
                app does not currently connect directly to Rithmic or other
                ProjectX firms.
              </p>
              <p className={`${muted} text-sm mt-3`}>
                For now, select or create a dedicated account, then use Import
                Trades with a supported export. Keep each account’s history
                separate.
              </p>
            </div>
          )}
        </div>
      )}
      {connected.length > 0 && (
        <div className="mt-5 space-y-4">
          {connected.map((a) => (
            <div key={a.id} className="border-t border-current/10 pt-4">
              <div className="flex flex-wrap gap-4 justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {a.name}{" "}
                    <span className={`${muted} text-xs`}>
                      ·{" "}
                      {a.syncSource!.provider === "projectx"
                        ? "TopstepX"
                        : a.syncSource!.provider === "tradovate-live"
                          ? "Tradovate live"
                          : "Tradovate simulation"}
                    </span>
                  </p>
                  <p className={`${muted} text-xs mt-1`}>
                    {a.syncSource?.lastSynced
                      ? `Last success: ${new Date(a.syncSource.lastSynced).toLocaleString()}`
                      : "Not synced yet"}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <label className="text-xs flex gap-2 items-center">
                    <input
                      type="checkbox"
                      checked={a.syncSource!.automatic}
                      onChange={(e) =>
                        updateAccount(a.id, {
                          syncSource: {
                            ...a.syncSource!,
                            automatic: e.target.checked,
                          },
                        })
                      }
                    />
                    Auto-sync while open
                  </label>
                  <button
                    aria-label={`Sync ${a.name}`}
                    onClick={() => syncAccount(a.id)}
                    disabled={messages[a.id] === "Syncing…"}
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
              </div>
              <label className={`${muted} text-xs block mt-2`}>
                History begins{" "}
                <input
                  aria-label={`History start for ${a.name}`}
                  type="date"
                  className={`${input} border rounded p-1`}
                  value={a.syncSource!.start.slice(0, 10)}
                  max={a.syncSource!.start.slice(0, 10)}
                  onChange={(e) => {
                    if (
                      e.target.value &&
                      e.target.value <= a.syncSource!.start.slice(0, 10)
                    )
                      updateAccount(a.id, {
                        syncSource: {
                          ...a.syncSource!,
                          start: `${e.target.value}T00:00:00Z`,
                        },
                      });
                  }}
                />
              </label>
              <p className="text-xs mt-2" role="status">
                {messages[a.id]}
              </p>
            </div>
          ))}
          <button
            className="text-xs underline"
            onClick={async () => {
              try {
                for (const provider of new Set(
                  connected.map((a) => a.syncSource!.provider),
                ))
                  await connectionRequest(provider, { action: "disconnect" });
                connected.forEach((a) =>
                  updateAccount(a.id, {
                    syncSource: { ...a.syncSource!, automatic: false },
                  }),
                );
                setRemote([]);
                setMessage("Disconnected. Imported history is retained.");
              } catch {
                setMessage("Could not disconnect. Try again.");
              }
            }}
          >
            Disconnect session & pause automatic sync
          </button>
          <p className={`${muted} text-xs`}>
            TopstepX refreshes every minute; Tradovate every five minutes.
            Automatic sync pauses when this app is closed or hidden. Reconnect
            when the one-hour session expires. Existing records are refreshed by
            execution ID, including corrections and voids.
          </p>
        </div>
      )}
    </section>
  );
}
