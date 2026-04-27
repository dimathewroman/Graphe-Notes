import { type NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, userSettingsTable, userApiKeysTable } from "@workspace/db";
import { getAuthUser } from "@/lib/auth-server";
import { decryptApiKey } from "@lib/encryption";
import * as Sentry from "@sentry/nextjs";

// GET /api/ai/settings — returns the user's active AI provider preference
export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rows = await db
      .select()
      .from(userSettingsTable)
      .where(eq(userSettingsTable.userId, user.id));

    const activeProvider = rows[0]?.activeAiProvider ?? null;
    const response: {
      activeAiProvider: string | null;
      hasCompletedAiSetup: boolean;
      localLlmEndpoint?: string | null;
      localLlmModel?: string | null;
      localLlmApiKey?: string | null;
    } = {
      activeAiProvider: activeProvider,
      hasCompletedAiSetup: rows[0]?.hasCompletedAiSetup ?? false,
    };

    if (activeProvider === "local_llm") {
      const keyRows = await db
        .select()
        .from(userApiKeysTable)
        .where(
          and(
            eq(userApiKeysTable.userId, user.id),
            eq(userApiKeysTable.provider, "local_llm"),
          ),
        );
      const keyRow = keyRows[0];
      response.localLlmEndpoint = keyRow?.endpointUrl ?? null;
      response.localLlmModel = keyRow?.modelOverride ?? null;
      // The server can't reach the user's local LLM, so the browser makes the
      // request directly. The API key (if any) has to travel with it.
      response.localLlmApiKey = keyRow?.encryptedKey
        ? decryptApiKey(keyRow.encryptedKey)
        : null;
    }

    return NextResponse.json(response);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/ai/settings — upsert the user's active AI provider preference
export async function PATCH(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const { activeAiProvider, hasCompletedAiSetup } = body;

    // activeAiProvider must be null or a non-empty string (if provided)
    if (
      "activeAiProvider" in body &&
      activeAiProvider !== null &&
      (typeof activeAiProvider !== "string" || !activeAiProvider.trim())
    ) {
      return NextResponse.json(
        { error: "activeAiProvider must be a non-empty string or null" },
        { status: 400 }
      );
    }

    if ("hasCompletedAiSetup" in body && typeof hasCompletedAiSetup !== "boolean") {
      return NextResponse.json(
        { error: "hasCompletedAiSetup must be a boolean" },
        { status: 400 }
      );
    }

    // Build the set clause from only the fields present in the request
    const now = new Date();
    const setClause: Partial<typeof userSettingsTable.$inferInsert> & { updatedAt: Date } = {
      updatedAt: now,
    };
    if ("activeAiProvider" in body) {
      setClause.activeAiProvider = (activeAiProvider as string | null) ?? null;
    }
    if ("hasCompletedAiSetup" in body) {
      setClause.hasCompletedAiSetup = hasCompletedAiSetup as boolean;
    }

    // Build insert values — include all provided fields plus userId
    const insertValues: typeof userSettingsTable.$inferInsert = {
      userId: user.id,
      updatedAt: now,
      ...("activeAiProvider" in body ? { activeAiProvider: (activeAiProvider as string | null) ?? null } : {}),
      ...("hasCompletedAiSetup" in body ? { hasCompletedAiSetup: hasCompletedAiSetup as boolean } : {}),
    };

    await db
      .insert(userSettingsTable)
      .values(insertValues)
      .onConflictDoUpdate({
        target: userSettingsTable.userId,
        set: setClause,
      });

    return NextResponse.json({ success: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
