// Phase 2.4: CRON_SECRET auth must fail-closed and compare in constant time.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { verifyCronAuth } from "@/lib/cron-auth";

const ORIGINAL = process.env.CRON_SECRET;
afterEach(() => {
  process.env.CRON_SECRET = ORIGINAL;
});

describe("verifyCronAuth", () => {
  it("rejects with 500 when CRON_SECRET is unset (fail-closed)", () => {
    delete process.env.CRON_SECRET;
    // Even the literal `Bearer undefined` an attacker could send must be rejected.
    expect(verifyCronAuth("Bearer undefined")).toEqual({
      ok: false,
      status: 500,
      error: "Server misconfiguration",
    });
  });

  describe("with a secret set", () => {
    beforeEach(() => {
      process.env.CRON_SECRET = "s3cr3t-token";
    });

    it("accepts the correct bearer token", () => {
      expect(verifyCronAuth("Bearer s3cr3t-token")).toEqual({ ok: true });
    });

    it("rejects a wrong token with 401", () => {
      expect(verifyCronAuth("Bearer wrong")).toMatchObject({ ok: false, status: 401 });
    });

    it("rejects a missing header with 401", () => {
      expect(verifyCronAuth(null)).toMatchObject({ ok: false, status: 401 });
    });

    it("rejects a token of a different length with 401 (no timingSafeEqual throw)", () => {
      expect(verifyCronAuth("Bearer s3cr3t-token-longer")).toMatchObject({
        ok: false,
        status: 401,
      });
    });
  });
});
