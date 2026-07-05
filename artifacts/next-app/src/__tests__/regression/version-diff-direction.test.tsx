// Regression: V11 — the version diff is inverted. Under "Changes" (diff vs
// current), `VersionPreviewArea` calls computeDiff(currentContentText,
// version.contentText) (VersionPreviewArea.tsx:71), i.e. diff_main(current,
// version). That treats the CURRENT text as "old", so text you added since the
// version (present in current, absent in the version) renders as a red
// strikethrough DELETION instead of a green INSERTION (audit §V11).
//
// This renders the real component in diff mode and asserts that text unique to
// the newer (current) note renders as an insertion (text-primary, not
// line-through). Fixed in Phase 8.5 by swapping the args to
// computeDiff(version.contentText, currentContentText) — now a hard regression gate.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VersionPreviewArea } from "@/components/VersionPreviewArea";
import type { NoteVersionFull } from "@/hooks/use-note-versions";

const ADDED = "DELTAADDEDTOKEN"; // unique to the newer/current note

const olderVersion: NoteVersionFull = {
  id: 1,
  noteId: 1,
  title: "My note",
  content: "<p>Alpha beta gamma</p>",
  contentText: "Alpha beta gamma",
  label: null,
  source: "manual_save",
  createdAt: "2026-01-01T00:00:00.000Z",
};

// Current note = older text plus a distinctive addition.
const currentContentText = `Alpha beta gamma ${ADDED}`;

function renderDiff() {
  const utils = render(
    <VersionPreviewArea
      version={olderVersion}
      currentTitle="My note"
      currentContent={`<p>${currentContentText}</p>`}
      currentContentText={currentContentText}
      onRestore={vi.fn()}
      onBack={vi.fn()}
    />,
  );
  // Switch from Snapshot to the diff view.
  fireEvent.click(screen.getByRole("button", { name: /changes/i }));
  return utils;
}

function segmentForAddedText(container: HTMLElement): HTMLElement | undefined {
  return [...container.querySelectorAll("span")].find((s) =>
    s.textContent?.includes(ADDED),
  );
}

describe("version diff direction (V11)", () => {
  it(
    "text added since the version renders as an insertion, not a strikethrough deletion",
    () => {
      const { container } = renderDiff();
      const seg = segmentForAddedText(container);
      expect(seg).toBeTruthy();
      // Correct behavior: the newer addition is an insertion — accent-colored,
      // never a strikethrough deletion.
      expect(seg!.className).toContain("text-primary");
      expect(seg!.className).not.toContain("line-through");
    },
  );
});
