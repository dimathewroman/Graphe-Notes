import { type NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { checkAndIncrementUsage } from "@lib/ai-rate-limit";
import { resolveModel, type TaskType } from "@lib/ai-model-router";
import { parseGeminiError } from "@lib/ai-error-handler";

// Fallback reference for Option 1 (built-in free tier). resolveModel is the
// source of truth for model selection — this constant is kept for reference only.
const OPTION1_MODEL = "gemini-2.5-flash-lite";

const VALID_TASK_TYPES = ["background", "manual", "deliberate"] as const;

export async function POST(request: NextRequest) {
  try {
    // --- Auth ---
    const { user } = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const rateLimit = await checkAndIncrementUsage(userId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "rate_limit_exceeded",
          reason: rateLimit.reason,
          hourlyUsed: rateLimit.hourlyUsed,
          hourlyLimit: rateLimit.hourlyLimit,
          resetInMs: rateLimit.resetInMs,
        },
        { status: 429 },
      );
    }

    // --- Request validation ---
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 });
    }

    const { taskType, prompt, context } = body as Record<string, unknown>;

    if (!taskType || !VALID_TASK_TYPES.includes(taskType as TaskType)) {
      return NextResponse.json(
        {
          error: `Missing or invalid taskType. Must be one of: ${VALID_TASK_TYPES.join(", ")}`,
        },
        { status: 400 },
      );
    }

    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      return NextResponse.json(
        { error: "Missing or empty required field: prompt" },
        { status: 400 },
      );
    }

    if (context !== undefined && typeof context !== "string") {
      return NextResponse.json({ error: "context must be a string if provided" }, { status: 400 });
    }

    const routing = resolveModel("graphe_free", taskType as TaskType);

    // --- Gemini API key ---
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY environment variable is required but not set. Add it to .env.local for local development and to Vercel environment variables for production.",
      );
    }

    // --- Build prompt ---
    const combinedPrompt = context ? `${prompt}\n${context}` : prompt;

    // --- Call Gemini ---
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${routing.model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: combinedPrompt }] }],
          generationConfig: { maxOutputTokens: 1024 },
        }),
      },
    );

    if (!geminiResponse.ok) {
      const rawErrorBody = await geminiResponse.text();
      const parsedError = parseGeminiError(geminiResponse.status, rawErrorBody);

      if (parsedError.type === "rpm_limit") {
        return NextResponse.json(
          { error: parsedError.type, userMessage: parsedError.userMessage, retryAfterMs: parsedError.retryAfterMs },
          { status: 429 },
        );
      }
      if (parsedError.type === "rpd_limit") {
        return NextResponse.json(
          { error: parsedError.type, userMessage: parsedError.userMessage, retryAfterMs: null },
          { status: 429 },
        );
      }
      if (parsedError.type === "invalid_key") {
        return NextResponse.json(
          { error: parsedError.type, userMessage: parsedError.userMessage },
          { status: 401 },
        );
      }
      // unknown and model_unavailable → 502
      return NextResponse.json(
        { error: parsedError.type, userMessage: parsedError.userMessage },
        { status: 502 },
      );
    }

    // --- Parse response ---
    const data = (await geminiResponse.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };

    const result = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const inputTokens = data.usageMetadata?.promptTokenCount ?? null;
    const outputTokens = data.usageMetadata?.candidatesTokenCount ?? null;

    return NextResponse.json({
      result,
      model: routing.model,
      tokensUsed: { inputTokens, outputTokens },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
