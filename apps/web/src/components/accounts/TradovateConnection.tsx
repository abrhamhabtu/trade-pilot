"use client";
import { useState } from "react";
import { useAccountStore } from "@/store/accountStore";
import { connectionRequest, syncAccount } from "@/lib/sync";
import { useThemeClasses } from "../payout/payoutPrimitives";

export function TradovateConnection({ firm }: { firm: string }) {
  const { inset, input, muted } = useThemeClasses();
  const [credentials, setCredentials] = useState({
    name: "",
    password: "",
    cid: "",
    sec: "",
    appId: "",
  });
  const [provider, setProvider] = useState<"tradovate-demo" | "tradovate-live">(
    firm === "Personal brokerage" ? "tradovate-live" : "tradovate-demo",
  );
  const [remote, setRemote] = useState<{ id: number; name: string }[]>([]);
  const [start, setStart] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [authorizedProvider, setAuthorizedProvider] = useState(provider);
  const { accounts, addAccount, selectAccount } = useAccountStore();
  async function connect(restore = false) {
    setBusy(true);
    setMessage("Checking authorized API access…");
    try {
      const data = await connectionRequest(
        provider,
        restore
          ? { action: "accounts" }
          : { action: "connect", ...credentials, cid: Number(credentials.cid) },
      );
      setRemote(data.accounts);
      setAuthorizedProvider(provider);
      setCredentials((v) => ({ ...v, password: "", sec: "" }));
      setMessage(
        data.accounts.length
          ? "Access granted. Link an account below."
          : "Connected, but no accessible accounts were returned.",
      );
    } catch (e) {
      setRemote([]);
      setMessage(e instanceof Error ? e.message : "Connection failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`${inset} p-4 sm:p-5`}>
      <h3 className="font-semibold text-sm">{firm} · Tradovate connection</h3>
      <p className={`${muted} text-sm mt-2`}>
        Also covers trades placed through TradingView or NinjaTrader when they
        use this Tradovate account.
      </p>
      <p className={`${muted} text-xs leading-relaxed mt-3`}>
        You need API access authorized for this login, including a registered
        application ID, CID and secret. A standard prop-firm login may not
        include it. If those fields are unavailable, this connector cannot
        enable them; you will need access from the provider or an approved
        partner integration.
      </p>
      <a
        className="text-xs underline inline-block mt-3"
        href="https://tradovate.zendesk.com/hc/en-us/articles/4403105829523-How-Do-I-Get-Access-to-the-Tradovate-API"
        target="_blank"
        rel="noreferrer"
      >
        Check Tradovate API requirements ↗
      </a>
      <details className="mt-4 rounded-xl p-4 text-xs leading-relaxed ring-1 ring-inset ring-white/[0.07]">
        <summary className="cursor-pointer font-medium text-zinc-200">Before you connect — requirements checklist</summary>
        <ol className={`list-decimal pl-4 space-y-2 mt-2 ${muted}`}>
          <li>
            Activate the account in Tradovate and complete its required
            agreements.
          </li>
          <li>
            Confirm this login can use the API. A working trading-platform login
            alone is not enough.
          </li>
          <li>
            Choose simulation or live based on the account’s environment, then
            link each returned account separately.
          </li>
        </ol>
        {firm === "Lucid Trading" && (
          <p className={`${muted} mt-3`}>
            Lucid lists Tradovate under CQG and offers a separate Rithmic route.
            Use this connector only for your Tradovate credentials.{" "}
            <a
              className="underline"
              href="https://support.lucidtrading.com/en/articles/11404614-lucid-trading-supported-platforms"
              target="_blank"
              rel="noreferrer"
            >
              Lucid platform guide ↗
            </a>
          </p>
        )}
        {firm === "Top One Futures" && (
          <p className={`${muted} mt-3`}>
            Top One’s Tradovate guide directs evaluation and funded accounts to
            “Tradovate Prop – Simulation.” Funded does not necessarily mean the
            live API.{" "}
            <a
              className="underline"
              href="https://help.toponefutures.com/en/articles/12828004-getting-started-your-first-tradovate-account-with-top-one-futures-and-how-to-log-in-to-the-platform"
              target="_blank"
              rel="noreferrer"
            >
              Top One setup guide ↗
            </a>
          </p>
        )}
        <p className={`${muted} mt-3`}>
          No API access? Use a supported CSV export with Import Trades for now.
          Tradovate’s self-service API requirements include a live account
          holding more than $1,000, the CME agreement, and the API add-on.
          Confirm prop-account eligibility with the provider before purchasing
          anything.
        </p>
      </details>
      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          connect();
        }}
      >
        <label className="text-xs block">
          Account environment
          <select
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value as typeof provider);
              setRemote([]);
            }}
            className={`${input} border rounded-lg p-2 block mt-1 w-full`}
          >
            <option value="tradovate-demo">
              Simulation / evaluation / sim-funded
            </option>
            <option value="tradovate-live">Live brokerage account</option>
          </select>
        </label>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          {(
            [
              { key: "name", label: "Tradovate username", type: "text" },
              {
                key: "password",
                label: "Tradovate password",
                type: "password",
              },
              {
                key: "appId",
                label: "Registered application ID",
                type: "text",
              },
              { key: "cid", label: "API CID", type: "number" },
              { key: "sec", label: "API secret", type: "password" },
            ] as const
          ).map((f) => (
            <label key={f.key} className="text-xs">
              {f.label}
              <input
                required
                type={f.type}
                autoComplete={f.key === "name" ? "username" : "off"}
                value={credentials[f.key]}
                onChange={(e) =>
                  setCredentials((v) => ({ ...v, [f.key]: e.target.value }))
                }
                className={`${input} border rounded-lg p-2.5 block mt-1 w-full`}
              />
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4 mt-4">
          <button
            disabled={busy}
            className="bg-white text-zinc-950 text-sm font-semibold rounded-xl px-4 py-2 hover:bg-zinc-200 disabled:opacity-40"
          >
            Connect Tradovate
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => connect(true)}
            className="text-xs underline"
          >
            Restore existing session
          </button>
        </div>
      </form>
      <p role="status" className="text-xs mt-3">
        {message}
      </p>
      {remote.length > 0 && (
        <div className="space-y-3 mt-4">
          <label className="block text-xs">
            Import available history from (UTC)
            <input
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className={`${input} border rounded p-2 block mt-1`}
            />
          </label>
          {remote.map((a) => (
            <div
              className="flex items-center justify-between gap-3 text-sm"
              key={a.id}
            >
              <span>{a.name}</span>
              <button
                disabled={busy || !start || Date.parse(start) > Date.now()}
                className="underline text-emerald-500 disabled:opacity-40"
                onClick={async () => {
                  setBusy(true);
                  const existing = accounts.find(
                    (v) =>
                      v.syncSource?.provider === authorizedProvider &&
                      v.syncSource.remoteId === a.id,
                  );
                  const id =
                    existing?.id ??
                    addAccount({
                      name: a.name,
                      broker: ["Other firms", "Personal brokerage"].includes(
                        firm,
                      )
                        ? "Tradovate"
                        : firm,
                      type: "manual",
                      syncSource: {
                        provider: authorizedProvider,
                        remoteId: a.id,
                        start: `${start}T00:00:00Z`,
                        automatic: false,
                      },
                    });
                  selectAccount(id);
                  await syncAccount(id);
                  setBusy(false);
                }}
              >
                Link / refresh account
              </button>
            </div>
          ))}
        </div>
      )}
      <p className={`${muted} text-xs mt-4 leading-relaxed`}>
        Credentials pass through this local app’s server to Tradovate for
        authentication and are not saved. The one-hour session is held in an
        HTTP-only cookie. This local connector reads records only; the token may
        have broader permissions. Imports use matched fills, contract values and
        reported fees. Older history may require CSV backfill. No account is
        connected until access succeeds.
      </p>
    </div>
  );
}
