// Smoke test — proves the Vitest harness is wired up (config, aliases, jsdom,
// jest-dom setup all load and a test runs). Real regression coverage lives in
// ./regression.
import { describe, it, expect } from "vitest";

describe("vitest harness", () => {
  it("runs a test", () => {
    expect(1 + 1).toBe(2);
  });
});
