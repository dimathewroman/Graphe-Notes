// G19 (Phase 9.4) — self-healing free-tier model selection.
//
// The free tier was hardcoded to a single Gemini model id. When Google retires
// that id (they deprecate models on a rolling basis) every free-tier request
// starts 404ing and the free AI features break silently. This module discovers
// the lightest currently-available model from Gemini's ListModels API, caches
// it, and re-discovers on demand (e.g. after a 404). Every failure path falls
// back to the hardcoded constant, so discovery can only ever improve on — never
// regress below — the previous behavior.

import { GEMINI_FLASH_LITE } from "./ai-model-router";

const LIST_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models";
// Module-level cache. In serverless this is per-instance and ephemeral — exactly
// what we want: a warm instance skips the extra round-trip, a cold one pays it
// once. TTL bounds staleness so a newly-published lighter model gets picked up.
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let cached: { model: string; at: number } | null = null;

interface GeminiModel {
  name?: string;
  supportedGenerationMethods?: string[];
}

/**
 * Pick the lightest (cheapest / fastest) model from a ListModels response.
 * Pure so the ranking is unit-testable independent of the network.
 *
 * Ranking, lightest first: flash-lite → flash-8b → flash → (anything else is
 * ignored — we never auto-route the free tier to a pro-tier model). Within a
 * tier, stable non-preview/-exp ids win over preview/experimental ones, then
 * the shortest id (a proxy for the base variant over dated snapshots).
 * Returns null when nothing generateContent-capable matches a light tier.
 */
export function pickLightestModel(models: GeminiModel[]): string | null {
  const TIERS = ["flash-lite", "flash-8b", "flash"];
  const candidates = models
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => (m.name ?? "").replace(/^models\//, ""))
    .filter(Boolean);

  for (const tier of TIERS) {
    const inTier = candidates.filter((id) => id.includes(tier));
    if (inTier.length === 0) continue;
    inTier.sort((a, b) => {
      const aUnstable = /preview|exp/.test(a) ? 1 : 0;
      const bUnstable = /preview|exp/.test(b) ? 1 : 0;
      if (aUnstable !== bUnstable) return aUnstable - bUnstable; // stable first
      if (a.length !== b.length) return a.length - b.length; // shortest (base) first
      return a < b ? -1 : 1; // deterministic tie-break
    });
    return inTier[0];
  }
  return null;
}

// Shared ListModels fetch. Returns the raw model array (empty on any failure);
// callers decide how to rank/filter. `resolveFreeTierModel` needs best-effort
// (never throws); BYOK discovery wants the error to surface, so it re-fetches.
async function fetchGeminiModels(apiKey: string): Promise<GeminiModel[]> {
  const res = await fetch(LIST_MODELS_URL, {
    headers: { "x-goog-api-key": apiKey },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Gemini ListModels error: ${res.status}`);
  const data = (await res.json()) as { models?: GeminiModel[] };
  return data.models ?? [];
}

/**
 * All chat-capable Gemini model ids from a ListModels response — pure so the
 * filter is unit-testable. Keeps only generateContent models, strips the
 * `models/` prefix, drops embedding/aqa helpers, de-dupes and sorts.
 */
export function filterGeminiChatModels(models: GeminiModel[]): string[] {
  const ids = models
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => (m.name ?? "").replace(/^models\//, ""))
    .filter((id) => id && !/embedding|aqa/i.test(id));
  return [...new Set(ids)].sort();
}

/**
 * List every chat-capable Gemini model for a BYOK Google key (Settings model
 * dropdown). Throws on network / non-OK so the caller can surface the failure —
 * unlike resolveFreeTierModel, which is best-effort.
 */
export async function listGeminiModels(apiKey: string): Promise<string[]> {
  return filterGeminiChatModels(await fetchGeminiModels(apiKey));
}

/**
 * Resolve the free-tier model id, using a cached discovery result when fresh.
 * Any failure (network, non-OK, empty/unmatched list) falls back to the
 * hardcoded constant — discovery is strictly best-effort.
 */
export async function resolveFreeTierModel(apiKey: string): Promise<string> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.model;
  try {
    const picked = pickLightestModel(await fetchGeminiModels(apiKey));
    if (!picked) return GEMINI_FLASH_LITE;
    cached = { model: picked, at: Date.now() };
    return picked;
  } catch {
    return GEMINI_FLASH_LITE;
  }
}

/**
 * Drop the cached model so the next resolve re-discovers. Call this when a
 * generateContent request 404s — the cached id was retired upstream.
 */
export function invalidateFreeTierModel(): void {
  cached = null;
}

/** Test-only: reset module state between cases. */
export function __resetFreeTierModelCache(): void {
  cached = null;
}
