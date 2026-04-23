import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, userApiKeysTable } from "@workspace/db";
import { getAuthUser } from "@/lib/auth-server";
import { encryptApiKey } from "@lib/encryption";

const VALID_PROVIDERS = [
  "graphe_free",
  "google_ai_studio",
  "openai",
  "anthropic",
  "local_llm",
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
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    );
  } catch (err) {
    console.error("[ai/keys GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/ai/keys — save or update an API key for a provider
export async function POST(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const { provider, apiKey, endpointUrl, modelOverride } = body;

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
        endpointUrl: typeof endpointUrl === "string" ? endpointUrl.trim() || null : null,
        modelOverride: typeof modelOverride === "string" ? modelOverride.trim() || null : null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [userApiKeysTable.userId, userApiKeysTable.provider],
        set: {
          encryptedKey: encrypted,
          endpointUrl: typeof endpointUrl === "string" ? endpointUrl.trim() || null : null,
          modelOverride: typeof modelOverride === "string" ? modelOverride.trim() || null : null,
          updatedAt: now,
        },
      });

    return NextResponse.json({ success: true, provider });
  } catch (err) {
    console.error("[ai/keys POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/ai/keys — update modelOverride for an existing key without re-encrypting
export async function PATCH(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const { provider, modelOverride } = body;

    if (!isValidProvider(provider)) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}` },
        { status: 400 },
      );
    }

    const now = new Date();
    await db
      .update(userApiKeysTable)
      .set({
        modelOverride: typeof modelOverride === "string" ? modelOverride.trim() || null : null,
        updatedAt: now,
      })
      .where(
        and(
          eq(userApiKeysTable.userId, user.id),
          eq(userApiKeysTable.provider, provider),
        ),
      );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[ai/keys PATCH]", err);
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
    console.error("[ai/keys DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
