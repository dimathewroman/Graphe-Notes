import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { PinPad } from "@/components/PinPad";

const posthog = vi.hoisted(() => ({
  __loaded: false,
  debug: vi.fn(),
  init: vi.fn(),
}));

vi.mock("posthog-js", () => ({ default: posthog }));
vi.mock("posthog-js/react", () => ({
  PostHogProvider: ({ children }: { children: ReactNode }) => children,
}));

import { PHProvider } from "@/components/PostHogProvider";

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function sourceFile(path: string): string {
  return readFileSync(resolve(sourceRoot, path), "utf8");
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  posthog.__loaded = false;
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
});

describe("PostHog identity privacy", () => {
  it("identifies authenticated users only by their opaque Supabase ID", () => {
    const authSource = sourceFile("hooks/use-auth.ts");
    const identifyCalls = [...authSource.matchAll(/posthog\.identify\(([^;]+)\);/g)];

    expect(identifyCalls).not.toHaveLength(0);
    for (const call of identifyCalls) {
      expect(call[1]?.trim()).toMatch(/^(session|data)\.user\.id$/);
    }
  });
});

describe("PostHog search privacy", () => {
  it("captures only the search query length, never search content", () => {
    const noteListSource = sourceFile("components/NoteList.tsx");
    const captures = [
      ...noteListSource.matchAll(/posthog\.capture\("search_performed", \{([^}]+)\}\);/g),
    ];

    expect(captures).toHaveLength(1);
    for (const capture of captures) {
      const properties = [...(capture[1] ?? "").matchAll(/(\w+):/g)].map(
        ([, name]) => name,
      );

      expect(properties).toEqual(["query_length", "timestamp"]);
      expect(capture[1]).toMatch(/query_length:\s*debouncedSearch\.length/);
    }
  });
});

describe("PostHog browser privacy defaults", () => {
  it("turns off automatic collection while retaining scrubbed exception capture", () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "test-key";

    render(createElement(PHProvider, { children: createElement("div", null, "Application") }));

    expect(posthog.init).toHaveBeenCalledWith("test-key", expect.objectContaining({
      autocapture: false,
      disable_session_recording: true,
      capture_pageview: false,
      capture_pageleave: false,
      rageclick: false,
      capture_exceptions: true,
    }));
  });
});

describe("sensitive DOM telemetry boundaries", () => {
  it("places every rendered vault PIN control below a no-capture ancestor", () => {
    render(createElement(PinPad, { title: "Vault", onSubmit: () => undefined }));

    for (const control of screen.getAllByRole("button")) {
      expect(control.closest(".ph-no-capture")).not.toBeNull();
    }
  });

  it("marks the note title/body and editable editor DOM as no-capture", () => {
    const noteBodySource = sourceFile("components/editor/NoteBody.tsx");
    const editorSource = sourceFile("components/editor/GrapheEditor.tsx");

    expect(noteBodySource).toMatch(/className="hide-scrollbar[^\"]*ph-no-capture/);
    expect(editorSource).toMatch(/class:\s*"ph-no-capture prose/);
  });
});
