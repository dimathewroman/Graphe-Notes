import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, userApiKeysTable } from "@workspace/db";
import { getAuthUser } from "@/lib/auth-server";
import { decryptApiKey } from "@lib/encryption";
import { OPENAI_COMPATIBLE_BASE_URLS, openAiCompatibleModelsUrl } from "@lib/ai-providers";
import * as Sentry from "@sentry/nextjs";

// Providers whose models can be discovered. anthropic uses its own list shape;
// everything else is OpenAI-compatible (`{base}/models` → `{ data: [{ id }] }`).
// local_llm and custom_openai supply their base URL at request time.
const OPENAI_COMPATIBLE = new Set([
  "openai",
  "openrouter",
  "groq",
  "mistral",
  "together",
  "fireworks",
  "custom_openai",
]);
const SUPPORTED_PROVIDERS = new Set([...OPENAI_COMPATIBLE, "anthropic", "local_llm"]);

// Discovery is best-effort UX, not the hot path — but still bound it so a slow
// or hung provider endpoint can't hold the function open.
const DISCOVERY_TIMEOUT_MS = 10_000;

async function fetchOpenAiCompatibleModels(modelsUrl: string, apiKey?: string): Promise<string[]> {
  const res = await fetch(modelsUrl, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Provider models API error: ${res.status}`);
  const data = (await res.json()) as { data?: Array<{ id?: string }> };
  const ids = (data.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === "string" && id.length > 0);
  // OpenAI's catalog includes embeddings/whisper/tts etc.; narrow to chat models.
  const filtered = modelsUrl.includes("api.openai.com")
    ? ids.filter((id) => /^(gpt-|o1|o3|o4|chatgpt-4o)/.test(id))
    : ids;
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
// Body: { provider, apiKey?, endpointUrl? }
//  - apiKey: use it directly (first-time entry); otherwise decrypt the stored key.
//  - endpointUrl: required for custom_openai / local_llm model discovery; falls
//    back to the stored key row's endpoint.
// Returns: { models: string[] }
export async function POST(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const provider = body.provider;
    const providedKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const providedEndpoint = typeof body.endpointUrl === "string" ? body.endpointUrl.trim() : "";

    if (typeof provider !== "string" || !SUPPORTED_PROVIDERS.has(provider)) {
      return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
    }

    // Load the stored key row (for the decrypted key and/or the saved endpoint).
    const rows = await db
      .select()
      .from(userApiKeysTable)
      .where(and(eq(userApiKeysTable.userId, user.id), eq(userApiKeysTable.provider, provider)));
    const row = rows[0];

    const apiKey = providedKey || (row?.encryptedKey ? decryptApiKey(row.encryptedKey) : "");
    const endpoint = providedEndpoint || row?.endpointUrl || "";

    // local_llm: key optional, base = "{endpoint}/v1".
    if (provider === "local_llm") {
      if (!endpoint) return NextResponse.json({ error: "endpointUrl is required" }, { status: 400 });
      const base = `${endpoint.replace(/\/+$/, "")}/v1`;
      const models = await fetchOpenAiCompatibleModels(openAiCompatibleModelsUrl(base), apiKey || undefined);
      return NextResponse.json({ models });
    }

    if (provider === "anthropic") {
      if (!apiKey) return NextResponse.json({ error: "No API key stored for this provider" }, { status: 404 });
      return NextResponse.json({ models: await fetchAnthropicModels(apiKey) });
    }

    // OpenAI-compatible: fixed base from the shared map, or the user's endpoint
    // for custom_openai (which already includes the /v1 segment).
    if (OPENAI_COMPATIBLE.has(provider)) {
      if (!apiKey) return NextResponse.json({ error: "No API key stored for this provider" }, { status: 404 });
      const base = provider === "custom_openai" ? endpoint : OPENAI_COMPATIBLE_BASE_URLS[provider];
      if (!base) return NextResponse.json({ error: "endpointUrl is required" }, { status: 400 });
      const models = await fetchOpenAiCompatibleModels(openAiCompatibleModelsUrl(base), apiKey);
      return NextResponse.json({ models });
    }

    return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
