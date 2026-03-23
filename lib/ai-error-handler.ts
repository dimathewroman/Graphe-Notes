export type GeminiErrorType =
  | "rpm_limit"
  | "rpd_limit"
  | "invalid_key"
  | "model_unavailable"
  | "unknown";

export type ParsedGeminiError = {
  type: GeminiErrorType;
  retryAfterMs: number | null;
  userMessage: string;
  raw: string;
};

const USER_MESSAGES: Record<GeminiErrorType, string> = {
  rpm_limit: "Gemini is busy right now. Retrying in a moment.",
  rpd_limit:
    "You've reached your daily limit for this model. It resets at midnight Pacific time. You can switch to a lower-tier model in the meantime.",
  invalid_key: "Your API key appears to be invalid. Please check it in Settings.",
  model_unavailable: "This model is unavailable. Please try a different one.",
  unknown: "Something went wrong with the AI request. Please try again.",
};

export function parseGeminiError(status: number, rawBody: string): ParsedGeminiError {
  const make = (type: GeminiErrorType, retryAfterMs: number | null): ParsedGeminiError => ({
    type,
    retryAfterMs,
    userMessage: USER_MESSAGES[type],
    raw: rawBody,
  });

  if (status === 429) {
    try {
      const parsed = JSON.parse(rawBody) as { error?: { message?: string } };
      const msg = parsed?.error?.message ?? "";
      const hasQuota = msg.toLowerCase().includes("quota");
      if (hasQuota && (msg.toLowerCase().includes("per minute") || msg.toUpperCase().includes("RPM"))) {
        return make("rpm_limit", 65000);
      }
      if (
        hasQuota &&
        (msg.toLowerCase().includes("per day") ||
          msg.toUpperCase().includes("RPD") ||
          msg.toLowerCase().includes("daily"))
      ) {
        return make("rpd_limit", null);
      }
    } catch {
      // JSON parse failed — fall through to safe default
    }
    // Safe default for unknown 429s
    return make("rpm_limit", 65000);
  }

  if (status === 400 && rawBody.includes("API_KEY_INVALID")) {
    return make("invalid_key", null);
  }

  if (
    status === 404 ||
    rawBody.includes("model is not supported") ||
    rawBody.includes("not found")
  ) {
    return make("model_unavailable", null);
  }

  return make("unknown", null);
}
