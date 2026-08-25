import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { useNoteCollaboration } from "@/hooks/use-note-collaboration";

function ServerProbe() {
  const collaboration = useNoteCollaboration({
    identity: { mode: "demo", noteId: "A" },
    serverRevision: "2026-08-25T12:34:56.789Z",
  });
  return createElement("span", null, collaboration.status);
}

describe("useNoteCollaboration", () => {
  it("is SSR-safe when IndexedDB is unavailable", () => {
    vi.stubGlobal("indexedDB", undefined);

    expect(() => renderToString(createElement(ServerProbe))).not.toThrow();
    expect(renderToString(createElement(ServerProbe))).toContain("loading");

    vi.unstubAllGlobals();
  });
});
