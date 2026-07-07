// G17 (Phase 9.2): the provider adapter table is where the route's per-provider
// request/parse logic now lives. The route dispatch is thin; these tests cover the
// substance (body shape, response parsing, truncation detection, URL building).
import { describe, it, expect } from "vitest";
import {
  PROVIDER_ADAPTERS,
  openAiCompatibleAdapter,
  openAiCompatibleModelsUrl,
  OPENAI_COMPATIBLE_BASE_URLS,
  geminiAdapter,
  geminiThinkingBudget,
  geminiGenerationConfig,
  anthropicAdapter,
} from "@lib/ai-providers";

describe("OpenAI-compatible adapter", () => {
  const a = openAiCompatibleAdapter("https://api.openai.com/v1");

  it("builds a chat-completions request body", () => {
    expect(a.body("gpt-4o", "hi", 1024)).toEqual({
      model: "gpt-4o",
      messages: [{ role: "user", content: "hi" }],
      max_tokens: 1024,
    });
  });

  it("parses text + usage and detects length truncation", () => {
    const ok = a.parse({ choices: [{ message: { content: "yo" }, finish_reason: "stop" }], usage: { prompt_tokens: 3, completion_tokens: 5 } });
    expect(ok).toEqual({ text: "yo", truncated: false, filtered: false, inputTokens: 3, outputTokens: 5 });
    expect(a.parse({ choices: [{ message: { content: "cut" }, finish_reason: "length" }] }).truncated).toBe(true);
  });

  it("uses a fixed base URL, or the caller endpoint for the custom adapter", () => {
    expect(a.url("m")).toBe("https://api.openai.com/v1/chat/completions");
    const custom = openAiCompatibleAdapter();
    expect(custom.url("m", "https://my-host/v1/")).toBe("https://my-host/v1/chat/completions");
  });

  it("sends a Bearer auth header", () => {
    expect(a.headers("sk-abc").Authorization).toBe("Bearer sk-abc");
  });
});

describe("Gemini adapter", () => {
  it("builds generateContent body and puts the model in the URL", () => {
    expect(geminiAdapter.body("m", "hi", 512)).toEqual({
      contents: [{ parts: [{ text: "hi" }] }],
      generationConfig: { maxOutputTokens: 512 },
    });
    expect(geminiAdapter.url("gemini-2.5-flash")).toContain("/models/gemini-2.5-flash:generateContent");
    expect(geminiAdapter.headers("k")["x-goog-api-key"]).toBe("k");
  });

  it("parses candidates + detects MAX_TOKENS truncation", () => {
    expect(geminiAdapter.parse({ candidates: [{ content: { parts: [{ text: "hey" }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 4 } }))
      .toEqual({ text: "hey", truncated: false, filtered: false, inputTokens: 2, outputTokens: 4 });
    expect(geminiAdapter.parse({ candidates: [{ content: { parts: [{ text: "x" }] }, finishReason: "MAX_TOKENS" }] }).truncated).toBe(true);
  });
});

describe("adapter error + content-filter mapping", () => {
  it("Gemini flags a safety finishReason as filtered", () => {
    expect(geminiAdapter.parse({ candidates: [{ finishReason: "SAFETY" }] }).filtered).toBe(true);
    expect(geminiAdapter.parse({ promptFeedback: { blockReason: "SAFETY" } }).filtered).toBe(true);
    expect(geminiAdapter.parse({ candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }] }).filtered).toBe(false);
  });

  it("Gemini mapError forwards the classifier code + status", () => {
    const rpm = geminiAdapter.mapError(429, JSON.stringify({ error: { message: "x", details: [{ "@type": "QuotaFailure", violations: [{ quotaId: "…PerMinute…" }] }, { "@type": "RetryInfo", retryDelay: "5s" }] } }));
    expect(rpm.code).toBe("provider_rpm");
    expect(rpm.httpStatus).toBe(429);
    expect(rpm.retryAfterMs).toBe(5000);
    expect(geminiAdapter.mapError(400, "API_KEY_INVALID").code).toBe("invalid_key");
  });

  it("OpenAI-compatible mapError separates rate-limit from out-of-credit 429s", () => {
    const a = openAiCompatibleAdapter("https://api.openai.com/v1");
    expect(a.mapError(429, "rate limit reached").code).toBe("provider_rpm");
    expect(a.mapError(429, JSON.stringify({ error: { code: "insufficient_quota" } })).code).toBe("provider_quota_unknown");
    expect(a.mapError(401, "bad key").code).toBe("invalid_key");
    expect(a.mapError(404, "no model").code).toBe("model_unavailable");
    expect(a.parse({ choices: [{ message: { content: "" }, finish_reason: "content_filter" }] }).filtered).toBe(true);
  });
});

describe("Gemini thinking budget (truncation fix)", () => {
  // Regression: Gemini 2.5 bills thinking tokens against maxOutputTokens, so with
  // thinking left on, a real note's request spends the whole budget thinking and
  // truncates (MAX_TOKENS) — silently, on the streaming path. These transforms
  // don't need reasoning, so thinking is disabled per-model.
  it("disables thinking for Flash / Flash-Lite (budget 0), floors Pro at 128", () => {
    expect(geminiThinkingBudget("gemini-2.5-flash")).toBe(0);
    expect(geminiThinkingBudget("gemini-2.5-flash-lite")).toBe(0);
    expect(geminiThinkingBudget("gemini-2.5-pro")).toBe(128); // Pro can't be fully disabled
  });

  it("returns null for non-2.5 models (thinkingConfig is 2.5-only; would 400 otherwise)", () => {
    expect(geminiThinkingBudget("gemini-1.5-flash")).toBeNull();
    expect(geminiThinkingBudget("gemini-2.0-flash")).toBeNull();
    expect(geminiThinkingBudget("m")).toBeNull();
  });

  it("geminiGenerationConfig includes thinkingConfig only for 2.5 models", () => {
    expect(geminiGenerationConfig("gemini-2.5-flash", 4096)).toEqual({
      maxOutputTokens: 4096,
      thinkingConfig: { thinkingBudget: 0 },
    });
    // Non-2.5 → no thinkingConfig key at all.
    expect(geminiGenerationConfig("gemini-1.5-flash", 4096)).toEqual({ maxOutputTokens: 4096 });
  });

  it("body + streamBody carry the thinking budget for a 2.5 model", () => {
    const body = geminiAdapter.body("gemini-2.5-flash", "hi", 4096) as { generationConfig: Record<string, unknown> };
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
    const stream = geminiAdapter.streamBody("gemini-2.5-pro", "hi", 4096) as { generationConfig: Record<string, unknown> };
    expect(stream.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 128 });
  });
});

