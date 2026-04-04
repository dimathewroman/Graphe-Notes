/**
 * Graphe Notes — API Performance Benchmark
 *
 * Measures response times for key API endpoints against the local dev server.
 * Reports avg / min / max / p95 over N_RUNS iterations per endpoint.
 *
 * Prerequisites:
 *   - Local dev server running on http://localhost:3000
 *   - .env at repo root with TEST_EMAIL + TEST_PASSWORD + SUPABASE_URL + SUPABASE_ANON_KEY
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run benchmark
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = "http://localhost:3000";
const N_RUNS = 5;
const SAMPLE_NOTE_COUNT = 3; // how many distinct notes to test single-note fetch with

// ─── .env loader ─────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadEnv(): Record<string, string> {
  const envPath = resolve(__dirname, "../../.env");
  try {
    const content = readFileSync(envPath, "utf8");
    const env: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      env[key] = val;
    }
    return env;
  } catch {
    return {};
  }
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function stats(samples: number[]): { avg: number; min: number; max: number; p95: number } {
  const sorted = [...samples].sort((a, b) => a - b);
  const avg = samples.reduce((s, v) => s + v, 0) / samples.length;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const p95idx = Math.ceil(0.95 * sorted.length) - 1;
  const p95 = sorted[Math.max(0, p95idx)];
  return { avg, min, max, p95 };
}

function fmt(n: number): string {
  return n.toFixed(1).padStart(7);
}

function label(name: string): string {
  return name.padEnd(52);
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function getAuthToken(env: Record<string, string>): Promise<string> {
  const supabaseUrl = env["SUPABASE_URL"];
  const anonKey = env["SUPABASE_ANON_KEY"];
  const email = env["TEST_EMAIL"];
  const password = env["TEST_PASSWORD"];

  if (!supabaseUrl || !anonKey || !email || !password) {
    throw new Error(
      "Missing env vars: SUPABASE_URL, SUPABASE_ANON_KEY, TEST_EMAIL, TEST_PASSWORD"
    );
  }

  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase auth failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("No access_token in Supabase auth response");
  return data.access_token;
}

// ─── Timed fetch ──────────────────────────────────────────────────────────────

async function timedFetch(
  url: string,
  options: RequestInit
): Promise<{ durationMs: number; status: number }> {
  const start = performance.now();
  const res = await fetch(url, options);
  const durationMs = performance.now() - start;
  // Drain the body so the connection is fully released
  await res.text();
  return { durationMs, status: res.status };
}

// ─── Benchmark runner ─────────────────────────────────────────────────────────

interface EndpointSpec {
  name: string;
  path: string;
  method?: string;
  body?: string;
}

async function runEndpoint(
  spec: EndpointSpec,
  token: string,
  runs: number
): Promise<{ name: string; samples: number[]; statuses: number[] }> {
  const samples: number[] = [];
  const statuses: number[] = [];

  for (let i = 0; i < runs; i++) {
    const { durationMs, status } = await timedFetch(`${BASE_URL}${spec.path}`, {
      method: spec.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: spec.body,
    });
    samples.push(durationMs);
    statuses.push(status);
    // Small pause between runs to avoid connection reuse inflating results
    await new Promise((r) => setTimeout(r, 50));
  }

  return { name: spec.name, samples, statuses };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🔐  Authenticating...");
  const env = loadEnv();
  const token = await getAuthToken(env);
  console.log("    ✓ Got auth token\n");

  // ── Warmup: fetch note list to get real IDs ───────────────────────────────
  console.log("📋  Fetching notes list to get sample note IDs...");
  const notesRes = await fetch(`${BASE_URL}/api/notes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!notesRes.ok) {
    throw new Error(`GET /api/notes failed: ${notesRes.status} ${await notesRes.text()}`);
  }
  const notes = (await notesRes.json()) as Array<{ id: number; title?: string; contentText?: string }>;
  if (!Array.isArray(notes) || notes.length === 0) {
    throw new Error("No notes found — create at least one note before benchmarking");
  }

  // Pick notes spread across the list: first, middle, last (or fewer if < 3)
  const indices = Array.from({ length: Math.min(SAMPLE_NOTE_COUNT, notes.length) }, (_, i) => {
    if (notes.length <= SAMPLE_NOTE_COUNT) return i;
    return Math.round((i / (SAMPLE_NOTE_COUNT - 1)) * (notes.length - 1));
  });
  const sampleNotes = indices.map((i) => notes[i]);
  console.log(`    ✓ ${notes.length} notes total — sampling IDs: ${sampleNotes.map((n) => n.id).join(", ")}\n`);

  // ── Fetch version IDs for one note ──────────────────────────────────────
  const versionNoteId = sampleNotes[0].id;
  const versionsRes = await fetch(`${BASE_URL}/api/notes/${versionNoteId}/versions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const hasVersions = versionsRes.ok;

  // ── Build endpoint list ───────────────────────────────────────────────────
  const endpoints: EndpointSpec[] = [
    { name: "GET /api/notes (list all)", path: "/api/notes" },
    { name: "GET /api/folders", path: "/api/folders" },
    { name: "GET /api/quick-bits", path: "/api/quick-bits" },
    { name: "GET /api/tags", path: "/api/tags" },
    ...sampleNotes.map((n) => ({
      name: `GET /api/notes/${n.id} (${(n.contentText?.length ?? 0)} chars)`,
      path: `/api/notes/${n.id}`,
    })),
    {
      name: `GET /api/notes/${versionNoteId}/versions`,
      path: `/api/notes/${versionNoteId}/versions`,
    },
    {
      name: `PATCH /api/notes/${sampleNotes[0].id} (save)`,
      path: `/api/notes/${sampleNotes[0].id}`,
      method: "PATCH",
      body: JSON.stringify({ contentText: "benchmark-probe " + Date.now() }),
    },
  ];

  // ── Run all benchmarks ────────────────────────────────────────────────────
  console.log(`⏱   Running ${N_RUNS} iterations per endpoint…\n`);

  const headerWidth = 52 + 8 + 8 + 8 + 8 + 4;
  console.log(
    label("Endpoint") +
      "   avg  " +
      "   min  " +
      "   max  " +
      "   p95  " +
      "  status"
  );
  console.log("─".repeat(headerWidth));

  const allResults: Array<{ name: string; avg: number; min: number; max: number; p95: number }> = [];

  for (const spec of endpoints) {
    const result = await runEndpoint(spec, token, N_RUNS);
    const s = stats(result.samples);
    allResults.push({ name: result.name, ...s });

    const allOk = result.statuses.every((c) => c >= 200 && c < 300);
    const statusStr = allOk
      ? "  ✓"
      : `  ${[...new Set(result.statuses)].join(",")}`;

    console.log(
      label(result.name) +
        `${fmt(s.avg)}ms` +
        `${fmt(s.min)}ms` +
        `${fmt(s.max)}ms` +
        `${fmt(s.p95)}ms` +
        statusStr
    );
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("─".repeat(headerWidth));
  const overallAvg = allResults.reduce((s, r) => s + r.avg, 0) / allResults.length;
  console.log(`\n📊  Overall mean response time across all endpoints: ${overallAvg.toFixed(1)}ms`);

  const slowest = allResults.reduce((a, b) => (b.p95 > a.p95 ? b : a));
  console.log(`🐢  Slowest (p95): ${slowest.name.trim()} → ${slowest.p95.toFixed(1)}ms`);

  const fastest = allResults.reduce((a, b) => (b.avg < a.avg ? b : a));
  console.log(`⚡  Fastest (avg): ${fastest.name.trim()} → ${fastest.avg.toFixed(1)}ms`);

  if (!hasVersions) {
    console.log(`\n⚠️   No version history found for note ${versionNoteId} — versions endpoint may return empty.`);
  }

  console.log(`\nℹ️   All times in ms. N=${N_RUNS} runs per endpoint. Local dev server at ${BASE_URL}.\n`);
}

main().catch((err) => {
  console.error("\n❌  Benchmark failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
