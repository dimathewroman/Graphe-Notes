// The pure routing decision for the dev-only Claude proxy. Gated by the flag, so
// production (flag unset) never routes to the proxy no matter the stored choice.
import { describe, it, expect, afterEach, vi } from "vitest";
import { shouldUseProxy, isClaudeProxyEnabled } from "@/hooks/use-claude-proxy";

afterEach(() => vi.unstubAllEnvs());

describe("shouldUseProxy", () => {
  it("is always false when the feature flag is off (production safety)", () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_CLAUDE_PROXY", "");
    expect(isClaudeProxyEnabled()).toBe(false);
    expect(shouldUseProxy("proxy", true)).toBe(false);
    expect(shouldUseProxy("auto", true)).toBe(false);
    expect(shouldUseProxy("account", true)).toBe(false);
  });

  describe("with the flag on", () => {
    const on = () => vi.stubEnv("NEXT_PUBLIC_ENABLE_CLAUDE_PROXY", "1");

    it("'account' never routes to the proxy", () => {
      on();
      expect(shouldUseProxy("account", true)).toBe(false);
      expect(shouldUseProxy("account", false)).toBe(false);
    });

    it("'proxy' always routes to the proxy, even before the probe confirms", () => {
      on();
      expect(shouldUseProxy("proxy", true)).toBe(true);
      expect(shouldUseProxy("proxy", false)).toBe(true);
    });

    it("'auto' routes to the proxy only when it's reachable", () => {
      on();
      expect(shouldUseProxy("auto", true)).toBe(true);
      expect(shouldUseProxy("auto", false)).toBe(false);
    });
  });
});
