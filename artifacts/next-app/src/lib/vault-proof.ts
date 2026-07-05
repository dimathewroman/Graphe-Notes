import { SignJWT, jwtVerify } from "jose";

// Server-enforced vault (§S / X-S2). POST /vault/unlock issues a short-lived
// signed proof after verifying the PIN; the client attaches it as the
// `x-vault-proof` header, and the note routes require it before returning a
// vaulted note's content. Signed HS256 with the app's server secret (reused —
// no new env var to provision).

const ALG = "HS256";
const TTL = "15m";
const CLAIM = "vault_unlocked";

function secretKey(): Uint8Array {
  const s = process.env.AI_KEY_ENCRYPTION_SECRET;
  if (!s) throw new Error("AI_KEY_ENCRYPTION_SECRET is not set — cannot sign vault proofs");
  return new TextEncoder().encode(s);
}

/** Issue a short-lived vault-unlock proof for the given user. */
export async function issueVaultProof(userId: string): Promise<string> {
  return new SignJWT({ scope: CLAIM })
    .setProtectedHeader({ alg: ALG })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(secretKey());
}

/**
 * Verify a vault-proof header value for a specific user. Returns true only if
 * the token is a valid, unexpired proof whose subject matches the user and
 * whose claim is present. Any failure (missing, malformed, expired, wrong user)
 * returns false — fail-closed.
 */
export async function hasValidVaultProof(
  token: string | null,
  userId: string,
): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: [ALG] });
    return payload.sub === userId && payload.scope === CLAIM;
  } catch {
    return false;
  }
}
