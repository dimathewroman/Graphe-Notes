import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  authenticatedFetch,
  customFetch,
  resolveApiUrl,
  setAccessToken,
  setVaultProof,
} from "@workspace/api-client-react/custom-fetch";

describe("client API-origin resolver", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    setAccessToken(null);
    setVaultProof(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    setAccessToken(null);
    setVaultProof(null);
  });

  it("preserves hosted relative API paths, including encoded paths and queries", () => {
    expect(resolveApiUrl("/api/notes/a%2Fb?next=%2Ffolder%3Ftag%3Da%26b")).toBe(
      "/api/notes/a%2Fb?next=%2Ffolder%3Ftag%3Da%26b",
    );
  });

  it("resolves relative API paths against a configured HTTPS origin", () => {
    vi.stubEnv("NEXT_PUBLIC_API_ORIGIN", "https://api.example.test///");

    expect(resolveApiUrl("/api/attachments/sign?id=a%2Fb")).toBe(
      "https://api.example.test/api/attachments/sign?id=a%2Fb",
    );
  });

  it("allows an explicitly enabled loopback HTTP origin in test", () => {
    vi.stubEnv("NEXT_PUBLIC_API_ORIGIN", "http://127.0.0.1:8787/");
    vi.stubEnv("NEXT_PUBLIC_ALLOW_LOOPBACK_API_ORIGIN", "1");

    expect(resolveApiUrl("/api/healthz")).toBe("http://127.0.0.1:8787/api/healthz");
  });

  it("rejects malformed, path-bearing, and insecure API origin configuration", () => {
    vi.stubEnv("NEXT_PUBLIC_API_ORIGIN", "not a url");
    expect(() => resolveApiUrl("/api/notes")).toThrow("valid HTTPS origin");

    vi.stubEnv("NEXT_PUBLIC_API_ORIGIN", "https://api.example.test/v1");
    expect(() => resolveApiUrl("/api/notes")).toThrow("must be an HTTPS origin");

    vi.stubEnv("NEXT_PUBLIC_API_ORIGIN", "http://api.example.test");
    expect(() => resolveApiUrl("/api/notes")).toThrow("must be an HTTPS origin");
  });

  it("rejects arbitrary absolute request URLs before credentials or fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    setAccessToken("access-token");
    setVaultProof("vault-proof");

    await expect(customFetch("https://attacker.example/api/notes")).rejects.toThrow(
      "Only relative /api request paths are allowed.",
    );
    expect(() => authenticatedFetch("https://attacker.example/api/notes")).toThrow(
      "Only relative /api request paths are allowed.",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("attaches credentials only to a resolver-owned API target", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_ORIGIN", "https://api.example.test/");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));
    setAccessToken("access-token");
    setVaultProof("vault-proof");

    await authenticatedFetch("/api/vault/status");

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.example.test/api/vault/status",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
    const [, init] = fetchSpy.mock.calls[0] ?? [];
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get("authorization")).toBe("Bearer access-token");
    expect(headers.get("x-vault-proof")).toBe("vault-proof");
  });
});
