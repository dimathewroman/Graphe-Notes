// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(process.cwd(), "../..");

function readRepoFile(path: string): string {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

describe("security configuration regressions", () => {
  it("uses a fixed generic client message in the Claude proxy catch path", () => {
    const source = readRepoFile("scripts/claude-proxy.mjs");
    const matchingCatchBody = [
      ...source.matchAll(
        /catch(?:\s*\(\s*e\s*\))?\s*\{(?<body>[\s\S]{0,500}?)\n\s*\}/g,
      ),
    ]
      .map((match) => match.groups?.body ?? "")
      .find((body) => /oaiError\s*\(\s*res\s*,\s*500/.test(body));

    expect(matchingCatchBody).toBeDefined();
    const catchBody = matchingCatchBody ?? "";
    expect(catchBody).toMatch(
      /oaiError\s*\(\s*res\s*,\s*500\s*,\s*["'`]Claude proxy request failed["'`]\s*\)/,
    );
    expect(catchBody).not.toMatch(
      /oaiError\s*\(\s*res\s*,\s*500\s*,\s*(?:e\?\.\s*message|String\s*\(\s*e\s*\)|e)\b/s,
    );
  });

  it("keeps workflow and E2E permissions least-privilege", () => {
    const workflow = readRepoFile(".github/workflows/e2e.yml");
    const workflowPermissions = workflow.match(
      /^permissions:\s*\n(?<body>(?:^  [A-Za-z0-9_-]+:\s*[A-Za-z0-9_-]+.*\n?)+)/m,
    );

    expect(workflowPermissions?.groups?.body).toBeDefined();
    const workflowPermissionKeys = [
      ...(workflowPermissions?.groups?.body ?? "").matchAll(
        /^[ \t]+([A-Za-z0-9_-]+):\s*([A-Za-z0-9_-]+)/gm,
      ),
    ].map((match) => [match[1], match[2]]);
    expect(workflowPermissionKeys).toEqual([["contents", "read"]]);

    const e2ePermissions = workflow.match(
      /^  e2e:\s*\n[\s\S]*?^    permissions:\s*\n(?<body>(?:^      [A-Za-z0-9_-]+:\s*[A-Za-z0-9_-]+.*\n?)+)/m,
    );
    const e2ePermissionBody = e2ePermissions?.groups?.body ?? "";
    expect(e2ePermissionBody).toMatch(/^      contents:\s+read(?:\s+#.*)?$/m);
    expect(e2ePermissionBody).toMatch(
      /^      pull-requests:\s+write(?:\s+#.*)?$/m,
    );
  });

  it("keeps the server-side sanitizer external so jsdom can load its package assets", () => {
    const nextConfig = readRepoFile("artifacts/next-app/next.config.ts");

    expect(nextConfig).toMatch(
      /serverExternalPackages:\s*\[\s*"isomorphic-dompurify",\s*"jsdom"\s*\]/,
    );
  });
});
