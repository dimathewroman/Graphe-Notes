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

  it("canonicalizes a contained path before accepting it", () => {
    expect(resolveApiUrl("/api/folders/../notes?next=%2Ffolder%3Ftag%3Da%26b")).toBe(
      "/api/notes?next=%2Ffolder%3Ftag%3Da%26b",
    );
  });

  it("resolves relative API paths against a configured HTTPS origin", () => {
    vi.stubEnv("NEXT_PUBLIC_API_ORIGIN", "https://api.example.test/");

    expect(resolveApiUrl("/api/attachments/sign?id=a%2Fb")).toBe(
      "https://api.example.test/api/attachments/sign?id=a%2Fb",
    );
  });

  it("allows an explicitly enabled loopback HTTP origin in test", () => {
    vi.stubEnv("NEXT_PUBLIC_API_ORIGIN", "http://127.0.0.1:8787/");
    vi.stubEnv("NEXT_PUBLIC_ALLOW_LOOPBACK_API_ORIGIN", "1");

    expect(resolveApiUrl("/api/healthz")).toBe("http://127.0.0.1:8787/api/healthz");
  });

  it("accepts HTTPS IDN and IPv6 configured origins", () => {
    vi.stubEnv("NEXT_PUBLIC_API_ORIGIN", "https://bücher.example");
    expect(resolveApiUrl("/api/notes")).toBe("https://xn--bcher-kva.example/api/notes");

    vi.stubEnv("NEXT_PUBLIC_API_ORIGIN", "https://[2001:db8::1]:9443/");
    expect(resolveApiUrl("/api/notes")).toBe("https://[2001:db8::1]:9443/api/notes");
  });

  it("allows only canonical loopback spellings for enabled test HTTP origins", () => {
    vi.stubEnv("NEXT_PUBLIC_ALLOW_LOOPBACK_API_ORIGIN", "1");

    for (const [origin, expected] of [
      ["http://localhost:8787", "http://localhost:8787/api/healthz"],
      ["http://127.0.0.1:8787", "http://127.0.0.1:8787/api/healthz"],
      ["http://[::1]:8787", "http://[::1]:8787/api/healthz"],
    ]) {
      vi.stubEnv("NEXT_PUBLIC_API_ORIGIN", origin);
      expect(resolveApiUrl("/api/healthz")).toBe(expected);
    }
  });

  it("rejects malformed, noncanonical, path-bearing, and insecure API origin configuration", () => {
    vi.stubEnv("NEXT_PUBLIC_API_ORIGIN", "not a url");
    expect(() => resolveApiUrl("/api/notes")).toThrow("whitespace or backslashes");

    vi.stubEnv("NEXT_PUBLIC_API_ORIGIN", "not-a-url");
    expect(() => resolveApiUrl("/api/notes")).toThrow("explicit http:// or https://");

    vi.stubEnv("NEXT_PUBLIC_API_ORIGIN", "https://api.example.test/v1");
    expect(() => resolveApiUrl("/api/notes")).toThrow("explicit http:// or https://");

    vi.stubEnv("NEXT_PUBLIC_API_ORIGIN", "http://api.example.test");
    expect(() => resolveApiUrl("/api/notes")).toThrow("must be an HTTPS origin");

    for (const origin of [
      "https:\\api.example.test",
      "//api.example.test",
      "https:api.example.test",
      " https://api.example.test",
      "https://api.example.test ",
      "https://user:password@api.example.test",
      "https://api.example.test?version=1",
      "https://api.example.test#fragment",
      "https://api.example.test//",
    ]) {
      vi.stubEnv("NEXT_PUBLIC_API_ORIGIN", origin);
      expect(() => resolveApiUrl("/api/notes")).toThrow();
    }
  });

  it("rejects WHATWG-normalized loopback aliases even when test HTTP is enabled", () => {
    vi.stubEnv("NEXT_PUBLIC_ALLOW_LOOPBACK_API_ORIGIN", "1");

    for (const origin of [
      "http://LOCALHOST:8787",
      "http://localhost.:8787",
      "http://127.0.0.1.:8787",
      "http://2130706433:8787",
      "http://[0:0:0:0:0:0:0:1]:8787",
      "http://[::01]:8787",
      "http://[::ffff:127.0.0.1]:8787",
    ]) {
      vi.stubEnv("NEXT_PUBLIC_API_ORIGIN", origin);
      expect(() => resolveApiUrl("/api/notes")).toThrow("must be an HTTPS origin");
    }
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

  it("rejects invalid configured origins before credentials or fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    vi.stubEnv("NEXT_PUBLIC_API_ORIGIN", "https:\\api.example.test");
    setAccessToken("access-token");
    setVaultProof("vault-proof");

    await expect(customFetch("/api/notes")).rejects.toThrow("whitespace or backslashes");
    expect(() => authenticatedFetch("/api/notes")).toThrow("whitespace or backslashes");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects traversal and backslash API-path variants before credentials or fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    setAccessToken("access-token");
    setVaultProof("vault-proof");

    for (const path of [
      "/api/../account",
      "/api/%2e%2e/account",
      "/api/%2E./account",
      "/api/.%2e/account",
      "/api/%2e%2E/account",
      "/api\\..\\account",
      "/api\\%2e%2e\\account",
      "/api/%2e%2e%5caccount",
      "/api/folder%5c..%5c..%5caccount",
      "/api/folder%2f..%2f..%2faccount",
    ]) {
      expect(() => resolveApiUrl(path)).toThrow(
        "Only relative /api request paths are allowed.",
      );
      await expect(customFetch(path)).rejects.toThrow(
        "Only relative /api request paths are allowed.",
      );
      expect(() => authenticatedFetch(path)).toThrow(
        "Only relative /api request paths are allowed.",
      );
    }

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("defensively rejects non-string API targets at runtime", () => {
    expect(() =>
      resolveApiUrl(new URL("https://attacker.example/api/notes") as unknown as string),
    ).toThrow("Only relative /api request paths are allowed.");
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
