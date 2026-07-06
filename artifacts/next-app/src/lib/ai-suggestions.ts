// G16 (Phase 10.4): structured-output scaffold. Unused by any live flow today —
// it's the foundation for the always-on background assistant (roadmap Phase 6),
// where the model returns a list of suggestions as JSON rather than a blob of
// text. Landing the schema + a tolerant parser now means Phase 6 builds on a
// validated contract instead of inventing one under pressure.

import { z } from "zod";

export const AiSuggestionSchema = z.object({
  suggestions: z.array(
    z.object({
      type: z.enum(["grammar", "clarity", "tone", "structure", "other"]),
      original: z.string(),
      suggestion: z.string(),
      explanation: z.string().optional(),
    }),
  ),
});

export type AiSuggestions = z.infer<typeof AiSuggestionSchema>;

// Strip a leading/trailing markdown code fence the model often wraps JSON in.
function stripFences(raw: string): string {
  return raw
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

/**
 * Parse + validate model output as suggestions. Attempts a direct parse; if that
 * fails, repairs ONCE by extracting the outermost `{ … }` block (handles the model
 * prefixing prose like "Here are your suggestions:") and retries. Returns null if
 * still invalid — callers decide whether to surface an error or drop the batch.
 */
export function parseAiSuggestions(raw: string): AiSuggestions | null {
  const attempt = (s: string): AiSuggestions | null => {
    try {
      return AiSuggestionSchema.parse(JSON.parse(s));
    } catch {
      return null;
    }
  };

  const cleaned = stripFences(raw);
  const direct = attempt(cleaned);
  if (direct) return direct;

  // Single repair: pull the outermost object out of surrounding prose.
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) return attempt(cleaned.slice(start, end + 1));
  return null;
}

// Gemini generationConfig fragment that constrains output to the suggestion shape
// (native structured output). Unused today — wired up when Phase 6 lands the
// server-side suggestion path.
export const GEMINI_SUGGESTION_RESPONSE_CONFIG = {
  responseMimeType: "application/json",
  responseSchema: {
    type: "object",
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["grammar", "clarity", "tone", "structure", "other"] },
            original: { type: "string" },
            suggestion: { type: "string" },
            explanation: { type: "string" },
          },
          required: ["type", "original", "suggestion"],
        },
      },
    },
    required: ["suggestions"],
  },
} as const;
