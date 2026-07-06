// G17 (Phase 9.2): provider adapter table. The generate route used a hard-coded
// if/else fan per provider; this normalizes each on a small `{url, headers, body,
// parse, mapError}` record so the route is one dispatch and adding a provider is a
// single config entry. Most providers are OpenAI-compatible (same request/response
// shape) and share `openAiCompatibleAdapter`; Gemini and Anthropic are variants.

import { parseGeminiError } from "./ai-error-handler";

export interface ParsedResult {
  text: string;
  truncated: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface AdapterError {
  status: number;
  body: Record<string, unknown>;
}

export interface ProviderAdapter {
  /** Upstream URL. `endpoint` is the user-provided base URL for the custom provider. */
  url: (model: string, endpoint?: string | null) => string;
  headers: (apiKey: string) => Record<string, string>;
  body: (model: string, prompt: string, maxTokens: number) => unknown;
  parse: (data: unknown) => ParsedResult;
  /** Map a non-OK upstream response to our client error shape. */
  mapError: (upstreamStatus: number, rawBody: string) => AdapterError;
}

const genericError = (upstreamStatus: number, rawBody: string): AdapterError => ({
  status: 502,
  body: { error: "upstream_error", upstreamStatus, upstreamMessage: rawBody },
});

// ── Gemini (google_ai_studio; the free tier reuses this shape) ────────────────
export const geminiAdapter: ProviderAdapter = {
  // Key rides the x-goog-api-key header, never the URL (§S key-in-URL).
  url: (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
  headers: (apiKey) => ({ "Content-Type": "application/json", "x-goog-api-key": apiKey }),
  body: (_model, prompt, maxTokens) => ({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: maxTokens },
  }),
  parse: (data) => {
    const d = data as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    return {
      text: d.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
      truncated: d.candidates?.[0]?.finishReason === "MAX_TOKENS",
      inputTokens: d.usageMetadata?.promptTokenCount ?? null,
      outputTokens: d.usageMetadata?.candidatesTokenCount ?? null,
    };
  },
  mapError: (upstreamStatus, rawBody) => {
    const p = parseGeminiError(upstreamStatus, rawBody);
    const status = p.type === "rpm_limit" || p.type === "rpd_limit" ? 429 : p.type === "invalid_key" ? 401 : 502;
    return {
      status,
      body: {
        error: p.type,
        userMessage: p.userMessage,
        retryAfterMs: p.type === "rpm_limit" ? p.retryAfterMs : null,
      },
    };
  },
};

// ── Anthropic Messages API ────────────────────────────────────────────────────
export const anthropicAdapter: ProviderAdapter = {
  url: () => "https://api.anthropic.com/v1/messages",
  headers: (apiKey) => ({ "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" }),
  body: (model, prompt, maxTokens) => ({ model, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
  parse: (data) => {
    const d = data as {
      content: Array<{ text: string }>;
      stop_reason?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    return {
      text: d.content?.[0]?.text ?? "",
      truncated: d.stop_reason === "max_tokens",
      inputTokens: d.usage?.input_tokens ?? null,
      outputTokens: d.usage?.output_tokens ?? null,
    };
  },
  mapError: genericError,
};

// ── OpenAI-compatible family (OpenAI + OpenRouter/Groq/Mistral/Together/Fireworks/custom) ──
export function openAiCompatibleAdapter(baseUrl?: string): ProviderAdapter {
  return {
    url: (_model, endpoint) => `${(baseUrl ?? endpoint ?? "").replace(/\/+$/, "")}/chat/completions`,
    headers: (apiKey) => ({ "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }),
    body: (model, prompt, maxTokens) => ({ model, messages: [{ role: "user", content: prompt }], max_tokens: maxTokens }),
    parse: (data) => {
      const d = data as {
        choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      return {
        text: d.choices?.[0]?.message?.content ?? "",
        truncated: d.choices?.[0]?.finish_reason === "length",
        inputTokens: d.usage?.prompt_tokens ?? null,
        outputTokens: d.usage?.completion_tokens ?? null,
      };
    },
    mapError: genericError,
  };
}

// BYOK provider → adapter. Adding a provider is one entry here (+ one Provider
// union member + a Settings dropdown option). `custom_openai` takes its base URL
// from the user's saved key row (endpoint).
export const PROVIDER_ADAPTERS: Record<string, ProviderAdapter> = {
  google_ai_studio: geminiAdapter,
  anthropic: anthropicAdapter,
  openai: openAiCompatibleAdapter("https://api.openai.com/v1"),
  openrouter: openAiCompatibleAdapter("https://openrouter.ai/api/v1"),
  groq: openAiCompatibleAdapter("https://api.groq.com/openai/v1"),
  mistral: openAiCompatibleAdapter("https://api.mistral.ai/v1"),
  together: openAiCompatibleAdapter("https://api.together.xyz/v1"),
  fireworks: openAiCompatibleAdapter("https://api.fireworks.ai/inference/v1"),
  custom_openai: openAiCompatibleAdapter(),
};
