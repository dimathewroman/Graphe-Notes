#!/usr/bin/env node
/**
 * claude-proxy.mjs — LOCAL DEV ONLY.
 *
 * ⚠️  GUARDRAIL (load-bearing): this shells out to your PERSONAL `claude` CLI for
 * every request, i.e. it runs on your Claude subscription. That is legitimate
 * only as "a developer using their own CLI locally to test their own code."
 * Routing real end-user traffic through it would violate Anthropic's terms.
 * Never deploy it, never make it reachable from a deployed environment, and only
 * ever select it through a local-dev provider (Graphe: Settings → AI → Local AI,
 * endpoint http://localhost:8788 — the client-side local_llm path, which is the
 * only provider not blocked by the server's SSRF loopback guard).
 *
 * WHAT IT IS: a tiny OpenAI-compatible Chat Completions server. Any client that
 * speaks the OpenAI API can point its baseURL here and transparently run on
 * Claude. Two endpoints:
 *   GET  /v1/models            — static model list (for discovery dropdowns)
 *   POST /v1/chat/completions  — the one that matters
 *
 * HOW: translate the OpenAI request → `claude -p --output-format json`, then
 * translate the JSON envelope back into an OpenAI chat.completion (or faked SSE).
 *
 * AUTH: the CLI must be signed in. Run `claude setup-token` once and put the
 * printed CLAUDE_CODE_OAUTH_TOKEN in .env.local (this script loads it), or run
 * this in a shell where `claude` is already authenticated.
 *
 * RUN: node scripts/claude-proxy.mjs   (PORT via CLAUDE_PROXY_PORT, default 8788)
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PORT = Number(process.env.CLAUDE_PROXY_PORT || 8788);

// Never let this run as part of a production process.
if (process.env.NODE_ENV === "production") {
  console.error("claude-proxy is a LOCAL DEV tool and must not run in production.");
  process.exit(1);
}

// Minimal .env.local loader (no dotenv dependency). Only fills vars not already
// set, so a real environment always wins. Picks up CLAUDE_CODE_OAUTH_TOKEN and
// an optional CLAUDE_BIN override.
function loadEnvFiles() {
  for (const file of [".env.local", ".env"]) {
    const path = join(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      const key = m[1];
      const val = m[2].replace(/^(["'])(.*)\1$/, "$2");
      if (!(key in process.env)) process.env[key] = val;
    }
  }
}
loadEnvFiles();

// Locate the claude binary: explicit CLAUDE_BIN → macOS desktop-app bundle
// (highest installed version) → `claude` on PATH.
function semverDesc(a, b) {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pb[i] || 0) !== (pa[i] || 0)) return (pb[i] || 0) - (pa[i] || 0);
  return 0;
}
function findClaude() {
  if (process.env.CLAUDE_BIN && existsSync(process.env.CLAUDE_BIN)) return process.env.CLAUDE_BIN;
  const base = join(homedir(), "Library/Application Support/Claude/claude-code");
  if (existsSync(base)) {
    const versions = readdirSync(base).filter((d) => /^\d+\.\d+\.\d+/.test(d)).sort(semverDesc);
    for (const v of versions) {
      const bin = join(base, v, "claude.app/Contents/MacOS/claude");
      if (existsSync(bin)) return bin;
    }
  }
  return "claude";
}
const CLAUDE_BIN = findClaude();

// Advertised for discovery. `--model` accepts these aliases + full ids.
const MODELS = ["claude-opus-4-8", "claude-sonnet-4-5", "sonnet", "opus", "haiku"];

// The app's dev panel encodes reasoning effort into the model string as
// "sonnet#effort=high" (no new API surface). Parse it back out.
function parseModel(raw) {
  const [name, query = ""] = String(raw || "sonnet").split("#");
  const effort = new URLSearchParams(query).get("effort");
  return { model: name || "sonnet", effort };
}

// Flatten OpenAI messages[] into a single system string + a single user turn.
// `claude -p` is single-turn, so prior assistant/user turns are folded into the
// text with "Assistant:" prefixes; all role:system messages are joined.
function flatten(messages, jsonMode) {
  const systemParts = [];
  const turns = [];
  for (const msg of messages || []) {
    const content = typeof msg.content === "string"
      ? msg.content
      : Array.isArray(msg.content) ? msg.content.map((p) => p?.text ?? "").join("") : "";
    if (msg.role === "system") systemParts.push(content);
    else if (msg.role === "assistant") turns.push(`Assistant: ${content}`);
    else turns.push(content);
  }
  let system = systemParts.join("\n\n").trim();
  // Always send a system prompt so --exclude-dynamic-system-prompt-sections
  // engages (it only applies alongside --system-prompt) and Claude Code's
  // "you are a coding agent" preamble stays out of a plain chat/JSON use case.
  if (!system) system = "You are a helpful assistant.";
  if (jsonMode) system += "\n\nRespond with ONLY a single valid JSON object — no prose, no markdown code fences.";
  return { system, userText: turns.join("\n\n").trim() };
}

// Run `claude -p` and resolve its parsed JSON envelope.
function runClaude({ model, effort, system, userText }) {
  return new Promise((resolve, reject) => {
    const args = ["-p", "--model", model, "--output-format", "json", "--system-prompt", system, "--exclude-dynamic-system-prompt-sections"];
    if (effort) args.push("--effort", effort);
    const child = spawn(CLAUDE_BIN, args, { env: process.env });
    let out = "", err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => {
      try {
        resolve(JSON.parse(out));
      } catch {
        reject(new Error(`claude exited ${code}: ${(err || out).slice(0, 400)}`));
      }
    });
    child.stdin.end(userText || "");
  });
}

// JSON mode: the model sometimes wraps JSON in prose/fences despite instructions.
// Strip fences and slice the outermost {...}.
function extractJson(text) {
  const stripped = text.replace(/```(?:json)?/gi, "").trim();
  const a = stripped.indexOf("{"), b = stripped.lastIndexOf("}");
  return a >= 0 && b > a ? stripped.slice(a, b + 1) : stripped;
}

const rid = () => "chatcmpl-" + Math.random().toString(36).slice(2, 14);
const usageBlock = (u = {}) => ({
  prompt_tokens: u.input_tokens || 0,
  completion_tokens: u.output_tokens || 0,
  total_tokens: (u.input_tokens || 0) + (u.output_tokens || 0),
});

function completion(model, content, usage) {
  return {
    id: rid(), object: "chat.completion", created: Math.floor(Date.now() / 1000), model,
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: usageBlock(usage),
  };
}

// The CLI returns everything at once, so "streaming" is one content chunk plus a
// final usage-bearing chunk — enough to satisfy clients that expect the SSE shape.
function streamCompletion(res, model, content, usage) {
  const base = { id: rid(), object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model };
  const send = (o) => res.write(`data: ${JSON.stringify(o)}\n\n`);
  send({ ...base, choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }] });
  send({ ...base, choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage: usageBlock(usage) });
  res.write("data: [DONE]\n\n");
  res.end();
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const json = (res, status, obj) => {
  res.writeHead(status, { "Content-Type": "application/json", ...CORS });
  res.end(JSON.stringify(obj));
};
const oaiError = (res, status, message, extra = {}) => json(res, status, { error: { message, type: "proxy_error", ...extra } });

createServer((req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }
  const path = (req.url || "").split("?")[0];

  if (req.method === "GET" && path === "/v1/models") {
    return json(res, 200, { object: "list", data: MODELS.map((id) => ({ id, object: "model", owned_by: "anthropic" })) });
  }

  if (req.method === "POST" && path === "/v1/chat/completions") {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", async () => {
      let payload;
      try { payload = JSON.parse(body || "{}"); } catch { return oaiError(res, 400, "Invalid JSON body"); }
      const { model, effort } = parseModel(payload.model);
      const jsonMode = payload.response_format?.type === "json_object";
      const { system, userText } = flatten(payload.messages, jsonMode);
      try {
        const env = await runClaude({ model, effort, system, userText });
        if (env.is_error) {
          return oaiError(res, 502, env.result || "claude returned an error", { type: "upstream_error", code: env.api_error_status ?? null });
        }
        const content = jsonMode ? extractJson(env.result ?? "") : (env.result ?? "");
        if (payload.stream) {
          res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", ...CORS });
          return streamCompletion(res, payload.model || model, content, env.usage || {});
        }
        return json(res, 200, completion(payload.model || model, content, env.usage || {}));
      } catch (e) {
        return oaiError(res, 500, e?.message || String(e));
      }
    });
    return;
  }

  return oaiError(res, 404, "Not found", { type: "not_found" });
}).listen(PORT, () => {
  console.log(`⧉  claude-proxy → OpenAI-compatible API at http://localhost:${PORT}`);
  console.log(`   binary : ${CLAUDE_BIN}`);
  console.log(`   models : ${MODELS.join(", ")}`);
  console.log(`   token  : ${process.env.CLAUDE_CODE_OAUTH_TOKEN ? "loaded from env/.env.local" : "NOT set — run `claude setup-token` or sign in the CLI"}`);
  console.log("   ⚠ DEV ONLY — runs on your personal Claude subscription. Never deploy.");
});
