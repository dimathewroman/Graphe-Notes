// 9.2: custom_openai lets a user store an upstream URL the server later fetches.
// isSafeExternalUrl is the SSRF barrier — these tests pin that internal/loopback
// targets are rejected and ordinary public https hosts pass.
import { describe, it, expect } from "vitest";
import { isSafeExternalUrl } from "@lib/url-guard";

describe("isSafeExternalUrl", () => {
  it("allows public http(s) hosts", () => {
    expect(isSafeExternalUrl("https://api.example.com/v1")).toBe(true);
    expect(isSafeExternalUrl("http://models.acme.io/openai/v1")).toBe(true);
    expect(isSafeExternalUrl("https://8.8.8.8/v1")).toBe(true);
  });

  it("blocks loopback and localhost", () => {
    expect(isSafeExternalUrl("http://localhost:1234/v1")).toBe(false);
    expect(isSafeExternalUrl("http://127.0.0.1/v1")).toBe(false);
    expect(isSafeExternalUrl("http://api.localhost/v1")).toBe(false);
    expect(isSafeExternalUrl("http://[::1]/v1")).toBe(false);
  });

  it("blocks private and link-local ranges (incl. cloud metadata)", () => {
    expect(isSafeExternalUrl("http://10.0.0.5/v1")).toBe(false);
    expect(isSafeExternalUrl("http://172.16.0.1/v1")).toBe(false);
    expect(isSafeExternalUrl("http://172.31.255.255/v1")).toBe(false);
    expect(isSafeExternalUrl("http://192.168.1.1/v1")).toBe(false);
    expect(isSafeExternalUrl("http://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isSafeExternalUrl("http://0.0.0.0/v1")).toBe(false);
  });

  it("allows a public host that merely borders a private range", () => {
    expect(isSafeExternalUrl("https://172.32.0.1/v1")).toBe(true);
    expect(isSafeExternalUrl("https://11.0.0.1/v1")).toBe(true);
  });

  it("rejects non-http(s) schemes and garbage", () => {
    expect(isSafeExternalUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeExternalUrl("ftp://example.com")).toBe(false);
    expect(isSafeExternalUrl("gopher://127.0.0.1")).toBe(false);
    expect(isSafeExternalUrl("not a url")).toBe(false);
    expect(isSafeExternalUrl("")).toBe(false);
  });
});
