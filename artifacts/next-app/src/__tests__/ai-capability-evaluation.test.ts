import { describe, expect, it } from "vitest";
import { evaluateAiCapability } from "@lib/ai-capabilities";

const capability = "selection.transform.v1" as const;

describe("evaluateAiCapability", () => {
  it("routes a configured local LLM through the browser", () => {
    expect(
      evaluateAiCapability({
        capability,
        activeProvider: "local_llm",
        localEndpoint: "http://localhost:1234",
      }),
    ).toEqual({
      status: "ready",
      capability,
      provider: "local_llm",
      path: "browser_local",
    });
  });

  it("keeps an unconfigured local LLM unavailable instead of falling back to cloud", () => {
    expect(
      evaluateAiCapability({
        capability,
        activeProvider: "local_llm",
      }),
    ).toEqual({
      status: "unavailable",
      capability,
      code: "local_llm_unconfigured",
    });
  });

  it("routes an explicitly selected cloud provider through the server", () => {
    expect(
      evaluateAiCapability({
        capability,
        activeProvider: "openai",
      }),
    ).toEqual({
      status: "ready",
      capability,
      provider: "openai",
      path: "server_cloud",
    });
  });

  it("reports no active provider as unavailable", () => {
    expect(
      evaluateAiCapability({
        capability,
        activeProvider: null,
      }),
    ).toEqual({
      status: "unavailable",
      capability,
      code: "no_active_provider",
    });
  });

  it("rejects an unsupported provider rather than silently selecting Graphe Free", () => {
    expect(
      evaluateAiCapability({
        capability,
        activeProvider: "unexpected_provider",
      }),
    ).toEqual({
      status: "unavailable",
      capability,
      code: "unsupported_provider",
    });
  });
});
