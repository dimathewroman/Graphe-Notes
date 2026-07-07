// G19 (Phase 9.4): the free tier no longer hardcodes a model id — it discovers
// the lightest available one and re-discovers when the cached id 404s. These
// tests pin the ranking (which model gets chosen) and the fallback contract
// (every failure path returns the constant, so discovery never regresses).
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  pickLightestModel,
  filterGeminiChatModels,
  listGeminiModels,
  resolveFreeTierModel,
  invalidateFreeTierModel,
  __resetFreeTierModelCache,
} from "@lib/gemini-model-discovery";
import { GEMINI_FLASH_LITE } from "@lib/ai-model-router";

const gen = (name: string) => ({ name, supportedGenerationMethods: ["generateContent"] });

describe("filterGeminiChatModels (BYOK model dropdown)", () => {
  it("keeps only generateContent models, strips the models/ prefix, drops embedding/aqa, sorts", () => {
    const out = filterGeminiChatModels([
      gen("models/gemini-2.5-pro"),
      gen("models/gemini-2.5-flash"),
      { name: "models/text-embedding-004", supportedGenerationMethods: ["embedContent"] },
      { name: "models/aqa", supportedGenerationMethods: ["generateAnswer"] },
      { name: "models/embedding-gecko", supportedGenerationMethods: ["generateContent"] }, // has generateContent but is an embedding helper
    ]);
    expect(out).toEqual(["gemini-2.5-flash", "gemini-2.5-pro"]);
  });

  it("de-dupes", () => {
    expect(filterGeminiChatModels([gen("models/gemini-2.5-flash"), gen("models/gemini-2.5-flash")])).toEqual(["gemini-2.5-flash"]);
  });
});

describe("listGeminiModels", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetches ListModels and returns the filtered chat models", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ models: [gen("models/gemini-2.5-flash"), gen("models/gemini-2.5-pro")] }) }));
    expect(await listGeminiModels("k")).toEqual(["gemini-2.5-flash", "gemini-2.5-pro"]);
  });

  it("throws on a non-OK response (so the caller can surface the failure)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    await expect(listGeminiModels("bad")).rejects.toThrow(/ListModels error: 403/);
  });
});

describe("pickLightestModel", () => {
  it("prefers flash-lite over flash and pro", () => {
    expect(
      pickLightestModel([gen("models/gemini-2.5-pro"), gen("models/gemini-2.5-flash"), gen("models/gemini-2.5-flash-lite")]),
    ).toBe("gemini-2.5-flash-lite");
  });

  it("falls through the tiers: flash-8b when no flash-lite, flash when neither", () => {
    expect(pickLightestModel([gen("models/gemini-1.5-flash-8b"), gen("models/gemini-2.5-flash")])).toBe("gemini-1.5-flash-8b");
    expect(pickLightestModel([gen("models/gemini-2.5-flash"), gen("models/gemini-2.5-pro")])).toBe("gemini-2.5-flash");
  });

  it("prefers a stable id over a preview/exp one in the same tier", () => {
    expect(
      pickLightestModel([gen("models/gemini-2.5-flash-lite-preview-09"), gen("models/gemini-2.5-flash-lite")]),
    ).toBe("gemini-2.5-flash-lite");
  });

  it("ignores models that can't generateContent", () => {
    expect(
      pickLightestModel([
        { name: "models/gemini-2.5-flash-lite", supportedGenerationMethods: ["embedContent"] },
        gen("models/gemini-2.5-flash"),
      ]),
    ).toBe("gemini-2.5-flash");
  });

  it("returns null when nothing light matches (never auto-routes to pro)", () => {
    expect(pickLightestModel([gen("models/gemini-2.5-pro")])).toBeNull();
    expect(pickLightestModel([])).toBeNull();
  });
});

describe("resolveFreeTierModel", () => {
  beforeEach(() => __resetFreeTierModelCache());
  afterEach(() => vi.unstubAllGlobals());

  const mockList = (models: unknown[], ok = true) =>
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok, json: async () => ({ models }) }));

  it("returns the discovered model and caches it (one network call)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ models: [gen("models/gemini-9-flash-lite")] }) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await resolveFreeTierModel("k")).toBe("gemini-9-flash-lite");
    expect(await resolveFreeTierModel("k")).toBe("gemini-9-flash-lite"); // cached
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the constant when the list is empty or unmatched", async () => {
    mockList([gen("models/gemini-2.5-pro")]);
    expect(await resolveFreeTierModel("k")).toBe(GEMINI_FLASH_LITE);
  });

  it("falls back to the constant on a non-OK response", async () => {
    mockList([], false);
    expect(await resolveFreeTierModel("k")).toBe(GEMINI_FLASH_LITE);
  });

  it("falls back to the constant when the fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect(await resolveFreeTierModel("k")).toBe(GEMINI_FLASH_LITE);
  });

  it("re-discovers after invalidation (simulating a retired model 404)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ models: [gen("models/old-flash-lite")] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ models: [gen("models/new-flash-lite")] }) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await resolveFreeTierModel("k")).toBe("old-flash-lite");
    invalidateFreeTierModel();
    expect(await resolveFreeTierModel("k")).toBe("new-flash-lite");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
