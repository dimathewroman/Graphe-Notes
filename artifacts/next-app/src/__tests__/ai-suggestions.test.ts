// G16 (Phase 10.4): the structured-output scaffold for Phase 6 background
// suggestions. Pins the "schema-valid JSON or repairs once" contract.
import { describe, it, expect } from "vitest";
import { parseAiSuggestions, AiSuggestionSchema, GEMINI_SUGGESTION_RESPONSE_CONFIG } from "@/lib/ai-suggestions";

const VALID = {
  suggestions: [
    { type: "grammar", original: "teh", suggestion: "the" },
    { type: "clarity", original: "utilize", suggestion: "use", explanation: "simpler" },
  ],
};

describe("parseAiSuggestions", () => {
  it("parses clean JSON", () => {
    expect(parseAiSuggestions(JSON.stringify(VALID))).toEqual(VALID);
  });

  it("parses JSON wrapped in a markdown code fence", () => {
    expect(parseAiSuggestions("```json\n" + JSON.stringify(VALID) + "\n```")).toEqual(VALID);
  });

  it("repairs once by extracting the object from surrounding prose", () => {
    const raw = `Here are your suggestions:\n${JSON.stringify(VALID)}\nHope that helps!`;
    expect(parseAiSuggestions(raw)).toEqual(VALID);
  });

  it("returns null for a schema-invalid shape", () => {
    expect(parseAiSuggestions(JSON.stringify({ suggestions: [{ type: "bogus", original: "a", suggestion: "b" }] }))).toBeNull();
    expect(parseAiSuggestions(JSON.stringify({ notSuggestions: [] }))).toBeNull();
  });

  it("returns null for non-JSON garbage", () => {
    expect(parseAiSuggestions("I could not do that.")).toBeNull();
    expect(parseAiSuggestions("")).toBeNull();
  });
});

describe("structured-output contract", () => {
  it("the schema accepts the documented shape and rejects a bad enum", () => {
    expect(AiSuggestionSchema.safeParse(VALID).success).toBe(true);
    expect(AiSuggestionSchema.safeParse({ suggestions: [{ type: "x", original: "a", suggestion: "b" }] }).success).toBe(false);
  });

  it("exposes a Gemini responseSchema config for native JSON output", () => {
    expect(GEMINI_SUGGESTION_RESPONSE_CONFIG.responseMimeType).toBe("application/json");
    expect(GEMINI_SUGGESTION_RESPONSE_CONFIG.responseSchema.required).toContain("suggestions");
  });
});
