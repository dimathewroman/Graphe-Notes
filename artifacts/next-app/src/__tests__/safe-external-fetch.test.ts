// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());

vi.mock("node:https", () => ({ request: requestMock }));

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

  it("returns the Node all-address lookup callback shape to the HTTPS connector", async () => {
    const dnsLookup = vi.fn<(hostname: string) => Promise<readonly string[]>>().mockResolvedValue(["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"]);
    const controller = new AbortController();
    let errorHandler: ((error: Error) => void) | undefined;
    let lookupResult: unknown;
    const upstream = {
      on: vi.fn((event: string, handler: (error: Error) => void) => {
        if (event === "error") errorHandler = handler;
        return upstream;
      }),
      destroy: vi.fn((error: Error) => errorHandler?.(error)),
      end: vi.fn(),
    };
    requestMock.mockImplementationOnce((options: { lookup: Function }) => {
      options.lookup("provider.example", { all: true, family: 0 }, (error: Error | null, addresses: unknown, family?: number) => {
        lookupResult = { error, addresses, family };
      });
      return upstream;
    });

    const pending = safeExternalFetch("https://provider.example/v1", { signal: controller.signal }, { dnsLookup });
    await vi.waitFor(() =>
      expect(lookupResult).toEqual({
        error: null,
        addresses: [
          { address: "93.184.216.34", family: 4 },
          { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
        ],
        family: undefined,
      }),
    );

    controller.abort(new DOMException("stopped", "AbortError"));
    await expect(pending).rejects.toThrow("stopped");
  });

  it("revalidates a safe cross-origin redirect while preserving the method and body without credentials", async () => {
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
    const redirectedInit = fetchImpl.mock.calls[1]?.[1] as RequestInit;
    const redirectedHeaders = new Headers(redirectedInit.headers);
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://regional.provider.example/v1/chat/completions",
      expect.objectContaining({ method: "POST", body: init.body, redirect: "manual" }),
      expect.objectContaining({ addresses: ["104.16.1.2"] }),
    );
    expect(redirectedHeaders.get("authorization")).toBeNull();
  });

  it.each([301, 302, 303])("changes a POST redirect with status %i into a bodyless GET", async (status) => {
    const dnsLookup = vi.fn<(hostname: string) => Promise<readonly string[]>>().mockResolvedValue(["93.184.216.34"]);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status, headers: { Location: "/new-path" } }))
      .mockResolvedValueOnce(new Response("ok"));

    await safeExternalFetch(
      "https://provider.example/v1",
      { method: "POST", headers: { Authorization: "Bearer private-key" }, body: "private body" },
      { dnsLookup, fetchImpl },
    );

    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://provider.example/new-path",
      expect.objectContaining({ method: "GET", body: undefined, redirect: "manual" }),
      expect.anything(),
    );
  });

  it.each([307, 308])("preserves a POST body for same-origin status %i redirects", async (status) => {
    const dnsLookup = vi.fn<(hostname: string) => Promise<readonly string[]>>().mockResolvedValue(["93.184.216.34"]);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status, headers: { Location: "/new-path" } }))
      .mockResolvedValueOnce(new Response("ok"));

    await safeExternalFetch("https://provider.example/v1", { method: "POST", body: "private body" }, { dnsLookup, fetchImpl });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://provider.example/new-path",
      expect.objectContaining({ method: "POST", body: "private body", redirect: "manual" }),
      expect.anything(),
    );
  });

  it("strips credentials before a cross-origin redirect", async () => {
    const dnsLookup = vi.fn<(hostname: string) => Promise<readonly string[]>>().mockResolvedValue(["93.184.216.34"]);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 307, headers: { Location: "https://regional.provider.example/v1" } }))
      .mockResolvedValueOnce(new Response("ok"));

    await safeExternalFetch(
      "https://provider.example/v1",
      { method: "POST", headers: { Authorization: "Bearer private-key", Cookie: "session=private" }, body: "private body" },
      { dnsLookup, fetchImpl },
    );

    const redirectedInit = fetchImpl.mock.calls[1]?.[1] as RequestInit;
    const redirectedHeaders = new Headers(redirectedInit.headers);
    expect(redirectedHeaders.get("authorization")).toBeNull();
    expect(redirectedHeaders.get("cookie")).toBeNull();
    expect(redirectedInit.body).toBe("private body");
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

  it("rejects promptly on abort while DNS resolution is still pending", async () => {
    const controller = new AbortController();
    const dnsLookup = vi.fn<(hostname: string) => Promise<readonly string[]>>(() => new Promise(() => undefined));
    const fetchImpl = vi.fn();
    const abortError = new DOMException("request timed out", "TimeoutError");
    const pending = safeExternalFetch("https://provider.example/v1", { signal: controller.signal }, { dnsLookup, fetchImpl });

    controller.abort(abortError);

    await expect(
      Promise.race([
        pending,
        new Promise((_, reject) => setTimeout(() => reject(new Error("DNS lookup was not aborted")), 25)),
      ]),
    ).rejects.toBe(abortError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
