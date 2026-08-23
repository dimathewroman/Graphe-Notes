import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { PinPad } from "@/components/PinPad";
import { VersionPreviewArea } from "@/components/VersionPreviewArea";
import type { NoteVersionFull } from "@/hooks/use-note-versions";
import type { CaptureResult } from "posthog-js";

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

  it("removes all private exception detail but leaves deliberate custom events unchanged", () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "test-key";
    render(createElement(PHProvider, { children: null }));

    const [, options] = posthog.init.mock.calls[0] as [string, { before_send: (event: CaptureResult) => CaptureResult }];
    const secret = "vault-note-secret-123";
    const exception = {
      uuid: "exception-uuid",
      event: "$exception",
      timestamp: new Date("2026-08-23T00:00:00.000Z"),
      properties: {
        $lib: "web",
        $lib_version: "1.363.4",
        $exception_list: [{ type: "Error", value: secret, stacktrace: { frames: [{ filename: secret }] } }],
        message: secret,
        stack: secret,
        note_content: secret,
      },
      $set: { private_note_title: secret },
    } as unknown as CaptureResult;
    const manualEvent = {
      uuid: "manual-uuid",
      event: "note_opened",
      properties: { note_id: 42, source: "list" },
    } as CaptureResult;

    const scrubbed = options.before_send(exception);

    expect(scrubbed).toEqual({
      uuid: "exception-uuid",
      event: "$exception",
      timestamp: exception.timestamp,
      properties: {
        $lib: "web",
        $lib_version: "1.363.4",
        $exception_list: [{ type: "Error" }],
      },
    });
    expect(JSON.stringify(scrubbed)).not.toContain(secret);
    expect(options.before_send(manualEvent)).toBe(manualEvent);
  });
});

describe("sensitive DOM telemetry boundaries", () => {
  it("places every rendered vault PIN control below a no-capture ancestor", () => {
    const { container } = render(createElement(PinPad, { title: "Vault", onSubmit: () => undefined }));
    const pinPadRoot = container.firstElementChild;

    expect(pinPadRoot).toHaveClass("ph-no-capture");
    for (const control of screen.getAllByRole("button")) {
      expect(control.closest(".ph-no-capture")).toBe(pinPadRoot);
    }
  });

  it("places rendered version title and content below a no-capture root", () => {
    const version = {
      id: 1,
      noteId: 1,
      title: "Private prior title",
      content: "<p>Private prior content</p>",
      contentText: "Private prior content",
      label: null,
      source: "manual_save",
      createdAt: "2026-08-23T00:00:00.000Z",
    } as NoteVersionFull;
    const { container } = render(createElement(VersionPreviewArea, {
      version,
      currentTitle: "Current title",
      currentContent: "<p>Current content</p>",
      currentContentText: "Current content",
      onRestore: () => undefined,
      onBack: () => undefined,
    }));
    const versionRoot = container.firstElementChild;

    expect(versionRoot).toHaveClass("ph-no-capture");
    expect(screen.getByText("Private prior title").closest(".ph-no-capture")).toBe(versionRoot);
    expect(screen.getByText("Private prior content").closest(".ph-no-capture")).toBe(versionRoot);
  });

  it("marks the note title/body and editable editor DOM as no-capture", () => {
    const noteBodySource = sourceFile("components/editor/NoteBody.tsx");
    const editorSource = sourceFile("components/editor/GrapheEditor.tsx");
    const noteListSource = sourceFile("components/NoteList.tsx");
    const recentlyDeletedSource = sourceFile("components/RecentlyDeleted.tsx");
    const recentlyDeletedDetailSource = sourceFile("components/RecentlyDeletedDetail.tsx");

    expect(noteBodySource).toMatch(/className="hide-scrollbar[^\"]*ph-no-capture/);
    expect(editorSource).toMatch(/class:\s*"ph-no-capture prose/);
    expect(noteListSource).toMatch(/"ph-no-capture rounded-lg cursor-pointer/);
    expect(noteListSource).toMatch(/"ph-no-capture p-3 rounded-lg cursor-pointer/);
    expect(recentlyDeletedSource).toMatch(/"ph-no-capture p-3 rounded-xl cursor-pointer/);
    expect(recentlyDeletedDetailSource).toMatch(/"ph-no-capture flex-1 overflow-y-auto/);
  });
});
