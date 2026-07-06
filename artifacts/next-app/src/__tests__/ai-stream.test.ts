// Streaming primitives (9.3). The stream→editor behavior can only be checked
// end-to-end (that's the e2e harness), but the wire-format parsing is pure and
// pinned here: SSE framing across arbitrary chunk boundaries, the [DONE]
// sentinel, and each provider's per-frame delta extraction.
import { describe, it, expect } from "vitest";
import { drainSseEvents, parseSsePayload, SSE_DONE } from "@lib/ai-stream";
import { openAiCompatibleAdapter, geminiAdapter, anthropicAdapter } from "@lib/ai-providers";

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
