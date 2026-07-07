// Streaming primitives for AI responses (Phase 9.3, SSE). Pure functions only —
// no fetch, no editor — so the tricky wire-format handling is fully unit-testable
// before any of it touches the live editor. The route/client wiring builds on top.
//
// All the AI providers we support stream over Server-Sent Events: the response
// body is a sequence of `data: <payload>\n\n` events. `drainSseEvents` turns a
// running text buffer into complete `data:` payloads (handling chunk boundaries
// that split an event); each adapter's `streamDelta` then turns one parsed
// payload into the text it contributes.

/** OpenAI-style terminator payload; not JSON, must be skipped. */
export const SSE_DONE = "[DONE]";

/**
 * Pull complete SSE `data:` payloads out of a running buffer.
 * Returns the payloads found and the leftover (an incomplete trailing event),
 * which the caller prepends to the next network chunk. An event may carry
 * multiple `data:` lines — they're joined with "\n" per the SSE spec.
 */
export function drainSseEvents(buffer: string): { payloads: string[]; rest: string } {
  const payloads: string[] = [];
  let rest = buffer;
  let sep = rest.indexOf("\n\n");
  while (sep !== -1) {
    const block = rest.slice(0, sep);
    rest = rest.slice(sep + 2);
    const data = sseDataPayload(block);
    if (data !== null) payloads.push(data);
    sep = rest.indexOf("\n\n");
  }
  return { payloads, rest };
}

function sseDataPayload(block: string): string | null {
  const dataLines = block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).replace(/^ /, "")); // one optional leading space
  return dataLines.length ? dataLines.join("\n") : null;
}

/**
 * Parse an SSE payload as JSON, returning null for the [DONE] sentinel or
 * anything unparseable (a keep-alive comment, a partial line). Callers treat
 * null as "no event here", never as an error.
 */
export function parseSsePayload(payload: string): unknown | null {
  if (payload === SSE_DONE || payload.trim() === "") return null;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/**
 * Read a provider's SSE response body and yield the text deltas it contains,
 * using the provider's own `streamDelta` to interpret each frame. Combines the
 * framing (drainSseEvents, boundary-safe) with per-frame delta extraction, so
 * the route just re-emits these in our own `data: {"delta"}` shape. Pure w.r.t.
 * the provider format — testable by feeding a canned ReadableStream.
 */
export async function* streamProviderDeltas(
  body: ReadableStream<Uint8Array>,
  streamDelta: (event: unknown) => string,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { payloads, rest } = drainSseEvents(buffer);
    buffer = rest;
    for (const payload of payloads) {
      const event = parseSsePayload(payload);
      if (event) {
        const delta = streamDelta(event);
        if (delta) yield delta;
      }
    }
  }
}
