export const AI_PROVIDER_IDS = [
  "graphe_free",
  "google_ai_studio",
  "openai",
  "anthropic",
  "local_llm",
  "openrouter",
  "groq",
  "mistral",
  "together",
  "fireworks",
  "custom_openai",
] as const;

export type AiProvider = (typeof AI_PROVIDER_IDS)[number];

export const AI_CAPABILITY_IDS = ["selection.transform.v1"] as const;

export type AiCapability = (typeof AI_CAPABILITY_IDS)[number];

export type AiCapabilityEvaluation =
  | {
      status: "ready";
      capability: AiCapability;
      provider: AiProvider;
      path: "browser_local" | "server_cloud";
    }
  | {
      status: "unavailable";
      capability: AiCapability;
      code:
        | "no_active_provider"
        | "unsupported_provider"
        | "local_llm_unconfigured";
    };

export function isAiProvider(value: unknown): value is AiProvider {
  return (
    typeof value === "string" &&
    (AI_PROVIDER_IDS as readonly string[]).includes(value)
  );
}

/**
 * Decides whether an explicitly selected provider can execute an AI capability.
 * It deliberately has no default provider: missing, stale, or incomplete settings
 * must stay unavailable rather than sending note content to a cloud provider.
 */
export function evaluateAiCapability({
  capability,
  activeProvider,
  localEndpoint,
}: {
  capability: AiCapability;
  activeProvider: string | null | undefined;
  localEndpoint?: string | null;
}): AiCapabilityEvaluation {
  if (!activeProvider) {
    return { status: "unavailable", capability, code: "no_active_provider" };
  }

  if (!isAiProvider(activeProvider)) {
    return { status: "unavailable", capability, code: "unsupported_provider" };
  }

  if (activeProvider === "local_llm") {
    if (!localEndpoint?.trim()) {
      return {
        status: "unavailable",
        capability,
        code: "local_llm_unconfigured",
      };
    }
    return {
      status: "ready",
      capability,
      provider: activeProvider,
      path: "browser_local",
    };
  }

  return {
    status: "ready",
    capability,
    provider: activeProvider,
    path: "server_cloud",
  };
}
