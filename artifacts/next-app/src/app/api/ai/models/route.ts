import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, userApiKeysTable } from "@workspace/db";
import { getAuthUser } from "@/lib/auth-server";
import { decryptApiKey } from "@lib/encryption";
import { OPENAI_COMPATIBLE_BASE_URLS, openAiCompatibleModelsUrl } from "@lib/ai-providers";
import * as Sentry from "@sentry/nextjs";

// This route only ever fetches FIXED, provider-owned base URLs (no user-supplied
// URL reaches fetch), which is what keeps it free of server-side request forgery.
// Discovery for user-controlled endpoints — local_llm and custom_openai — happens
// client-side (the browser, which can actually reach the user's localhost), never
// through this server route.
const OPENAI_COMPATIBLE = new Set(Object.keys(OPENAI_COMPATIBLE_BASE_URLS));
const SUPPORTED_PROVIDERS = new Set([...OPENAI_COMPATIBLE, "anthropic"]);

// Discovery is best-effort UX, not a hot path — still bound it.
const DISCOVERY_TIMEOUT_MS = 10_000;

async function fetchOpenAiCompatibleModels(
  provider: string,
  modelsUrl: string,
  apiKey: string,
): Promise<string[]> {
  const res = await fetch(modelsUrl, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Provider models API error: ${res.status}`);
  const data = (await res.json()) as { data?: Array<{ id?: string }> };
  const ids = (data.data ?? [])
    .map((m) => m.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  // OpenAI's catalog includes embeddings/whisper/tts etc.; narrow to chat models.
  // Decide by provider identity — never by substring-matching the URL.
  const filtered = provider === "openai" ? ids.filter((id) => /^(gpt-|o1|o3|o4|chatgpt-4o)/.test(id)) : ids;
  return filtered.sort();
}

async function fetchAnthropicModels(apiKey: string): Promise<string[]> {
  const res = await fetch("https://api.anthropic.com/v1/models", {
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`);
  const data = (await res.json()) as { data: Array<{ id: string }> };
  return data.data.map((m) => m.id).sort();
}

// POST /api/ai/models
// Body: { provider, apiKey? }
//  - apiKey: use it directly (first-time entry); otherwise decrypt the stored key.
//  - Only fixed-base cloud providers are supported here (see note above).
// Returns: { models: string[] }
export async function POST(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const provider = body.provider;
    const providedKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

    if (typeof provider !== "string" || !SUPPORTED_PROVIDERS.has(provider)) {
      return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
    }

    let apiKey = providedKey;
    if (!apiKey) {
      const rows = await db
        .select()
        .from(userApiKeysTable)
        .where(and(eq(userApiKeysTable.userId, user.id), eq(userApiKeysTable.provider, provider)));
      if (!rows[0]?.encryptedKey) {
        return NextResponse.json({ error: "No API key stored for this provider" }, { status: 404 });
      }
      apiKey = decryptApiKey(rows[0].encryptedKey);
    }

    if (provider === "anthropic") {
      return NextResponse.json({ models: await fetchAnthropicModels(apiKey) });
    }

    // OpenAI-compatible with a fixed, provider-owned base URL — no user input in the URL.
    const base = OPENAI_COMPATIBLE_BASE_URLS[provider];
    const models = await fetchOpenAiCompatibleModels(provider, openAiCompatibleModelsUrl(base), apiKey);
    return NextResponse.json({ models });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
