import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, userApiKeysTable } from "@workspace/db";
import { getAuthUser } from "@/lib/auth-server";
import { encryptApiKey } from "@lib/encryption";
import { isSafeExternalUrl } from "@lib/url-guard";
import * as Sentry from "@sentry/nextjs";

const VALID_PROVIDERS = [
  "graphe_free",
  "google_ai_studio",
  "openai",
  "anthropic",
  "local_llm",
  // G17 (9.2): OpenAI-compatible BYOK providers. Fixed base URLs live in the
  // adapter table; custom_openai additionally requires a user-supplied endpoint.
  "openrouter",
  "groq",
  "mistral",
  "together",
  "fireworks",
  "custom_openai",
] as const;

type ValidProvider = (typeof VALID_PROVIDERS)[number];

function isValidProvider(p: unknown): p is ValidProvider {
  return typeof p === "string" && (VALID_PROVIDERS as readonly string[]).includes(p);
}

// GET /api/ai/keys — returns key metadata (never the decrypted key)
export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rows = await db
      .select()
      .from(userApiKeysTable)
      .where(eq(userApiKeysTable.userId, user.id));

    return NextResponse.json(
      rows.map((r) => ({
        provider: r.provider,
        hasKey: !!r.encryptedKey,
        endpointUrl: r.endpointUrl,
        modelOverride: r.modelOverride,
        fastModelOverride: r.fastModelOverride,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    );
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/ai/keys — save or update an API key for a provider
export async function POST(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const { provider, apiKey, endpointUrl, modelOverride, fastModelOverride } = body;
    // Normalize an optional string field to a trimmed value or null.
    const asText = (v: unknown) => (typeof v === "string" ? v.trim() || null : null);

    if (!isValidProvider(provider)) {
      return NextResponse.json(
        {
          error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}`,
        },
        { status: 400 },
      );
    }

    const requiresApiKey = provider !== "graphe_free" && provider !== "local_llm";
    if (requiresApiKey && (!apiKey || typeof apiKey !== "string" || !apiKey.trim())) {
      return NextResponse.json(
        { error: "apiKey is required for this provider" },
        { status: 400 },
      );
    }

    // custom_openai has no fixed base URL — the user must supply where to send
    // requests. Without it the generate route would build an invalid "/chat/completions".
    // The generate route fetches this URL server-side, so guard against SSRF: only
    // a routable, non-internal http(s) host may be stored.
    if (provider === "custom_openai") {
      if (typeof endpointUrl !== "string" || !endpointUrl.trim()) {
        return NextResponse.json(
          { error: "endpointUrl is required for a custom OpenAI-compatible provider" },
          { status: 400 },
        );
      }
      if (!isSafeExternalUrl(endpointUrl.trim())) {
        return NextResponse.json(
          { error: "endpointUrl must be a public https/http URL (internal and loopback addresses are not allowed)" },
          { status: 400 },
        );
      }
    }

    // local_llm: apiKey is optional. If present, encrypt and store it for
    // servers that require an Authorization header (vLLM, llama.cpp, etc).
    const hasOptionalLocalKey =
      provider === "local_llm" && typeof apiKey === "string" && apiKey.trim().length > 0;

    const encrypted =
      provider === "graphe_free"
        ? ""
        : provider === "local_llm"
          ? hasOptionalLocalKey
            ? encryptApiKey((apiKey as string).trim())
            : ""
          : encryptApiKey((apiKey as string).trim());

    const now = new Date();
    await db
      .insert(userApiKeysTable)
      .values({
        userId: user.id,
        provider,
        encryptedKey: encrypted,
        endpointUrl: asText(endpointUrl),
        modelOverride: asText(modelOverride),
        fastModelOverride: asText(fastModelOverride),
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [userApiKeysTable.userId, userApiKeysTable.provider],
        set: {
          encryptedKey: encrypted,
          endpointUrl: asText(endpointUrl),
          modelOverride: asText(modelOverride),
          fastModelOverride: asText(fastModelOverride),
          updatedAt: now,
        },
      });

    return NextResponse.json({ success: true, provider });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/ai/keys — update modelOverride for an existing key without re-encrypting
export async function PATCH(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const { provider, modelOverride, fastModelOverride } = body;

    if (!isValidProvider(provider)) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}` },
        { status: 400 },
      );
    }

    // Only patch the fields actually present, so a model-only update doesn't wipe
    // the fast model (and vice-versa).
    const patch: { modelOverride?: string | null; fastModelOverride?: string | null; updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if ("modelOverride" in body) patch.modelOverride = typeof modelOverride === "string" ? modelOverride.trim() || null : null;
    if ("fastModelOverride" in body) patch.fastModelOverride = typeof fastModelOverride === "string" ? fastModelOverride.trim() || null : null;

    await db
      .update(userApiKeysTable)
      .set(patch)
      .where(
        and(
          eq(userApiKeysTable.userId, user.id),
          eq(userApiKeysTable.provider, provider),
        ),
      );

    return NextResponse.json({ success: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/ai/keys — remove a provider's key row
export async function DELETE(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const { provider } = body;

    if (!isValidProvider(provider)) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}` },
        { status: 400 },
      );
    }

    await db
      .delete(userApiKeysTable)
      .where(
        and(
          eq(userApiKeysTable.userId, user.id),
          eq(userApiKeysTable.provider, provider),
        ),
      );

    return NextResponse.json({ success: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
