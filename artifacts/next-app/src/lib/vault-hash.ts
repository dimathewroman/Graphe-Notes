/**
 * Server-side vault PIN hashing utilities (WARNING-7 remediation).
 *
 * All vault PINs are now hashed server-side with bcrypt. Legacy rows that
 * were previously stored as client-side SHA-256 digests are transparently
 * migrated to bcrypt on the user's next successful unlock.
 *
 * Exported helpers:
 *   hashPin(pin)                 — bcrypt-hash a plaintext PIN for storage
 *   verifyPin(pin, stored)       — verify a PIN against a stored hash
 *                                  (handles both bcrypt and legacy SHA-256)
 *   isBcryptHash(hash)           — detect whether a stored hash is bcrypt
 */

import bcrypt from "bcryptjs";
import { createHash } from "crypto";

/** Cost factor for bcrypt. 12 is the OWASP-recommended minimum. */
const BCRYPT_ROUNDS = 12;

/** Bcrypt output always begins with one of these prefixes. */
function isBcryptHash(hash: string): boolean {
  return hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$");
}

/**
 * Hash a plaintext PIN with bcrypt.
 * Use this on setup and when re-hashing a migrated legacy PIN.
 */
export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, BCRYPT_ROUNDS);
}

export interface VerifyResult {
  /** True if the PIN matches the stored hash. */
  valid: boolean;
  /**
   * True when the stored hash was a legacy SHA-256 digest that has just been
   * verified. The caller MUST re-hash the plaintext PIN with bcrypt and
   * persist the new hash before returning a response.
   */
  needsMigration: boolean;
}

/**
 * Verify a plaintext PIN against a stored hash.
 *
 * If the stored hash is bcrypt: uses bcrypt.compare().
 * If the stored hash is a legacy SHA-256 hex digest (64 chars, no bcrypt
 * prefix): computes SHA-256 of the pin and compares the hex strings. On a
 * match, `needsMigration` is set to `true` so the caller can upgrade to bcrypt.
 */
export async function verifyPin(pin: string, storedHash: string): Promise<VerifyResult> {
  if (isBcryptHash(storedHash)) {
    const valid = await bcrypt.compare(pin, storedHash);
    return { valid, needsMigration: false };
  }

  // Legacy path: stored hash is a client-side SHA-256 hex digest.
  const digest = createHash("sha256").update(pin).digest("hex");
  const valid = digest === storedHash;
  return { valid, needsMigration: valid };
}
