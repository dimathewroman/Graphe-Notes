// This browser-safe package intentionally has no Node ambient types. Keep the
// direct public-env references so Next can inline them and Vitest can stub them.
declare const process: {
  readonly env: {
    readonly NEXT_PUBLIC_API_ORIGIN?: string;
    readonly NEXT_PUBLIC_ALLOW_LOOPBACK_API_ORIGIN?: string;
    readonly NODE_ENV?: string;
  };
};

export type CustomFetchOptions = RequestInit & {
  responseType?: "json" | "text" | "blob" | "auto";
};

export type ErrorType<T = unknown> = ApiError<T>;

export type BodyType<T> = T;

const NO_BODY_STATUS = new Set([204, 205, 304]);
const DEFAULT_JSON_ACCEPT = "application/json, application/problem+json";
const API_PATH_PREFIX = "/api";

function isRelativeApiPath(value: string): boolean {
  return (
    value === API_PATH_PREFIX ||
    value.startsWith(`${API_PATH_PREFIX}/`) ||
    value.startsWith(`${API_PATH_PREFIX}?`)
  );
}

function getRuntimeApiOrigin(): string | undefined {
  return process.env.NEXT_PUBLIC_API_ORIGIN;
}

function allowsInsecureLoopbackOrigin(): boolean {
  return (
    (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") &&
    process.env.NEXT_PUBLIC_ALLOW_LOOPBACK_API_ORIGIN === "1"
  );
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function resolveConfiguredApiOrigin(): string | null {
  const configuredOrigin = getRuntimeApiOrigin();
  if (configuredOrigin == null || configuredOrigin === "") return null;

  if (configuredOrigin !== configuredOrigin.trim()) {
    throw new TypeError("NEXT_PUBLIC_API_ORIGIN must not contain surrounding whitespace.");
  }

  let url: URL;
  try {
    url = new URL(configuredOrigin);
  } catch {
    throw new TypeError("NEXT_PUBLIC_API_ORIGIN must be a valid HTTPS origin.");
  }

  const isHttpsOrigin = url.protocol === "https:";
  const isExplicitDevelopmentLoopback =
    url.protocol === "http:" &&
    isLoopbackHost(url.hostname) &&
    allowsInsecureLoopbackOrigin();

  if (
    (!isHttpsOrigin && !isExplicitDevelopmentLoopback) ||
    url.username ||
    url.password ||
    !/^\/+$/u.test(url.pathname) ||
    url.search ||
    url.hash
  ) {
    throw new TypeError(
      "NEXT_PUBLIC_API_ORIGIN must be an HTTPS origin, or an explicitly enabled loopback HTTP origin in development/test.",
    );
  }

  return url.origin;
}

/**
 * Resolves an application-owned relative API path. Hosted web callers keep a
 * relative URL; a static client may supply the one trusted public API origin.
 * Absolute and non-API request targets are rejected before auth headers exist.
 */
export function resolveApiUrl(input: RequestInfo | URL): string {
  if (typeof input !== "string" || !isRelativeApiPath(input)) {
    throw new TypeError("Only relative /api request paths are allowed.");
  }

  const configuredOrigin = resolveConfiguredApiOrigin();
  return configuredOrigin ? new URL(input, `${configuredOrigin}/`).toString() : input;
}

function isRequest(input: RequestInfo | URL): input is Request {
  return typeof Request !== "undefined" && input instanceof Request;
}

function resolveMethod(input: RequestInfo | URL, explicitMethod?: string): string {
  if (explicitMethod) return explicitMethod.toUpperCase();
  if (isRequest(input)) return input.method.toUpperCase();
  return "GET";
}

function mergeHeaders(...sources: Array<HeadersInit | undefined>): Headers {
  const headers = new Headers();

  for (const source of sources) {
    if (!source) continue;
    new Headers(source).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return headers;
}

function getMediaType(headers: Headers): string | null {
  const value = headers.get("content-type");
  return value ? value.split(";", 1)[0].trim().toLowerCase() : null;
}

function isJsonMediaType(mediaType: string | null): boolean {
  return mediaType === "application/json" || Boolean(mediaType?.endsWith("+json"));
}

function isTextMediaType(mediaType: string | null): boolean {
  return Boolean(
    mediaType &&
      (mediaType.startsWith("text/") ||
        mediaType === "application/xml" ||
        mediaType === "text/xml" ||
        mediaType.endsWith("+xml") ||
        mediaType === "application/x-www-form-urlencoded"),
  );
}

// Loose equality (`== null`) handles both `null` (browser) and `undefined`
// (React Native, which doesn't implement ReadableStream body).
function hasNoBody(response: Response, method: string): boolean {
  if (method === "HEAD") return true;
  if (NO_BODY_STATUS.has(response.status)) return true;
  if (response.headers.get("content-length") === "0") return true;
  if (response.body == null) return true;
  return false;
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function getStringField(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;

  const candidate = (value as Record<string, unknown>)[key];
  if (typeof candidate !== "string") return undefined;

  const trimmed = candidate.trim();
  return trimmed === "" ? undefined : trimmed;
}

function truncate(text: string, maxLength = 300): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function buildErrorMessage(response: Response, data: unknown): string {
  const prefix = `HTTP ${response.status} ${response.statusText}`;

  if (typeof data === "string") {
    const text = data.trim();
    return text ? `${prefix}: ${truncate(text)}` : prefix;
  }

  const title = getStringField(data, "title");
  const detail = getStringField(data, "detail");
  const message =
    getStringField(data, "message") ??
    getStringField(data, "error_description") ??
    getStringField(data, "error");

  if (title && detail) return `${prefix}: ${title} — ${detail}`;
  if (detail) return `${prefix}: ${detail}`;
  if (message) return `${prefix}: ${message}`;
  if (title) return `${prefix}: ${title}`;

  return prefix;
}

export class ApiError<T = unknown> extends Error {
  readonly name = "ApiError";
  readonly status: number;
  readonly statusText: string;
  readonly data: T | null;
  readonly headers: Headers;
  readonly response: Response;
  readonly method: string;
  readonly url: string;

  constructor(
    response: Response,
    data: T | null,
    requestInfo: { method: string; url: string },
  ) {
    super(buildErrorMessage(response, data));
    Object.setPrototypeOf(this, new.target.prototype);

    this.status = response.status;
    this.statusText = response.statusText;
    this.data = data;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
  }
}

export class ResponseParseError extends Error {
  readonly name = "ResponseParseError";
  readonly status: number;
  readonly statusText: string;
  readonly headers: Headers;
  readonly response: Response;
  readonly method: string;
  readonly url: string;
  readonly rawBody: string;
  readonly cause: unknown;

  constructor(
    response: Response,
    rawBody: string,
    cause: unknown,
    requestInfo: { method: string; url: string },
  ) {
    super(
      `Failed to parse response from ${requestInfo.method} ${response.url || requestInfo.url} ` +
        `(${response.status} ${response.statusText}) as JSON`,
    );
    Object.setPrototypeOf(this, new.target.prototype);

    this.status = response.status;
    this.statusText = response.statusText;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
    this.rawBody = rawBody;
    this.cause = cause;
  }
}

async function parseJsonBody(
  response: Response,
  requestInfo: { method: string; url: string },
): Promise<unknown> {
  const raw = await response.text();
  const normalized = stripBom(raw);

  if (normalized.trim() === "") {
    return null;
  }

  try {
    return JSON.parse(normalized);
  } catch (cause) {
    throw new ResponseParseError(response, raw, cause, requestInfo);
  }
}

async function parseErrorBody(response: Response, method: string): Promise<unknown> {
  if (hasNoBody(response, method)) {
    return null;
  }

  const mediaType = getMediaType(response.headers);

  // Fall back to text when blob() is unavailable (e.g. some React Native builds).
  if (mediaType && !isJsonMediaType(mediaType) && !isTextMediaType(mediaType)) {
    return typeof response.blob === "function" ? response.blob() : response.text();
  }

  const raw = await response.text();
  const normalized = stripBom(raw);
  const trimmed = normalized.trim();

  if (trimmed === "") {
    return null;
  }

  if (isJsonMediaType(mediaType) || looksLikeJson(normalized)) {
    try {
      return JSON.parse(normalized);
    } catch {
      return raw;
    }
  }

  return raw;
}

function inferResponseType(response: Response): "json" | "text" | "blob" {
  const mediaType = getMediaType(response.headers);

  if (isJsonMediaType(mediaType)) return "json";
  if (isTextMediaType(mediaType) || mediaType == null) return "text";
  return "blob";
}

async function parseSuccessBody(
  response: Response,
  responseType: "json" | "text" | "blob" | "auto",
  requestInfo: { method: string; url: string },
): Promise<unknown> {
  if (hasNoBody(response, requestInfo.method)) {
    return null;
  }

  const effectiveType =
    responseType === "auto" ? inferResponseType(response) : responseType;

  switch (effectiveType) {
    case "json":
      return parseJsonBody(response, requestInfo);

    case "text": {
      const text = await response.text();
      return text === "" ? null : text;
    }

    case "blob":
      if (typeof response.blob !== "function") {
        throw new TypeError(
          "Blob responses are not supported in this runtime. " +
            "Use responseType \"json\" or \"text\" instead.",
        );
      }
      return response.blob();
  }
}

let _accessToken: string | null = null;
export function setAccessToken(token: string | null) { _accessToken = token; }
export function getAccessToken(): string | null { return _accessToken; }

// Short-lived vault unlock proof (issued by POST /vault/unlock). Held in memory
// only — the vault re-locks on reload, matching the in-memory unlock state.
// Attached as `x-vault-proof` so the server can gate vaulted-note content.
let _vaultProof: string | null = null;
export function setVaultProof(proof: string | null) { _vaultProof = proof; }
export function getVaultProof(): string | null { return _vaultProof; }

export function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = resolveApiUrl(input);
  const headers = new Headers(init?.headers);
  if (_accessToken && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${_accessToken}`);
  }
  if (_vaultProof && !headers.has("x-vault-proof")) {
    headers.set("x-vault-proof", _vaultProof);
  }
  return fetch(url, { ...init, headers });
}

export async function customFetch<T = unknown>(
  input: RequestInfo | URL,
  options: CustomFetchOptions = {},
): Promise<T> {
  const { responseType = "auto", headers: headersInit, ...init } = options;

  const method = resolveMethod(input, init.method);

  if (init.body != null && (method === "GET" || method === "HEAD")) {
    throw new TypeError(`customFetch: ${method} requests cannot have a body.`);
  }

  // Resolve and validate before constructing credential-bearing headers.
  const url = resolveApiUrl(input);
  const headers = mergeHeaders(isRequest(input) ? input.headers : undefined, headersInit);

  if (_accessToken && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${_accessToken}`);
  }

  if (_vaultProof && !headers.has("x-vault-proof")) {
    headers.set("x-vault-proof", _vaultProof);
  }

  if (
    typeof init.body === "string" &&
    !headers.has("content-type") &&
    looksLikeJson(init.body)
  ) {
    headers.set("content-type", "application/json");
  }

  if (responseType === "json" && !headers.has("accept")) {
    headers.set("accept", DEFAULT_JSON_ACCEPT);
  }

  const requestInfo = { method, url };

  const response = await fetch(url, { ...init, method, headers });

  if (!response.ok) {
    const errorData = await parseErrorBody(response, method);
    throw new ApiError(response, errorData, requestInfo);
  }

  return (await parseSuccessBody(response, responseType, requestInfo)) as T;
}
