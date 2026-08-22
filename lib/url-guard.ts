import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// SSRF validation for user-supplied upstream URLs that the server fetches. URL
// parsing is deliberately separate from resolution so save-time validation and
// fetch-time validation use the same rules without trusting an earlier DNS result.

export type DnsLookup = (hostname: string) => Promise<readonly string[]>;

export interface ResolvedExternalUrl {
  url: URL;
  addresses: readonly string[];
}

export class ExternalUrlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExternalUrlValidationError";
  }
}

function ipv4Parts(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null;
  const values = parts.map(Number);
  return values.some((value) => value > 255) ? null : values;
}

function isBlockedIpv4(address: string): boolean {
  const parts = ipv4Parts(address);
  if (!parts) return true;
  const [a, b, c] = parts;

  // Non-global IPv4 ranges, including unspecified, private, documentation,
  // benchmarking, multicast, and experimental space.
  if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && (b === 0 || b === 168)) return true;
  if (a === 192 && b === 88 && c === 99) return true;
  if (a === 192 && b === 0 && c === 2) return true;
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  return false;
}

function ipv6Words(address: string): number[] | null {
  const value = address.toLowerCase().replace(/^\[|\]$/g, "");
  const halves = value.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const groups = [...left, ...right];
  if (groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;
  const missing = 8 - groups.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null;
  return [...left, ...Array<string>(missing).fill("0"), ...right].map((group) => Number.parseInt(group, 16));
}

function isBlockedIpv6(address: string): boolean {
  const words = ipv6Words(address);
  if (!words) return true;

  // IPv4-mapped IPv6 literals inherit the IPv4 decision. IPv4-compatible
  // literals are deprecated and not a globally routable IPv6 address class.
  const firstFiveAreZero = words.slice(0, 5).every((word) => word === 0);
  const firstSixAreZero = words.slice(0, 6).every((word) => word === 0);
  if (firstFiveAreZero && words[5] === 0xffff) {
    return isBlockedIpv4(`${words[6] >> 8}.${words[6] & 0xff}.${words[7] >> 8}.${words[7] & 0xff}`);
  }
  if (firstSixAreZero) return true;

  // The well-known IPv4/IPv6 translation prefix is globally routable. Its
  // locally assigned companion (64:ff9b:1::/48) and all other 0064:: space
  // remain fail-closed below.
  const isWellKnownTranslation =
    words[0] === 0x0064 && words[1] === 0xff9b && words.slice(2, 6).every((word) => word === 0);
  if (isWellKnownTranslation) return false;

  // Globally routable IPv6 unicast is 2000::/3, excluding IANA special-use
  // assignments within that range. Everything else fails closed, including
  // deprecated site-local (fec0::/10), discard-only (100::/64), local-use,
  // link-local, unique-local, multicast, and reserved space.
  if ((words[0] & 0xe000) !== 0x2000) return true;
  if (words[0] === 0x2001 && words[1] === 0x0000) return true; // Teredo 2001::/32
  if (words[0] === 0x2001 && words[1] === 0x0002 && words[2] === 0x0000) return true; // benchmarking 2001:2::/48
  if (words[0] === 0x2001 && (words[1] & 0xfff0) === 0x0010) return true; // ORCHID 2001:10::/28
  if (words[0] === 0x2001 && (words[1] & 0xfff0) === 0x0020) return true; // ORCHIDv2 2001:20::/28
  if (words[0] === 0x2001 && words[1] === 0x0db8) return true; // documentation 2001:db8::/32
  if (words[0] === 0x2002) return true; // deprecated 6to4 2002::/16
  if (words[0] === 0x3fff && (words[1] & 0xf000) === 0x0000) return true; // documentation 3fff::/20
  return false;
}

/** Returns whether an address is a globally routable IP address. */
export function isPublicIpAddress(address: string): boolean {
  const normalized = address.replace(/^\[|\]$/g, "");
  const family = isIP(normalized);
  if (family === 4) return !isBlockedIpv4(normalized);
  if (family === 6) return !isBlockedIpv6(normalized);
  return false;
}

function parseSafeExternalUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;

  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) return null;
  if (isIP(hostname) !== 0 && !isPublicIpAddress(hostname)) return null;
  return url;
}

/**
 * Syntactic, storage-friendly validation. Fetch-time callers must additionally
 * resolve the host via `validateSafeExternalUrl` to contain DNS rebinding.
 */
export function isSafeExternalUrl(raw: string): boolean {
  return parseSafeExternalUrl(raw) !== null;
}

const systemDnsLookup: DnsLookup = async (hostname) => {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  return addresses.map(({ address }) => address);
};

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("The operation was aborted", "AbortError");
}

function awaitWithAbort<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return operation;
  if (signal.aborted) return Promise.reject(abortReason(signal));

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortReason(signal));
    signal.addEventListener("abort", onAbort, { once: true });
    operation.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

/**
 * Validates an HTTPS endpoint and every current DNS answer. A mixed public and
 * internal answer is unsafe because connection selection is not under our control.
 */
export async function resolveSafeExternalUrl(
  raw: string,
  dnsLookup: DnsLookup = systemDnsLookup,
  { signal }: { signal?: AbortSignal } = {},
): Promise<ResolvedExternalUrl> {
  const url = parseSafeExternalUrl(raw);
  if (!url) throw new ExternalUrlValidationError("endpoint must be a public HTTPS URL");

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(hostname) !== 0) return { url, addresses: [hostname] };

  let addresses: readonly string[];
  try {
    addresses = await awaitWithAbort(dnsLookup(hostname), signal);
  } catch {
    if (signal?.aborted) throw abortReason(signal);
    throw new ExternalUrlValidationError("endpoint hostname could not be resolved");
  }
  if (addresses.length === 0 || addresses.some((address) => !isPublicIpAddress(address))) {
    throw new ExternalUrlValidationError("endpoint resolves to a non-public address");
  }
  return { url, addresses };
}

export async function validateSafeExternalUrl(raw: string, dnsLookup: DnsLookup = systemDnsLookup): Promise<URL> {
  return (await resolveSafeExternalUrl(raw, dnsLookup)).url;
}
