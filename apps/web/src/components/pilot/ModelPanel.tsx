"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, Loader2 } from "lucide-react";
import {
  PROVIDERS,
  listModels,
  requestCoaching,
  type ModelConfig,
  type Provider,
} from "@/lib/pilot/models";

/** Loopback providers answer without a key; everyone else needs one first. */
function canListModels(config: ModelConfig) {
  if (config.provider === "local") return false;
  if (config.provider === "custom") return !!config.baseUrl.trim();
  if (config.provider === "ollama") return true;
  return !!config.apiKey.trim();
}

export function ModelPanel({
  config,
  onChange,
  onForgetKey,
}: {
  config: ModelConfig;
  onChange: (value: ModelConfig) => void;
  onForgetKey: () => void;
}) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState("");
  const [manual, setManual] = useState(false);
  const change = (value: ModelConfig) => {
    setStatus("");
    onChange(value);
  };

  // Ask the provider which models this key can reach, so the trader picks one
  // from a menu instead of transcribing an ID. Re-runs when the key changes.
  const { provider, apiKey, baseUrl } = config;
  const ready = canListModels(config);
  const chosen = useRef(config.model);
  chosen.current = config.model;
  useEffect(() => {
    setModels([]);
    setModelsError("");
    if (!ready) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoadingModels(true);
      try {
        const found = await listModels(
          { provider, apiKey, baseUrl, model: "" },
          controller.signal,
        );
        setModels(found);
        if (!found.includes(chosen.current))
          onChange({ provider, apiKey, baseUrl, model: found[0] });
      } catch (error) {
        if (controller.signal.aborted) return;
        setModelsError(
          error instanceof Error ? error.message : "Could not list models.",
        );
      } finally {
        if (!controller.signal.aborted) setLoadingModels(false);
      }
    }, 600);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
    // onChange is stable for the lifetime of the settings panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, apiKey, baseUrl, ready]);

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
            onClick={() => {
              if (config.provider === id) return;
              setManual(false);
              change({
                provider: id as Provider,
                baseUrl: p.url,
                model: "",
                apiKey: "",
              });
            }}
          >
            <span>{p.label}</span>
            {config.provider === id && <Check size={15} />}
          </button>
        ))}
      </div>
      <p className="pilot-muted">{PROVIDERS[config.provider].hint}</p>
      {config.provider !== "local" && (
        <div className="pilot-model-form">
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
            API key{" "}
            <span className="pilot-muted">
              · saved in this browser until you remove it
            </span>
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
          <label>
            Model
            {models.length && !manual ? (
              <select
                value={config.model}
                onChange={(e) => change({ ...config, model: e.target.value })}
              >
                {models.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={config.model}
                onChange={(e) => change({ ...config, model: e.target.value })}
                placeholder="Paste an exact model ID"
                autoComplete="off"
              />
            )}
          </label>
          <p role="status" className="pilot-muted">
            {loadingModels
              ? "Loading the models your key can reach…"
              : models.length && !manual
                ? `${models.length} model${models.length === 1 ? "" : "s"} available on this key.`
                : modelsError ||
                  (ready
                    ? ""
                    : "Add your key above to load the model list automatically.")}
            {models.length > 0 && (
              <>
                {" "}
                <button
                  type="button"
                  className="pilot-model-link"
                  onClick={() => setManual(!manual)}
                >
                  {manual ? "Choose from the list" : "Enter an ID manually"}
                </button>
              </>
            )}
          </p>
          {!!config.apiKey && (
            <div className="pilot-model-actions">
              <button
                type="button"
                className="pilot-model-link"
                onClick={() => {
                  setStatus("");
                  onForgetKey();
                }}
              >
                Remove this key
              </button>
            </div>
          )}
          <p className="pilot-muted">
            Sending a message or drafting a note shares the selected account’s
            recent trades, notes and rules with this provider. Your key stays in
            this browser on this device until you remove it — anyone who can use
            this browser profile can use the key. A connection test sends no
            account data.
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