describe("Anthropic adapter", () => {
  it("parses content + detects max_tokens truncation", () => {
    expect(anthropicAdapter.parse({ content: [{ text: "claude" }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 2 } }))
      .toEqual({ text: "claude", truncated: false, filtered: false, inputTokens: 1, outputTokens: 2 });
    expect(anthropicAdapter.parse({ content: [{ text: "x" }], stop_reason: "max_tokens" }).truncated).toBe(true);
  });
});

describe("PROVIDER_ADAPTERS registry", () => {
  it("registers all BYOK providers (adding one is a single record)", () => {
    for (const p of ["google_ai_studio", "anthropic", "openai", "openrouter", "groq", "mistral", "together", "fireworks", "custom_openai"]) {
      expect(PROVIDER_ADAPTERS[p], p).toBeTruthy();
    }
  });

  it("routes the six OpenAI-compatible providers to their own base URLs", () => {
    expect(PROVIDER_ADAPTERS.groq.url("m")).toContain("api.groq.com");
    expect(PROVIDER_ADAPTERS.openrouter.url("m")).toContain("openrouter.ai");
    expect(PROVIDER_ADAPTERS.mistral.url("m")).toContain("mistral.ai");
    expect(PROVIDER_ADAPTERS.together.url("m")).toContain("together.xyz");
    expect(PROVIDER_ADAPTERS.fireworks.url("m")).toContain("fireworks.ai");
  });

  it("shares the base-URL map with the adapter table (single source of truth)", () => {
    // The adapter's chat URL must derive from the same base the models route uses.
    for (const [p, base] of Object.entries(OPENAI_COMPATIBLE_BASE_URLS)) {
      expect(PROVIDER_ADAPTERS[p].url("m")).toBe(`${base}/chat/completions`);
    }
  });
});

