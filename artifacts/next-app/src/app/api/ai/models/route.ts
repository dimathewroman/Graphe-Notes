import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, userApiKeysTable } from "@workspace/db";
import { getAuthUser } from "@/lib/auth-server";
import { decryptApiKey } from "@lib/encryption";

const SUPPORTED_PROVIDERS = ["openai", "anthropic"] as const;
type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

function isSupportedProvider(p: unknown): p is SupportedProvider {
  return typeof p === "string" && (SUPPORTED_PROVIDERS as readonly string[]).includes(p);
}

async function fetchOpenAIModels(apiKey: string): Promise<string[]> {
  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
  const data = (await res.json()) as { data: Array<{ id: string }> };
  return data.data
    .map((m) => m.id)
    .filter((id) => /^(gpt-|o1|o3|o4|chatgpt-4o)/.test(id))
    .sort();
}

async function fetchAnthropicModels(apiKey: string): Promise<string[]> {
  const res = await fetch("https://api.anthropic.com/v1/models", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
  });
  if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`);
  const data = (await res.json()) as { data: Array<{ id: string }> };
  return data.data.map((m) => m.id).sort();
}

// POST /api/ai/models
// Body: { provider: "openai" | "anthropic", apiKey?: string }
// If apiKey is provided, use it directly (user is entering key for first time).
// If not, decrypt the stored key from DB (key already saved).
// Returns: { models: string[] }
export async function POST(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const { provider, apiKey: providedKey } = body;

    if (!isSupportedProvider(provider)) {
      return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
    }

    let apiKey: string;

    if (typeof providedKey === "string" && providedKey.trim()) {
      apiKey = providedKey.trim();
    } else {
      const rows = await db
        .select()
        .from(userApiKeysTable)
        .where(
          and(
            eq(userApiKeysTable.userId, user.id),
            eq(userApiKeysTable.provider, provider),
          ),
        );

      if (!rows[0]?.encryptedKey) {
        return NextResponse.json(
          { error: "No API key stored for this provider" },
          { status: 404 },
        );
      }
      apiKey = decryptApiKey(rows[0].encryptedKey);
    }

    const models =
      provider === "openai"
        ? await fetchOpenAIModels(apiKey)
        : await fetchAnthropicModels(apiKey);

    return NextResponse.json({ models });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
