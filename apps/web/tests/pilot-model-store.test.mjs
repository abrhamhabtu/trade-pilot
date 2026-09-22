import test from "node:test";
import assert from "node:assert/strict";

// A minimal localStorage so the store can be exercised outside a browser.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const { useModelStore } = await import("../src/lib/pilot/modelStore.ts");
const { modelReady } = await import("../src/lib/pilot/modelStore.ts");
const KEY = "pilot_model_v1";
const config = {
  provider: "deepseek",
  model: "deepseek-chat",
  baseUrl: "",
  apiKey: "sk-fixture",
};

test("the key is kept across reloads until it is removed", () => {
  store.clear();
  useModelStore.getState().setModel(config);
  assert.equal(JSON.parse(store.get(KEY)).apiKey, "sk-fixture");

  // A reload: fresh hydrate from what is on disk.
  useModelStore.setState({ model: { provider: "local", model: "", baseUrl: "", apiKey: "" }, hydrated: false });
  useModelStore.getState().hydrate();
  assert.equal(useModelStore.getState().model.apiKey, "sk-fixture");
  assert.equal(useModelStore.getState().model.model, "deepseek-chat");
});

test("removing the key clears it from memory and from storage, keeping the model choice", () => {
  store.clear();
  useModelStore.getState().setModel(config);
  useModelStore.getState().forgetKey();
  assert.equal(useModelStore.getState().model.apiKey, "");
  assert.equal(JSON.parse(store.get(KEY)).apiKey, "");
  assert.equal(useModelStore.getState().model.model, "deepseek-chat");
  assert.equal(modelReady(useModelStore.getState().model), false);
});

test("a remote provider is only ready once a key is present", () => {
  assert.equal(modelReady({ ...config, apiKey: "" }), false);
  assert.equal(modelReady(config), true);
  assert.equal(modelReady({ ...config, provider: "local" }), false);
  // Loopback endpoints legitimately have no key.
  assert.equal(
    modelReady({ provider: "ollama", model: "llama3", baseUrl: "", apiKey: "" }),
    true,
  );
});
