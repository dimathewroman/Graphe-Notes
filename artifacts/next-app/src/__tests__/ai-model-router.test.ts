import { describe, it, expect } from "vitest";
import {
  resolveModel,
  GEMINI_FLASH,
  GEMINI_FLASH_LITE,
  GEMINI_PRO,
} from "@lib/ai-model-router";

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