describe("system role placement (G12, 10.1)", () => {
  it("OpenAI-compatible prepends a system message when system is given", () => {
    const a = openAiCompatibleAdapter("https://api.openai.com/v1");
    expect(a.body("m", "content", 100, "do the task")).toEqual({
      model: "m",
      messages: [{ role: "system", content: "do the task" }, { role: "user", content: "content" }],
      max_tokens: 100,
    });
    // No system → single user message (freeform / AIPanel path).
    expect((a.body("m", "content", 100) as { messages: unknown[] }).messages).toEqual([{ role: "user", content: "content" }]);
  });

  it("Gemini puts the instruction in systemInstruction", () => {
    expect(geminiAdapter.body("m", "content", 100, "do the task")).toEqual({
      contents: [{ parts: [{ text: "content" }] }],
      systemInstruction: { parts: [{ text: "do the task" }] },
      generationConfig: { maxOutputTokens: 100 },
    });
    expect(geminiAdapter.body("m", "content", 100)).not.toHaveProperty("systemInstruction");
  });

  it("Anthropic puts the instruction in the top-level system field", () => {
    expect(anthropicAdapter.body("claude", "content", 100, "do the task")).toEqual({
      model: "claude",
      max_tokens: 100,
      system: "do the task",
      messages: [{ role: "user", content: "content" }],
    });
    expect(anthropicAdapter.body("claude", "content", 100)).not.toHaveProperty("system");
  });
});

describe("per-action generation settings in body (G14, 10.3)", () => {
  const gen = { temperature: 0.1, topP: 0.8 };

  it("OpenAI-compatible maps to temperature + top_p", () => {
    const b = openAiCompatibleAdapter("https://x/v1").body("m", "c", 100, undefined, gen) as Record<string, unknown>;
    expect(b.temperature).toBe(0.1);
    expect(b.top_p).toBe(0.8);
    // Absent when no gen given.
    expect(openAiCompatibleAdapter("https://x/v1").body("m", "c", 100)).not.toHaveProperty("temperature");
  });

  it("Anthropic maps to temperature + top_p", () => {
    const b = anthropicAdapter.body("m", "c", 100, undefined, gen) as Record<string, unknown>;
    expect(b.temperature).toBe(0.1);
    expect(b.top_p).toBe(0.8);
  });

  it("Gemini nests temperature + topP under generationConfig", () => {
    const b = geminiAdapter.body("m", "c", 100, undefined, gen) as { generationConfig: Record<string, unknown> };
    expect(b.generationConfig.temperature).toBe(0.1);
    expect(b.generationConfig.topP).toBe(0.8);
    expect(b.generationConfig.maxOutputTokens).toBe(100);
  });
});

describe("streaming request construction (9.3)", () => {
  it("Gemini streams via streamGenerateContent?alt=sse with the generateContent body", () => {
    expect(geminiAdapter.streamUrl("gemini-2.5-flash")).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse",
    );
    expect(geminiAdapter.streamBody("m", "hi", 512)).toEqual({
      contents: [{ parts: [{ text: "hi" }] }],
      generationConfig: { maxOutputTokens: 512 },
    });
  });

  it("OpenAI-compatible reuses the chat URL and adds stream:true", () => {
    const a = openAiCompatibleAdapter("https://api.openai.com/v1");
    expect(a.streamUrl("m")).toBe("https://api.openai.com/v1/chat/completions");
    expect(a.streamBody("gpt-4o", "hi", 100)).toEqual({
      model: "gpt-4o",
      messages: [{ role: "user", content: "hi" }],
      max_tokens: 100,
      stream: true,
    });
  });

  it("Anthropic reuses the messages URL and adds stream:true", () => {
    expect(anthropicAdapter.streamUrl("claude")).toBe("https://api.anthropic.com/v1/messages");
    const b = anthropicAdapter.streamBody("claude", "hi", 100) as Record<string, unknown>;
    expect(b.stream).toBe(true);
    expect(b.messages).toEqual([{ role: "user", content: "hi" }]);
  });

  it("every adapter exposes the streaming surface", () => {
    for (const p of Object.keys(PROVIDER_ADAPTERS)) {
      const a = PROVIDER_ADAPTERS[p];
      expect(typeof a.streamUrl, p).toBe("function");
      expect(typeof a.streamBody, p).toBe("function");
      expect(typeof a.streamDelta, p).toBe("function");
    }
  });
});

describe("openAiCompatibleModelsUrl (9.2 discovery)", () => {
  it("appends /models and normalizes trailing slashes", () => {
    expect(openAiCompatibleModelsUrl("https://api.groq.com/openai/v1")).toBe("https://api.groq.com/openai/v1/models");
    expect(openAiCompatibleModelsUrl("https://my-host/v1/")).toBe("https://my-host/v1/models");
    expect(openAiCompatibleModelsUrl("http://localhost:1234/v1")).toBe("http://localhost:1234/v1/models");
  });
});
