export const GEMINI_FLASH_LITE = "gemini-2.5-flash-lite";
export const GEMINI_FLASH = "gemini-2.5-flash";
export const GEMINI_PRO = "gemini-2.5-pro";

export type TaskType = "background" | "manual" | "deliberate";
export type Provider = "graphe_free" | "google_ai_studio" | "openai" | "anthropic" | "local_llm";

export type ModelRoutingResult = {
  model: string;
  provider: Provider;
  taskType: TaskType;
  isAutoRouted: boolean;
};

export function resolveModel(
  provider: Provider,
  taskType: TaskType,
  modelOverride?: string,
): ModelRoutingResult {
  switch (provider) {
    case "graphe_free": {
      // Free tier is locked to Flash-Lite. modelOverride is intentionally ignored —
      // users on the free tier cannot choose their own model.
      return { model: GEMINI_FLASH_LITE, provider, taskType, isAutoRouted: true };
    }

    case "google_ai_studio": {
      // Google AI Studio uses automatic multi-model routing based on taskType.
      // User model override is not supported for this provider.
      const model =
        taskType === "background"
          ? GEMINI_FLASH_LITE
          : taskType === "manual"
            ? GEMINI_FLASH
            : GEMINI_PRO; // deliberate
      return { model, provider, taskType, isAutoRouted: true };
    }

    case "openai":
    case "anthropic": {
      if (!modelOverride) {
        throw new Error(`modelOverride is required for provider: ${provider}`);
      }
      return { model: modelOverride, provider, taskType, isAutoRouted: false };
    }

    case "local_llm": {
      // local_llm with no modelOverride passes no model name preference and lets
      // the endpoint decide which model to use.
      const model = modelOverride || "default";
      return { model, provider, taskType, isAutoRouted: false };
    }
  }
}
