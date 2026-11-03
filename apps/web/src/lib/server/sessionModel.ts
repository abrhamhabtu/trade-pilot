// AI through the tools a person is already logged into. This runs the official
// Claude Code or Codex command on this machine, exactly as they could in a
// terminal, so it uses their own session and plan. It never reads or copies login
// files, and API key variables are removed so it can't bill a key by accident.

import { spawn } from "child_process";
import { existsSync, promises as fs, readdirSync } from "fs";
import os from "os";
import path from "path";

export type SessionTool = "claude-code" | "codex";

export interface ToolStatus {
  id: SessionTool;
  label: string;
  installed: boolean;
  loggedIn: boolean;
  version: string;
  seesImages: boolean;
  fix: string;
}

const NAMES: Record<SessionTool, string> = { "claude-code": "claude", codex: "codex" };

/** Where these tools usually live; a dev server's PATH often misses version-managed folders. */
function findBinary(name: string): string | null {
  const home = os.homedir();
  const dirs = [...(process.env.PATH ?? "").split(path.delimiter), "/opt/homebrew/bin", "/usr/local/bin", path.join(home, ".local/bin"), path.join(home, ".claude/local"), path.join(home, ".npm-global/bin"), path.join(home, ".bun/bin")];
  try {
    const nvm = path.join(home, ".nvm/versions/node");
    for (const v of readdirSync(nvm).sort().reverse()) dirs.push(path.join(nvm, v, "bin"));
  } catch {
    /* no nvm */
  }
  for (const d of dirs) if (d && existsSync(path.join(d, name))) return path.join(d, name);
  return null;
}

/** The child's environment: its folder on PATH for its node, and no API keys. */
function childEnv(bin: string) {
  const env: NodeJS.ProcessEnv = { ...process.env, PATH: `${path.dirname(bin)}${path.delimiter}${process.env.PATH ?? ""}` };
  // Everything these tools read from the environment comes out, so each one uses only its own login.
  // That includes settings inherited when this app was itself started from inside another AI session.
  for (const k of Object.keys(env)) if (/^(ANTHROPIC_|CLAUDE|OPENAI_|CODEX_)/.test(k)) delete env[k];
  return env;
}

function run(bin: string, args: string[], o: { stdin?: string; cwd?: string; timeoutMs: number; signal?: AbortSignal }): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    const p = spawn(bin, args, { cwd: o.cwd ?? os.tmpdir(), env: childEnv(bin), stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const timer = setTimeout(() => p.kill("SIGTERM"), o.timeoutMs);
    o.signal?.addEventListener("abort", () => p.kill("SIGTERM"));
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => {
      clearTimeout(timer);
      resolve({ code: 1, out, err: String(e) });
    });
    p.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, out, err });
    });
    p.stdin.on("error", () => undefined);
    p.stdin.end(o.stdin ?? "");
  });
}

export async function toolStatus(): Promise<ToolStatus[]> {
  const claude = findBinary(NAMES["claude-code"]);
  const codex = findBinary(NAMES.codex);
  const out: ToolStatus[] = [];
  {
    const version = claude ? (await run(claude, ["--version"], { timeoutMs: 8000 })).out.trim().split(/\s+/)[0] : "";
    let loggedIn = false;
    if (claude) {
      const r = await run(claude, ["auth", "status"], { timeoutMs: 10_000 });
      try {
        loggedIn = !!JSON.parse(r.out).loggedIn;
      } catch {
        loggedIn = r.code === 0;
      }
    }
    out.push({ id: "claude-code", label: "Claude Code", installed: !!claude, loggedIn, version, seesImages: true, fix: !claude ? "Install Claude Code, then run: claude" : "In a terminal, run: claude auth login" });
  }
  {
    const version = codex ? (await run(codex, ["--version"], { timeoutMs: 8000 })).out.trim().split(/\s+/).pop() ?? "" : "";
    let loggedIn = false;
    let fix = "Install it with: npm install -g @openai/codex, then run: codex login";
    if (codex) {
      const r = await run(codex, ["login", "status"], { timeoutMs: 10_000 });
      loggedIn = r.code === 0 && /logged in/i.test(r.out + r.err) && !/not logged in/i.test(r.out + r.err);
      fix = "Update and log in: npm install -g @openai/codex@latest, then run: codex login";
    }
    out.push({ id: "codex", label: "Codex", installed: !!codex, loggedIn, version, seesImages: true, fix });
  }
  return out;
}

export const isSessionTool = (s: unknown): s is SessionTool => s === "claude-code" || s === "codex";

/** Asks the tool one question, optionally with one image it may read, and returns its answer. */
export async function askSession(tool: SessionTool, prompt: string, o: { imagePng?: Buffer; timeoutMs?: number; signal?: AbortSignal } = {}) {
  const bin = findBinary(NAMES[tool]);
  if (!bin) throw new Error(`${tool === "codex" ? "Codex" : "Claude Code"} isn't installed on this computer.`);
  // Its own empty folder, so it starts with nothing of the project's and can only reach this image.
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "tradepilot-ai-"));
  const timeoutMs = o.timeoutMs ?? 170_000;
  try {
    const image = o.imagePng ? path.join(dir, "chart.png") : null;
    if (image) await fs.writeFile(image, o.imagePng!);
    if (tool === "claude-code") {
      const real = image ? await fs.realpath(dir) : dir;
      const args = ["-p", "--output-format", "json", "--no-session-persistence", "--strict-mcp-config", "--disable-slash-commands", "--setting-sources", "project", "--tools", image ? "Read" : ""];
      if (image) args.push("--allowedTools", `Read(/${real}/**)`);
      const text = image ? `The chart image is at ${path.join(real, "chart.png")}. Open it with the Read tool before answering.\n\n${prompt}` : prompt;
      const r = await run(bin, args, { stdin: text, cwd: real, timeoutMs, signal: o.signal });
      let parsed: { result?: string; is_error?: boolean } | null = null;
      try {
        parsed = JSON.parse(r.out);
      } catch {
        /* reported below */
      }
      if (r.code !== 0 || !parsed || parsed.is_error || !parsed.result) throw new Error(explain(tool, parsed?.result || r.err || r.out));
      return parsed.result;
    }
    const last = path.join(dir, "answer.txt");
    const args = ["exec", "--skip-git-repo-check", "--sandbox", "read-only", "--color", "never", "--output-last-message", last];
    if (image) args.push("--image", image);
    args.push("-");
    const r = await run(bin, args, { stdin: prompt, cwd: dir, timeoutMs, signal: o.signal });
    const text = await fs.readFile(last, "utf8").catch(() => "");
    if (r.code !== 0 || !text.trim()) throw new Error(explain(tool, r.err || r.out));
    return text.trim();
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

function explain(tool: SessionTool, raw: string) {
  const name = tool === "codex" ? "Codex" : "Claude Code";
  if (/log ?in|auth|credential|unauthori[sz]ed|api key/i.test(raw)) return `${name} isn't logged in. In a terminal, run: ${tool === "codex" ? "codex login" : "claude auth login"}`;
  if (/usage limit|rate limit|quota|limit reached|hit your .*limit/i.test(raw)) return `${name}: ${raw.trim().slice(0, 160)}. The read will work again once your plan resets.`;
  if (/unexpected argument|unknown option|unrecognized|invalid option/i.test(raw)) return `This version of ${name} is out of date. Update it and try again.`;
  return `${name} didn't answer: ${raw.trim().slice(0, 200) || "no details given"}`;
}
