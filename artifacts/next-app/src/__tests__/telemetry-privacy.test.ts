import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function sourceFile(path: string): string {
  return readFileSync(resolve(sourceRoot, path), "utf8");
}

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
