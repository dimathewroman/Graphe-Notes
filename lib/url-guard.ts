// SSRF guard for user-supplied upstream URLs that the SERVER will fetch (e.g. a
// custom OpenAI-compatible provider's base URL, saved then called by the generate
// route). A custom cloud provider is a public host, so we reject anything that
// points back at the server's own network: loopback, private ranges, link-local,
// and the cloud metadata address. This is not a defense against DNS rebinding —
// it's the coarse barrier that keeps obviously-internal targets out of the store.

function isBlockedIpv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if ([a, b, Number(m[3]), Number(m[4])].some((n) => n > 255)) return true; // malformed → block
  if (a === 0 || a === 127) return true; // "this host" / loopback
  if (a === 10) return true; // private
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 169 && b === 254) return true; // link-local (incl. 169.254.169.254 metadata)
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

/**
 * True only when `raw` is an http(s) URL to a routable, non-internal host —
 * i.e. safe for the server to fetch as a user-configured upstream.
 */
export function isSafeExternalUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  // URL.hostname keeps the brackets on IPv6 literals ("[::1]") — strip them so the
  // address checks below see the bare host.
  let host = u.hostname.toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  if (!host) return false;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;
  // IPv6 (URL hostname strips brackets): loopback, link-local (fe80), unique-local (fc/fd), unspecified.
  if (host.includes(":")) {
    if (host === "::1" || host === "::" || host.startsWith("fe80") || host.startsWith("fc") || host.startsWith("fd")) {
      return false;
    }
    return true;
  }
  return !isBlockedIpv4(host);
}
