import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { Readable } from "node:stream";
import { ExternalUrlValidationError, type DnsLookup, resolveSafeExternalUrl, type ResolvedExternalUrl } from "./url-guard";

export type ExternalFetch = (input: RequestInfo | URL, init: RequestInit, endpoint: ResolvedExternalUrl) => Promise<Response>;

export interface SafeExternalFetchDependencies {
  dnsLookup?: DnsLookup;
  fetchImpl?: ExternalFetch;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 3;

function toResponseHeaders(headers: Record<string, string | string[] | undefined>): Headers {
  const result = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) value.forEach((entry) => result.append(name, entry));
    else if (value !== undefined) result.set(name, value);
  }
  return result;
}

function systemFetch(input: RequestInfo | URL, init: RequestInit, endpoint: ResolvedExternalUrl): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : input.toString());
  const request = new Request(url, init);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const signal = init.signal;

  return new Promise((resolve, reject) => {
    let settled = false;
    let removeAbortListener: () => void = () => {};
    const settleResolve = (response: Response) => {
      if (!settled) {
        settled = true;
        removeAbortListener();
        resolve(response);
      }
    };
    const settleReject = (error: Error) => {
      if (!settled) {
        settled = true;
        removeAbortListener();
        reject(error);
      }
    };
    const upstream = httpsRequest(
      {
        protocol: "https:",
        hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
        servername: hostname,
        lookup: (_name, options, callback) => {
          const addresses = endpoint.addresses.filter((candidate) => options.family === 0 || isIP(candidate) === options.family);
          if (addresses.length === 0) return callback(new ExternalUrlValidationError("endpoint has no usable public address"), "", 0);
          if ((options as { all?: boolean }).all) {
            return (callback as unknown as (error: Error | null, addresses: Array<{ address: string; family: number }>) => void)(
              null,
              addresses.map((address) => ({ address, family: isIP(address) })),
            );
          }
          return callback(null, addresses[0], isIP(addresses[0]));
        },
      },
      (response) => {
        settleResolve(
          new Response(Readable.toWeb(response) as ReadableStream<Uint8Array>, {
            status: response.statusCode ?? 502,
            statusText: response.statusMessage ?? "",
            headers: toResponseHeaders(response.headers),
          }),
        );
      },
    );

    upstream.on("error", settleReject);
    if (signal) {
      const abort = () => {
        const reason = signal.reason instanceof Error ? signal.reason : new DOMException("Aborted", "AbortError");
        upstream.destroy(reason);
        settleReject(reason);
      };
      if (signal.aborted) abort();
      else {
        signal.addEventListener("abort", abort, { once: true });
        removeAbortListener = () => signal.removeEventListener("abort", abort);
      }
    }
    if (signal?.aborted) return;
    if (request.body) Readable.fromWeb(request.body as unknown as import("node:stream/web").ReadableStream).pipe(upstream);
    else upstream.end();
  });
}

function redirectedInit(init: RequestInit, status: number, from: URL, to: URL): RequestInit {
  const method = (init.method ?? "GET").toUpperCase();
  const changePostToGet = (status === 301 || status === 302) && method === "POST";
  const changeToGet = status === 303 && method !== "HEAD";
  const crossOrigin = from.origin !== to.origin;
  if (!changePostToGet && !changeToGet && !crossOrigin) return init;

  const headers = new Headers(init.headers);
  if (crossOrigin) {
    headers.delete("authorization");
    headers.delete("proxy-authorization");
    headers.delete("cookie");
  }
  if (changePostToGet || changeToGet) {
    headers.delete("content-length");
    headers.delete("content-type");
    headers.delete("transfer-encoding");
    return { ...init, method: "GET", body: undefined, headers };
  }
  return { ...init, headers };
}

/**
 * Resolves and validates a custom external endpoint immediately before sending
 * a request. Redirects are followed manually so each hop is resolved and
 * validated before re-sending an Authorization header or request body.
 */
export async function safeExternalFetch(
  rawUrl: string,
  init: RequestInit,
  { dnsLookup, fetchImpl = systemFetch }: SafeExternalFetchDependencies = {},
): Promise<Response> {
  let nextUrl = rawUrl;
  let nextInit = init;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const endpoint = await resolveSafeExternalUrl(nextUrl, dnsLookup, { signal: init.signal ?? undefined });
    const response = await fetchImpl(endpoint.url.toString(), { ...nextInit, redirect: "manual" }, endpoint);
    if (!REDIRECT_STATUSES.has(response.status)) return response;

    const location = response.headers.get("location");
    if (!location) return response;
    if (redirects === MAX_REDIRECTS) throw new ExternalUrlValidationError("endpoint redirected too many times");
    try {
      const redirectedUrl = new URL(location, endpoint.url);
      nextInit = redirectedInit(nextInit, response.status, endpoint.url, redirectedUrl);
      nextUrl = redirectedUrl.toString();
    } catch {
      throw new ExternalUrlValidationError("endpoint returned an invalid redirect");
    }
  }

  throw new ExternalUrlValidationError("endpoint redirected too many times");
}
