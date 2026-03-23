/**
 * AES-256-GCM encryption utility for user API keys.
 *
 * Encoded format (returned by encryptApiKey):
 *   base64( hex(iv) + ":" + hex(authTag) + ":" + hex(ciphertext) )
 *
 *   - iv       — 12 bytes (96-bit), randomly generated per encryption
 *   - authTag  — 16 bytes (128-bit) GCM authentication tag
 *   - ciphertext — variable length, AES-256-GCM encrypted plaintext
 *
 * The three parts are colon-separated hex strings, then base64-encoded as a
 * single self-contained value that can be stored in the database.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const secret = process.env.AI_KEY_ENCRYPTION_SECRET;

if (!secret) {
  throw new Error(
    "AI_KEY_ENCRYPTION_SECRET environment variable is required but not set. " +
      "Generate a value with: openssl rand -hex 32",
  );
}

if (secret.length !== 64) {
  throw new Error(
    "AI_KEY_ENCRYPTION_SECRET must be a 32-byte hex string (64 hex characters). " +
      "Generate a valid value with: openssl rand -hex 32",
  );
}

const KEY = Buffer.from(secret, "hex");

export function encryptApiKey(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
  return Buffer.from(combined).toString("base64");
}

export function decryptApiKey(ciphertext: string): string {
  const decoded = Buffer.from(ciphertext, "base64").toString("utf8");
  const [ivHex, authTagHex, encryptedHex] = decoded.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
