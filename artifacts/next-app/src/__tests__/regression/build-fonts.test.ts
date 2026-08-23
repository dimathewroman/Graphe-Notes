import { readFileSync, readdirSync, type Dirent } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appSourceRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../app",
);

const publicFontVariables = [
  "--font-inter",
  "--font-jetbrains-mono",
  "--font-merriweather",
  "--font-playfair-display",
  "--font-lato",
  "--font-roboto",
] as const;

function sourceFilesIn(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(
    (entry: Dirent) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return sourceFilesIn(path);
      return [path];
    },
  );
}

function productionSource(): string {
  return sourceFilesIn(appSourceRoot)
    .filter((path) => [".css", ".ts", ".tsx"].includes(extname(path)))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
}

describe("production font build contract", () => {
  it("resolves fonts locally without a Google Fonts build dependency", () => {
    const source = productionSource();

    expect(source).not.toMatch(/next\/font\/google/);
    expect(source).not.toMatch(/fonts\.googleapis\.com/);
    expect(source).toMatch(/next\/font\/local/);
  });

  it("preserves the public font CSS variable contract", () => {
    const source = productionSource();

    for (const variable of publicFontVariables) {
      expect(source).toContain(variable);
    }
  });
});
