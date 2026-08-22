import { describe, expect, it, vi } from "vitest";
import { safeExternalFetch } from "@lib/safe-external-fetch";

describe("safeExternalFetch", () => {
  it("resolves the target before sending the request", async () => {
    const dnsLookup = vi.fn<(hostname: string) => Promise<readonly string[]>>().mockResolvedValue(["93.184.216.34"]);
    const fetchImpl = vi.fn().mockResolvedValue(new Response("ok"));

    await expect(
      safeExternalFetch(
        "https://provider.example/v1/chat/completions",
        { method: "POST", headers: { Authorization: "Bearer private-key" }, body: "private body" },
        { dnsLookup, fetchImpl },
      ),
    ).resolves.toBeInstanceOf(Response);

    expect(dnsLookup).toHaveBeenCalledWith("provider.example");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://provider.example/v1/chat/completions",
      expect.objectContaining({ redirect: "manual" }),
      expect.objectContaining({ addresses: ["93.184.216.34"] }),
    );
  });

  it("revalidates a safe redirect before forwarding the authorization header and body", async () => {
    const dnsLookup = vi.fn<(hostname: string) => Promise<readonly string[]>>((hostname) =>
      Promise.resolve(hostname === "provider.example" ? ["93.184.216.34"] : ["104.16.1.2"]),
    );
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 307, headers: { Location: "https://regional.provider.example/v1/chat/completions" } }))
      .mockResolvedValueOnce(new Response("ok"));
    const init = { method: "POST", headers: { Authorization: "Bearer private-key" }, body: "private body" };

    await expect(safeExternalFetch("https://provider.example/v1/chat/completions", init, { dnsLookup, fetchImpl })).resolves.toMatchObject({ status: 200 });

    expect(dnsLookup).toHaveBeenNthCalledWith(1, "provider.example");
    expect(dnsLookup).toHaveBeenNthCalledWith(2, "regional.provider.example");
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://regional.provider.example/v1/chat/completions",
      expect.objectContaining({ headers: init.headers, body: init.body, redirect: "manual" }),
      expect.objectContaining({ addresses: ["104.16.1.2"] }),
    );
  });

  it("blocks a private redirect before a second request can forward sensitive data", async () => {
    const dnsLookup = vi.fn<(hostname: string) => Promise<readonly string[]>>((hostname) =>
      Promise.resolve(hostname === "provider.example" ? ["93.184.216.34"] : ["169.254.169.254"]),
    );
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 302, headers: { Location: "https://metadata.example/latest" } }));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      safeExternalFetch(
        "https://provider.example/v1/chat/completions",
        { method: "POST", headers: { Authorization: "Bearer private-key" }, body: "private body" },
        { dnsLookup, fetchImpl },
      ),
    ).rejects.toThrow("resolves to a non-public address");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("propagates timeout and network failures without logging request data", async () => {
    const dnsLookup = vi.fn<(hostname: string) => Promise<readonly string[]>>().mockResolvedValue(["93.184.216.34"]);
    const timeout = new DOMException("request timed out", "TimeoutError");
    const fetchImpl = vi.fn().mockRejectedValue(timeout);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      safeExternalFetch(
        "https://provider.example/v1/chat/completions",
        { method: "POST", headers: { Authorization: "Bearer private-key" }, body: "private body" },
        { dnsLookup, fetchImpl },
      ),
    ).rejects.toBe(timeout);

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
