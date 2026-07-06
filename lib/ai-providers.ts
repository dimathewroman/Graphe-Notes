// G17 (Phase 9.2): provider adapter table. The generate route used a hard-coded
// if/else fan per provider; this normalizes each on a small `{url, headers, body,
// parse, mapError}` record so the route is one dispatch and adding a provider is a
// single config entry. Most providers are OpenAI-compatible (same request/response
// shape) and share `openAiCompatibleAdapter`; Gemini and Anthropic are variants.

import { parseGeminiError } from "./ai-error-handler";

// Linear trailing-slash strip. A regex like /\/+$/ backtracks polynomially on a
// long run of slashes (ReDoS) when the value is user-controlled; this scan is O(n).
export function stripTrailingSlashes(s: string): string {
  let end = s.length;
  while (end > 0 && s.charCodeAt(end - 1) === 47 /* "/" */) end--;
  return s.slice(0, end);
}

// G14 (10.3): per-action sampling. Structurally identical to the client-side
// GenerationSettings in ai-prompts.ts — kept local so this server lib has no
// dependency on next-app src.
export interface GenerationSettings {
  temperature: number;
  topP: number;
}

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
  /** `system` (G12): task instruction placed in the provider's system role; `prompt`
   *  is the fenced user content. `gen` (G14): per-action sampling settings. Both
   *  optional (omitted for freeform requests). */
  body: (model: string, prompt: string, maxTokens: number, system?: string, gen?: GenerationSettings) => unknown;
  parse: (data: unknown) => ParsedResult;
  /** Streaming (9.3): the text delta contributed by one parsed SSE event, or ""
   *  if the event carries no text (role/usage/keep-alive frames). */
  streamDelta: (event: unknown) => string;
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
  body: (_model, prompt, maxTokens, system, gen) => ({
    contents: [{ parts: [{ text: prompt }] }],
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    generationConfig: {
      maxOutputTokens: maxTokens,
      ...(gen ? { temperature: gen.temperature, topP: gen.topP } : {}),
    },
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
  // streamGenerateContent (alt=sse) streams GenerateContentResponse chunks with
  // the same candidates→parts→text shape as the non-streaming response.
  streamDelta: (event) => {
    const e = event as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return e.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  },
};

// ── Anthropic Messages API ────────────────────────────────────────────────────
export const anthropicAdapter: ProviderAdapter = {
  url: () => "https://api.anthropic.com/v1/messages",
  headers: (apiKey) => ({ "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" }),
  body: (model, prompt, maxTokens, system, gen) => ({
    model,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    ...(gen ? { temperature: gen.temperature, top_p: gen.topP } : {}),
    messages: [{ role: "user", content: prompt }],
  }),
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
  // Anthropic streams typed events; only content_block_delta / text_delta frames
  // carry text (message_start, *_block_start/stop, ping, message_stop do not).
  streamDelta: (event) => {
    const e = event as { type?: string; delta?: { type?: string; text?: string } };
    return e.type === "content_block_delta" && e.delta?.type === "text_delta" ? e.delta.text ?? "" : "";
  },
};

// ── OpenAI-compatible family (OpenAI + OpenRouter/Groq/Mistral/Together/Fireworks/custom) ──
export function openAiCompatibleAdapter(baseUrl?: string): ProviderAdapter {
  return {
    url: (_model, endpoint) => `${stripTrailingSlashes(baseUrl ?? endpoint ?? "")}/chat/completions`,
    headers: (apiKey) => ({ "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }),
    body: (model, prompt, maxTokens, system, gen) => ({
      model,
      messages: system
        ? [{ role: "system", content: system }, { role: "user", content: prompt }]
        : [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      ...(gen ? { temperature: gen.temperature, top_p: gen.topP } : {}),
    }),
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
    // Chat-completions streaming: each chunk carries a partial in choices[0].delta.content.
    streamDelta: (event) => {
      const e = event as { choices?: Array<{ delta?: { content?: string } }> };
      return e.choices?.[0]?.delta?.content ?? "";
    },
  };
}

// Fixed base URLs for the OpenAI-compatible providers, in one place so both the
// adapter table (chat/completions) and the models route (`{base}/models`
// discovery) share a single source of truth. `custom_openai` is absent — it
// supplies its base URL at runtime from the user's saved key row.
export const OPENAI_COMPATIBLE_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  groq: "https://api.groq.com/openai/v1",
  mistral: "https://api.mistral.ai/v1",
  together: "https://api.together.xyz/v1",
  fireworks: "https://api.fireworks.ai/inference/v1",
};

// The OpenAI-compatible list-models endpoint for a given base URL.
export function openAiCompatibleModelsUrl(baseUrl: string): string {
  return `${stripTrailingSlashes(baseUrl)}/models`;
}

// BYOK provider → adapter. Adding a provider is one entry here (+ one base URL
// above, one Provider union member, and a Settings dropdown option).
// `custom_openai` takes its base URL from the user's saved key row (endpoint).
export const PROVIDER_ADAPTERS: Record<string, ProviderAdapter> = {
  google_ai_studio: geminiAdapter,
  anthropic: anthropicAdapter,
  openai: openAiCompatibleAdapter(OPENAI_COMPATIBLE_BASE_URLS.openai),
  openrouter: openAiCompatibleAdapter(OPENAI_COMPATIBLE_BASE_URLS.openrouter),
  groq: openAiCompatibleAdapter(OPENAI_COMPATIBLE_BASE_URLS.groq),
  mistral: openAiCompatibleAdapter(OPENAI_COMPATIBLE_BASE_URLS.mistral),
  together: openAiCompatibleAdapter(OPENAI_COMPATIBLE_BASE_URLS.together),
  fireworks: openAiCompatibleAdapter(OPENAI_COMPATIBLE_BASE_URLS.fireworks),
  custom_openai: openAiCompatibleAdapter(),
};
