// @vitest-environment node
// Phase 2.1: the vault unlock proof must only validate for the issuing user and
// must fail closed on anything malformed/tampered/expired. Runs in the node env
// (jose uses Web Crypto; jsdom's cross-realm Uint8Array breaks it — the server
// runtime is node anyway).
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.AI_KEY_ENCRYPTION_SECRET =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
});

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

describe("vault proof", () => {
  it("verifies a fresh proof for the issuing user", async () => {
    const { issueVaultProof, hasValidVaultProof } = await import("@/lib/vault-proof");
    const proof = await issueVaultProof(USER_A);
    expect(await hasValidVaultProof(proof, USER_A)).toBe(true);
  });

  it("rejects a proof presented for a different user", async () => {
    const { issueVaultProof, hasValidVaultProof } = await import("@/lib/vault-proof");
    const proof = await issueVaultProof(USER_A);
    expect(await hasValidVaultProof(proof, USER_B)).toBe(false);
  });

  it("rejects a missing proof", async () => {
    const { hasValidVaultProof } = await import("@/lib/vault-proof");
    expect(await hasValidVaultProof(null, USER_A)).toBe(false);
    expect(await hasValidVaultProof("", USER_A)).toBe(false);
  });

  it("rejects a tampered/garbage token", async () => {
    const { issueVaultProof, hasValidVaultProof } = await import("@/lib/vault-proof");
    const proof = await issueVaultProof(USER_A);
    expect(await hasValidVaultProof(proof + "x", USER_A)).toBe(false);
    expect(await hasValidVaultProof("not.a.jwt", USER_A)).toBe(false);
  });
});
