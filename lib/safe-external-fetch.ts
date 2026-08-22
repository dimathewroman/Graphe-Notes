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
    const settleReject = (error: Error) => {
      if (!settled) {
        settled = true;
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
          const address = endpoint.addresses.find((candidate) => options.family === 0 || isIP(candidate) === options.family);
          if (!address) return callback(new ExternalUrlValidationError("endpoint has no usable public address"), "", 0);
          return callback(null, address, isIP(address));
        },
      },
      (response) => {
        if (settled) return;
        settled = true;
        resolve(
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
      const abort = () => upstream.destroy(signal.reason instanceof Error ? signal.reason : new DOMException("Aborted", "AbortError"));
      if (signal.aborted) abort();
      else signal.addEventListener("abort", abort, { once: true });
    }
    if (request.body) Readable.fromWeb(request.body as unknown as import("node:stream/web").ReadableStream).pipe(upstream);
    else upstream.end();
  });
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
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const endpoint = await resolveSafeExternalUrl(nextUrl, dnsLookup);
    const response = await fetchImpl(endpoint.url.toString(), { ...init, redirect: "manual" }, endpoint);
    if (!REDIRECT_STATUSES.has(response.status)) return response;

    const location = response.headers.get("location");
    if (!location) return response;
    if (redirects === MAX_REDIRECTS) throw new ExternalUrlValidationError("endpoint redirected too many times");
    try {
      nextUrl = new URL(location, endpoint.url).toString();
    } catch {
      throw new ExternalUrlValidationError("endpoint returned an invalid redirect");
    }
  }

  throw new ExternalUrlValidationError("endpoint redirected too many times");
}
