// Streaming primitives (9.3). The stream→editor behavior can only be checked
// end-to-end (that's the e2e harness), but the wire-format parsing is pure and
// pinned here: SSE framing across arbitrary chunk boundaries, the [DONE]
// sentinel, and each provider's per-frame delta extraction.
import { describe, it, expect } from "vitest";
import { drainSseEvents, parseSsePayload, SSE_DONE, streamProviderDeltas } from "@lib/ai-stream";
import { openAiCompatibleAdapter, geminiAdapter, anthropicAdapter } from "@lib/ai-providers";

// Build a ReadableStream that emits the given text chunks (split at whatever
// boundaries the caller chooses, to exercise cross-chunk framing).
function streamFrom(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(enc.encode(chunks[i++]));
      else controller.close();
    },
  });
}

async function collect(gen: AsyncGenerator<string>): Promise<string> {
  let out = "";
  for await (const d of gen) out += d;
  return out;
}

describe("drainSseEvents", () => {
  it("extracts complete data: payloads and keeps the incomplete tail", () => {
    const { payloads, rest } = drainSseEvents('data: a\n\ndata: b\n\ndata: par');
    expect(payloads).toEqual(["a", "b"]);
    expect(rest).toBe("data: par");
  });

  it("reassembles an event split across two network chunks", () => {
    const first = drainSseEvents('data: {"x":1}\n\ndata: {"y');
    expect(first.payloads).toEqual(['{"x":1}']);
    // Caller prepends the leftover to the next chunk.
    const second = drainSseEvents(first.rest + '":2}\n\n');
    expect(second.payloads).toEqual(['{"y":2}']);
    expect(second.rest).toBe("");
  });

  it("joins multi-line data and ignores comment/blank lines", () => {
    const { payloads } = drainSseEvents(': keep-alive\n\ndata: line1\ndata: line2\n\n');
    expect(payloads).toEqual(["line1\nline2"]);
  });

  it("handles CRLF event/line separators (real providers, e.g. Gemini alt=sse)", () => {
    // Regression: the parser used to split only on "\n\n" and silently drained
    // NOTHING from a CRLF stream — real-provider streaming produced no tokens.
    const { payloads, rest } = drainSseEvents('data: a\r\n\r\ndata: b\r\n\r\ndata: par');
    expect(payloads).toEqual(["a", "b"]);
    expect(rest).toBe("data: par");
  });

  it("reassembles a CRLF event split across chunks", () => {
    const first = drainSseEvents('data: {"x":1}\r\n\r\ndata: {"y');
    expect(first.payloads).toEqual(['{"x":1}']);
    const second = drainSseEvents(first.rest + '":2}\r\n\r\n');
    expect(second.payloads).toEqual(['{"y":2}']);
  });
});

describe("parseSsePayload", () => {
  it("parses JSON, and returns null for [DONE], blanks, and garbage", () => {
    expect(parseSsePayload('{"a":1}')).toEqual({ a: 1 });
    expect(parseSsePayload(SSE_DONE)).toBeNull();
    expect(parseSsePayload("")).toBeNull();
    expect(parseSsePayload("not json")).toBeNull();
  });
});

describe("per-provider streamDelta", () => {
  const openai = openAiCompatibleAdapter("https://x/v1");

  it("OpenAI-compatible reads choices[0].delta.content", () => {
    expect(openai.streamDelta({ choices: [{ delta: { content: "Hel" } }] })).toBe("Hel");
    expect(openai.streamDelta({ choices: [{ delta: {} }] })).toBe(""); // role frame, no text
  });

  it("Gemini reads candidates[0].content.parts[0].text", () => {
    expect(geminiAdapter.streamDelta({ candidates: [{ content: { parts: [{ text: "hi" }] } }] })).toBe("hi");
    expect(geminiAdapter.streamDelta({ candidates: [{}] })).toBe("");
  });

  it("Anthropic reads only content_block_delta/text_delta frames", () => {
    expect(anthropicAdapter.streamDelta({ type: "content_block_delta", delta: { type: "text_delta", text: "yo" } })).toBe("yo");
    expect(anthropicAdapter.streamDelta({ type: "message_start" })).toBe("");
    expect(anthropicAdapter.streamDelta({ type: "content_block_start", content_block: { type: "text" } })).toBe("");
  });
});

describe("streamProviderDeltas (route-side transform)", () => {
  it("reconstructs text from a Gemini streamGenerateContent SSE body", async () => {
    const frame = (t: string) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] })}\n\n`;
    const stream = streamFrom([frame("Hello, "), frame("world"), "data: [DONE]\n\n"]);
    expect(await collect(streamProviderDeltas(stream, geminiAdapter.streamDelta))).toBe("Hello, world");
  });

  it("reconstructs text from an OpenAI-compatible SSE body, ignoring non-text frames", async () => {
    const openai = openAiCompatibleAdapter("https://x/v1");
    const stream = streamFrom([
      'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n', // no content
      'data: {"choices":[{"delta":{"content":"Hi "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"there"}}]}\n\ndata: [DONE]\n\n',
    ]);
    expect(await collect(streamProviderDeltas(stream, openai.streamDelta))).toBe("Hi there");
  });

  it("reconstructs text from Anthropic typed events, ignoring non-delta frames", async () => {
    const stream = streamFrom([
      'data: {"type":"message_start"}\n\n',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Cla"}}\n\n',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"ude"}}\n\n',
      'data: {"type":"message_stop"}\n\n',
    ]);
    expect(await collect(streamProviderDeltas(stream, anthropicAdapter.streamDelta))).toBe("Claude");
  });
});

describe("end-to-end framing → delta reconstruction", () => {
  it("reconstructs the full text from a chunked OpenAI SSE stream", () => {
    const openai = openAiCompatibleAdapter("https://x/v1");
    const frame = (c: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`;
    // Split the stream at an awkward byte boundary mid-event.
    const wire = frame("Hel") + frame("lo, ") + frame("world") + "data: [DONE]\n\n";
    const cut = 20;
    const chunks = [wire.slice(0, cut), wire.slice(cut)];

    let buffer = "";
    let text = "";
    for (const chunk of chunks) {
      const { payloads, rest } = drainSseEvents(buffer + chunk);
      buffer = rest;
      for (const p of payloads) {
        const event = parseSsePayload(p);
        if (event) text += openai.streamDelta(event);
      }
    }
    expect(text).toBe("Hello, world");
  });
});
