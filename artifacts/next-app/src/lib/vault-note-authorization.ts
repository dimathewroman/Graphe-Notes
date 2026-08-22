import type { NextRequest } from "next/server";
import { hasValidVaultProof } from "@/lib/vault-proof";

/**
 * Checks the extra authorization required before an owner can access or change
 * a vaulted note and data derived from it. Non-vaulted notes need no proof.
 */
export async function canAccessVaultedNote(
  request: NextRequest,
  userId: string,
  vaulted: boolean | null,
): Promise<boolean> {
  return (
    !vaulted || hasValidVaultProof(request.headers.get("x-vault-proof"), userId)
  );
}
