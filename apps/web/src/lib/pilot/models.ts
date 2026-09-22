export const PROVIDERS = {
  local: {
    label: "Built-in analysis",
    url: "",
    hint: "Private, deterministic analysis. No API key needed.",
  },
  openrouter: {
    label: "OpenRouter",
    url: "https://openrouter.ai/api/v1",
    hint: "Add your key and pick from your OpenRouter catalog.",
  },
  deepseek: {
    label: "DeepSeek",
    url: "https://api.deepseek.com",
    hint: "Add your key and pick a model from your DeepSeek account.",
  },
  kimi: {
    label: "Kimi",
    url: "https://api.moonshot.ai/v1",
    hint: "Add your Kimi / Moonshot key and pick a model.",
  },
  opencode: {
    label: "OpenCode Zen",
    url: "https://opencode.ai/zen/v1",
    hint: "Add your key and pick a Zen model that supports chat/completions.",
  },
  ollama: {
    label: "Ollama / local models",
    url: "http://127.0.0.1:11434/v1",
    hint: "Run a local model with Ollama. For LM Studio, choose Custom endpoint.",
  },
  custom: {
    label: "Custom endpoint",
    url: "",
    hint: "OpenAI-compatible chat/completions. HTTPS origins must be enabled in PILOT_ALLOWED_ORIGINS; loopback works in development.",
  },
} as const;
export type Provider = keyof typeof PROVIDERS;
export interface ModelConfig {
  provider: Provider;
  model: string;
  baseUrl: string;
  apiKey: string;
}
export const DEFAULT_MODEL: ModelConfig = {
  provider: "local",
  model: "",
  baseUrl: "",
  apiKey: "",
};
export async function requestCoaching(
  config: ModelConfig,
  messages: { role: "user" | "assistant"; content: string }[],
  context: unknown,
  signal?: AbortSignal,
) {
  const response = await fetch("/api/pilot/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...config, messages, context }),
    signal,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not reach the model.");
  return data.text as string;
}

/** The chat models the configured key can reach, for the model picker. */
export async function listModels(config: ModelConfig, signal?: AbortSignal) {
  const response = await fetch("/api/pilot/models", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: config.provider,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
    }),
    signal,
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Could not list models for this key.");
  return data.models as string[];
}
