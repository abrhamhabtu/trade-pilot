"use client";
import { useState } from "react";
import { ArrowUpRight, Check, Loader2 } from "lucide-react";
import {
  PROVIDERS,
  requestCoaching,
  type ModelConfig,
  type Provider,
} from "@/lib/pilot/models";

export function ModelPanel({
  config,
  onChange,
}: {
  config: ModelConfig;
  onChange: (value: ModelConfig) => void;
}) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const change = (value: ModelConfig) => {
    setStatus("");
    onChange(value);
  };
  return (
    <section className="pilot-panel pilot-model">
      <div className="pilot-section-title">
        <div>
          <span className="pilot-eyebrow">YOUR MODEL, YOUR CHOICE</span>
          <h2>Connect your intelligence.</h2>
        </div>
      </div>
      <p className="pilot-muted">
        Keep everything on your machine, or bring a model you already use.
      </p>
      <div className="pilot-provider-grid">
        {Object.entries(PROVIDERS).map(([id, p]) => (
          <button
            className={config.provider === id ? "selected" : ""}
            key={id}
            onClick={() =>
              config.provider !== id &&
              change({
                provider: id as Provider,
                baseUrl: p.url,
                model: "",
                apiKey: "",
              })
            }
          >
            <span>{p.label}</span>
            {config.provider === id && <Check size={15} />}
          </button>
        ))}
      </div>
      <p className="pilot-muted">{PROVIDERS[config.provider].hint}</p>
      {config.provider !== "local" && (
        <div className="pilot-model-form">
          <label>
            Model ID
            <input
              value={config.model}
              onChange={(e) => change({ ...config, model: e.target.value })}
              placeholder="Paste an exact model ID"
              autoComplete="off"
            />
          </label>
          {config.provider === "custom" && (
            <label>
              Base URL
              <input
                type="url"
                value={config.baseUrl}
                onChange={(e) => change({ ...config, baseUrl: e.target.value })}
                placeholder="http://127.0.0.1:1234/v1"
              />
            </label>
          )}
          <label>
            API key <span className="pilot-muted">· kept in memory only</span>
            <input
              type="password"
              autoComplete="off"
              value={config.apiKey}
              onChange={(e) => change({ ...config, apiKey: e.target.value })}
              placeholder={
                config.provider === "ollama" || config.provider === "custom"
                  ? "Optional for a local endpoint"
                  : "Your provider API key"
              }
            />
          </label>
          <p className="pilot-muted">
            Sending a message or drafting a note shares the selected account’s
            recent trades, notes and rules with this provider. API keys are
            cleared when the page reloads. A connection test sends no account
            data.
          </p>
          <button
            className="pilot-button primary"
            disabled={busy || !config.model.trim()}
            onClick={async () => {
              setBusy(true);
              setStatus("");
              try {
                await requestCoaching(
                  config,
                  [{ role: "user", content: "Reply with Connected." }],
                  {},
                );
                setStatus("Connection verified. Ready for coaching.");
              } catch (e) {
                setStatus(
                  e instanceof Error ? e.message : "Connection failed.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Check size={15} />
            )}
            Test connection
          </button>
          <p role="status" className="pilot-muted">
            {status}
          </p>
        </div>
      )}
      <div className="pilot-connection-note">
        <strong>Using Codex with ChatGPT sign-in?</strong>
        <p>
          Native Codex OAuth is not connected here. This panel uses provider
          APIs; a ChatGPT subscription token is not an API key. Use an
          API-backed model above for now.
        </p>
        <a
          href="https://developers.openai.com/codex/auth"
          target="_blank"
          rel="noreferrer"
        >
          Codex authentication guide <ArrowUpRight size={13} />
        </a>
      </div>
    </section>
  );
}
