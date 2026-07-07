import { describe, it, expect } from "vitest";
import {
  resolveModel,
  pickModelForTier,
  GEMINI_FLASH,
  GEMINI_FLASH_LITE,
  GEMINI_PRO,
} from "@lib/ai-model-router";

// Action-type tiers: the light "background" tier can use a separate fast model;
// everything else uses the main model. Fast falls back to main when unset.
describe("pickModelForTier", () => {
  it("uses the fast model for background actions when set", () => {
    expect(pickModelForTier("sonnet", "haiku", "background")).toBe("haiku");
  });
  it("falls back to the main model for background when no fast model is set", () => {
    expect(pickModelForTier("sonnet", null, "background")).toBe("sonnet");
    expect(pickModelForTier("sonnet", "", "background")).toBe("sonnet");
  });
  it("always uses the main model for manual/deliberate actions", () => {
    expect(pickModelForTier("sonnet", "haiku", "manual")).toBe("sonnet");
    expect(pickModelForTier("sonnet", "haiku", "deliberate")).toBe("sonnet");
  });
  it("returns undefined when nothing is configured (so resolveModel can decide)", () => {
    expect(pickModelForTier(null, null, "background")).toBeUndefined();
    expect(pickModelForTier(undefined, undefined, "manual")).toBeUndefined();
  });
});

// G10 (Phase 8.2): the Google model override set in Settings must be honored, not
// silently ignored. Free tier still ignores it (locked to Flash-Lite).
describe("resolveModel — Google model override (G10)", () => {
  it("honors an explicit Google override", () => {
    const r = resolveModel("google_ai_studio", "manual", "gemini-2.5-pro");
    expect(r.model).toBe("gemini-2.5-pro");
    expect(r.isAutoRouted).toBe(false);
  });

  it("auto-routes Google by taskType when no override is set", () => {
    expect(resolveModel("google_ai_studio", "background").model).toBe(GEMINI_FLASH_LITE);
    expect(resolveModel("google_ai_studio", "manual").model).toBe(GEMINI_FLASH);
    expect(resolveModel("google_ai_studio", "deliberate").model).toBe(GEMINI_PRO);
    expect(resolveModel("google_ai_studio", "manual").isAutoRouted).toBe(true);
  });

  it("free tier ignores any override (locked to Flash-Lite)", () => {
    const r = resolveModel("graphe_free", "manual", "gemini-2.5-pro");
    expect(r.model).toBe(GEMINI_FLASH_LITE);
    expect(r.isAutoRouted).toBe(true);
  });
});

// G17 (9.2): the OpenAI-compatible BYOK providers use the caller's explicit model.
describe("resolveModel — OpenAI-compatible providers (9.2)", () => {
  for (const p of ["openrouter", "groq", "mistral", "together", "fireworks", "custom_openai"] as const) {
    it(`${p} returns the explicit override, not auto-routed`, () => {
      const r = resolveModel(p, "manual", "some-model");
      expect(r.model).toBe("some-model");
      expect(r.isAutoRouted).toBe(false);
    });
    it(`${p} requires a model override`, () => {
      expect(() => resolveModel(p, "manual")).toThrow(/modelOverride is required/);
    });
  }
});
