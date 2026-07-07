import { useState, useEffect, useCallback } from "react";
import { Key, Cloud, Server, AlertCircle, CheckCircle2, Zap, Eye, EyeOff } from "lucide-react";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";
import { stripTrailingSlashes } from "@lib/ai-providers";
import { authenticatedFetch } from "@workspace/api-client-react/custom-fetch";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "../ui/select";
import { ClaudeProxyDevPanel } from "./ClaudeProxyDevPanel";

// G17 (9.2): OpenAI-compatible providers share one server adapter; the UI lists
// them from this single config so adding one is a one-line change here.
type CompatProvider = "openrouter" | "groq" | "mistral" | "together" | "fireworks" | "custom_openai";
type AiProvider =
  | "graphe_free"
  | "google_ai_studio"
  | "openai"
  | "anthropic"
  | "local_llm"
  | CompatProvider;
type ByokSubProvider = "openai" | "anthropic";
type KeyInfo = { hasKey: boolean; endpointUrl: string | null; modelOverride: string | null };

const COMPAT_PROVIDERS: { id: CompatProvider; label: string; hint: string; needsEndpoint?: boolean }[] = [
  { id: "openrouter", label: "OpenRouter", hint: "300+ models, one key" },
  { id: "groq", label: "Groq", hint: "Fast inference" },
  { id: "mistral", label: "Mistral", hint: "Mistral La Plateforme" },
  { id: "together", label: "Together AI", hint: "Open models" },
  { id: "fireworks", label: "Fireworks", hint: "Fast open models" },
  { id: "custom_openai", label: "Custom", hint: "Any OpenAI-compatible URL", needsEndpoint: true },
];
const COMPAT_IDS = COMPAT_PROVIDERS.map((p) => p.id);
type UsageData = { hourlyUsed: number; hourlyLimit: number; resetInMs: number };

export function AiSettingsTab({ isDemo }: { isDemo: boolean }) {
  const isSettingsOpen = useAppStore(s => s.isSettingsOpen);

  // ── AI Provider state ────────────────────────────────────────────
  const [aiProvider, setAiProvider] = useState<AiProvider | null>(null);
  const [savedKeys, setSavedKeys] = useState<Record<string, KeyInfo>>({});
  const [byokSubProvider, setByokSubProvider] = useState<ByokSubProvider>("openai");

  // Google AI Studio
  const [googleKey, setGoogleKey] = useState("");
  const [googleKeyVisible, setGoogleKeyVisible] = useState(false);
  const [googleModelOverride, setGoogleModelOverride] = useState("");
  const [googleSaving, setGoogleSaving] = useState(false);

  // BYOK — OpenAI
  const [byokOpenaiKey, setByokOpenaiKey] = useState("");
  const [byokOpenaiKeyVisible, setByokOpenaiKeyVisible] = useState(false);
  const [byokOpenaiModel, setByokOpenaiModel] = useState("");
  const [byokOpenaiSaving, setByokOpenaiSaving] = useState(false);

  // BYOK — Anthropic
  const [byokAnthropicKey, setByokAnthropicKey] = useState("");
  const [byokAnthropicKeyVisible, setByokAnthropicKeyVisible] = useState(false);
  const [byokAnthropicModel, setByokAnthropicModel] = useState("");
  const [byokAnthropicSaving, setByokAnthropicSaving] = useState(false);

  // BYOK — model dropdowns
  const [byokOpenaiModels, setByokOpenaiModels] = useState<string[]>([]);
  const [byokAnthropicModels, setByokAnthropicModels] = useState<string[]>([]);
  const [byokOpenaiModelsLoading, setByokOpenaiModelsLoading] = useState(false);
  const [byokAnthropicModelsLoading, setByokAnthropicModelsLoading] = useState(false);
  const [byokModelSaving, setByokModelSaving] = useState(false);

  // Local / Hosted LLM
  const [localEndpoint, setLocalEndpoint] = useState("");
  const [localModel, setLocalModel] = useState("");
  const [localApiKey, setLocalApiKey] = useState("");
  const [localApiKeyVisible, setLocalApiKeyVisible] = useState(false);
  const [localSaving, setLocalSaving] = useState(false);
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [localModelsLoading, setLocalModelsLoading] = useState(false);

  // OpenAI-compatible BYOK (9.2): one set of fields drives all six providers.
  const [compatProvider, setCompatProvider] = useState<CompatProvider>("openrouter");
  const [compatKey, setCompatKey] = useState("");
  const [compatKeyVisible, setCompatKeyVisible] = useState(false);
  const [compatEndpoint, setCompatEndpoint] = useState(""); // custom_openai base URL
  const [compatModel, setCompatModel] = useState("");
  const [compatModels, setCompatModels] = useState<string[]>([]);
  const [compatModelsLoading, setCompatModelsLoading] = useState(false);
  const [compatSaving, setCompatSaving] = useState(false);

  // Usage (Graphe Free)
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [usageCountdown, setUsageCountdown] = useState(0);

  // ── Fetch available models from provider ────────────────────────
  const fetchByokModels = useCallback(async (sub: ByokSubProvider, apiKey?: string) => {
    const setModels = sub === "openai" ? setByokOpenaiModels : setByokAnthropicModels;
    const setLoading = sub === "openai" ? setByokOpenaiModelsLoading : setByokAnthropicModelsLoading;
    setLoading(true);
    try {
      const res = await authenticatedFetch("/api/ai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: sub, ...(apiKey ? { apiKey } : {}) }),
      });
      if (!res.ok) { setModels([]); return; }
      const data = await res.json() as { models?: string[] };
      setModels(data.models ?? []);
    } catch {
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce: fetch models as user types their OpenAI key
  useEffect(() => {
    if (!byokOpenaiKey.trim() || byokOpenaiKey.length < 10) {
      setByokOpenaiModels([]);
      return;
    }
    const timer = setTimeout(() => { void fetchByokModels("openai", byokOpenaiKey); }, 600);
    return () => clearTimeout(timer);
  }, [byokOpenaiKey, fetchByokModels]);

  // Debounce: fetch models as user types their Anthropic key
  useEffect(() => {
    if (!byokAnthropicKey.trim() || byokAnthropicKey.length < 10) {
      setByokAnthropicModels([]);
      return;
    }
    const timer = setTimeout(() => { void fetchByokModels("anthropic", byokAnthropicKey); }, 600);
    return () => clearTimeout(timer);
  }, [byokAnthropicKey, fetchByokModels]);

  // ── 9.2: OpenAI-compatible + local model discovery ──────────────
  // Providers with a fixed, provider-owned base URL discover server-side (the key
  // stays server-only and there's no CORS wall). User-controlled endpoints —
  // custom_openai and local_llm — discover client-side: the browser can reach the
  // user's own host, and no user URL ever touches our server (no SSRF surface).
  const parseModelIds = (data: { data?: Array<{ id?: string }> }): string[] =>
    (data.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === "string" && id.length > 0).sort();

  const fetchCompatModels = useCallback(async (provider: CompatProvider, apiKey: string, endpointUrl?: string) => {
    setCompatModelsLoading(true);
    try {
      if (provider === "custom_openai") {
        if (!endpointUrl) { setCompatModels([]); return; }
        const res = await fetch(`${stripTrailingSlashes(endpointUrl)}/models`, {
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        });
        if (!res.ok) { setCompatModels([]); return; }
        setCompatModels(parseModelIds(await res.json()));
        return;
      }
      const res = await authenticatedFetch("/api/ai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      });
      if (!res.ok) { setCompatModels([]); return; }
      const data = await res.json() as { models?: string[] };
      setCompatModels(data.models ?? []);
    } catch { setCompatModels([]); }
    finally { setCompatModelsLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const discoverLocalModels = useCallback(async (endpoint: string, apiKey?: string) => {
    if (!endpoint.trim()) return;
    setLocalModelsLoading(true);
    try {
      const res = await fetch(`${stripTrailingSlashes(endpoint.trim())}/v1/models`, {
        headers: apiKey?.trim() ? { Authorization: `Bearer ${apiKey.trim()}` } : {},
      });
      if (!res.ok) { setLocalModels([]); return; }
      setLocalModels(parseModelIds(await res.json()));
    } catch { setLocalModels([]); }
    finally { setLocalModelsLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce: discover models as the user types their key (and base URL for custom).
  useEffect(() => {
    const needsEndpoint = compatProvider === "custom_openai";
    if (!compatKey.trim() || compatKey.length < 10 || (needsEndpoint && !compatEndpoint.trim())) {
      setCompatModels([]);
      return;
    }
    const timer = setTimeout(() => {
      void fetchCompatModels(compatProvider, compatKey.trim(), needsEndpoint ? compatEndpoint.trim() : undefined);
    }, 600);
    return () => clearTimeout(timer);
  }, [compatKey, compatEndpoint, compatProvider, fetchCompatModels]);

  // Keep the model/endpoint fields in sync with the selected compat provider's saved key.
  useEffect(() => {
    const info = savedKeys[compatProvider];
    setCompatModel(info?.modelOverride ?? "");
    setCompatEndpoint(info?.endpointUrl ?? "");
  }, [compatProvider, savedKeys]);

  // ── Load AI settings on open ────────────────────────────────────
  // This component only mounts when the AI tab is active, so we run on open
  // (isSettingsOpen) rather than gating on the active tab.
  useEffect(() => {
    if (!isSettingsOpen) return;
    // X-D1: demo mode has no authenticated backend — these would all 401. Demo
    // defaults to graphe_free; nothing here persists.
    if (isDemo) return;

    authenticatedFetch("/api/ai/settings")
      .then(r => r.json())
      .then((data: { activeAiProvider: string | null }) => {
        const p = data.activeAiProvider as AiProvider | null;
        setAiProvider(p);
        if (p === "openai" || p === "anthropic") setByokSubProvider(p);
        if (p && COMPAT_IDS.includes(p as CompatProvider)) setCompatProvider(p as CompatProvider);
      })
      .catch(() => {});

    authenticatedFetch("/api/ai/keys")
      .then(r => r.json())
      .then((rows: Array<{ provider: string; hasKey: boolean; endpointUrl: string | null; modelOverride: string | null }>) => {
        const map: Record<string, KeyInfo> = {};
        for (const row of rows) {
          map[row.provider] = { hasKey: row.hasKey, endpointUrl: row.endpointUrl, modelOverride: row.modelOverride };
        }
        setSavedKeys(map);
        if (map["google_ai_studio"]?.modelOverride) setGoogleModelOverride(map["google_ai_studio"].modelOverride!);
        if (map["openai"]?.modelOverride) setByokOpenaiModel(map["openai"].modelOverride!);
        if (map["anthropic"]?.modelOverride) setByokAnthropicModel(map["anthropic"].modelOverride!);
        if (map["local_llm"]?.endpointUrl) setLocalEndpoint(map["local_llm"].endpointUrl!);
        if (map["local_llm"]?.modelOverride) setLocalModel(map["local_llm"].modelOverride!);
        // Populate model dropdowns for already-saved keys
        if (map["openai"]?.hasKey) void fetchByokModels("openai");
        if (map["anthropic"]?.hasKey) void fetchByokModels("anthropic");
      })
      .catch(() => {});

    authenticatedFetch("/api/ai/usage")
      .then(r => r.json())
      .then((data: UsageData) => {
        setUsageData(data);
        setUsageCountdown(Math.ceil(data.resetInMs / 1000));
      })
      .catch(() => {});
  }, [isSettingsOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Usage countdown timer ────────────────────────────────────────
  // E13: depend on a derived boolean, not usageCountdown itself. Depending on the
  // value re-ran this effect every tick (clearInterval + setInterval each second,
  // ~1 GC-churning teardown/second). The functional updater means the interval
  // never needs the live value, so it's created once when the countdown starts and
  // cleared once when it reaches zero.
  const isUsageCounting = usageCountdown > 0;
  useEffect(() => {
    if (!isUsageCounting) return;
    const timer = setInterval(() => setUsageCountdown(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [isUsageCounting]);

  // ── AI handlers ─────────────────────────────────────────────────
  // Commit the active provider to the server. Also flips hasCompletedAiSetup
  // so the first-time AI setup modal won't reappear after a direct Settings save.
  const commitActiveProvider = async (newProvider: AiProvider) => {
    if (isDemo) return; // X-D1: no settings backend in demo
    await authenticatedFetch("/api/ai/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeAiProvider: newProvider, hasCompletedAiSetup: true }),
    }).catch(() => {});
  };

  // Click handler for provider cards. Updates the visible detail panel and
  // only commits to the server when the provider already has a working
  // configuration. This prevents leaving the user with a non-working active
  // provider if they click a card and close the modal without saving credentials.
  const handleAiProviderChange = async (newProvider: AiProvider) => {
    setAiProvider(newProvider);
    if (newProvider === "openai" || newProvider === "anthropic") setByokSubProvider(newProvider);

    const isConfigured =
      newProvider === "graphe_free" ||
      (newProvider === "google_ai_studio" && savedKeys["google_ai_studio"]?.hasKey) ||
      (newProvider === "openai" && savedKeys["openai"]?.hasKey) ||
      (newProvider === "anthropic" && savedKeys["anthropic"]?.hasKey) ||
      (COMPAT_IDS.includes(newProvider as CompatProvider) && Boolean(savedKeys[newProvider]?.hasKey)) ||
      (newProvider === "local_llm" && Boolean(savedKeys["local_llm"]?.endpointUrl));

    if (isConfigured) await commitActiveProvider(newProvider);
  };

  const handleSaveGoogleKey = async () => {
    if (isDemo) return; // X-D1: no AI-key backend in demo
    if (!googleKey.trim()) return;
    setGoogleSaving(true);
    try {
      await authenticatedFetch("/api/ai/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "google_ai_studio", apiKey: googleKey.trim(), modelOverride: googleModelOverride.trim() || null }),
      });
      setSavedKeys(prev => ({ ...prev, google_ai_studio: { hasKey: true, endpointUrl: null, modelOverride: googleModelOverride.trim() || null } }));
      setGoogleKey("");
      await commitActiveProvider("google_ai_studio");
    } finally {
      setGoogleSaving(false);
    }
  };

  const handleSaveByokKey = async (sub: ByokSubProvider) => {
    if (isDemo) return; // X-D1: no AI-key backend in demo
    const isOpenai = sub === "openai";
    const key = isOpenai ? byokOpenaiKey : byokAnthropicKey;
    const modelOverride = isOpenai ? byokOpenaiModel : byokAnthropicModel;
    if (!key.trim()) return;
    if (isOpenai) setByokOpenaiSaving(true); else setByokAnthropicSaving(true);
    try {
      await authenticatedFetch("/api/ai/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: sub, apiKey: key.trim(), modelOverride: modelOverride.trim() || null }),
      });
      setSavedKeys(prev => ({ ...prev, [sub]: { hasKey: true, endpointUrl: null, modelOverride: modelOverride.trim() || null } }));
      if (isOpenai) setByokOpenaiKey(""); else setByokAnthropicKey("");
      await commitActiveProvider(sub);
    } finally {
      if (isOpenai) setByokOpenaiSaving(false); else setByokAnthropicSaving(false);
    }
  };

  const handleSaveCompatKey = async () => {
    if (isDemo) return; // X-D1: no AI-key backend in demo
    if (!compatKey.trim()) return;
    if (compatProvider === "custom_openai" && !compatEndpoint.trim()) return;
    setCompatSaving(true);
    try {
      await authenticatedFetch("/api/ai/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: compatProvider,
          apiKey: compatKey.trim(),
          modelOverride: compatModel.trim() || null,
          ...(compatProvider === "custom_openai" ? { endpointUrl: compatEndpoint.trim() } : {}),
        }),
      });
      setSavedKeys(prev => ({
        ...prev,
        [compatProvider]: {
          hasKey: true,
          endpointUrl: compatProvider === "custom_openai" ? compatEndpoint.trim() : null,
          modelOverride: compatModel.trim() || null,
        },
      }));
      setCompatKey("");
      await commitActiveProvider(compatProvider);
    } finally {
      setCompatSaving(false);
    }
  };

  const handleSaveLocalLlm = async () => {
    if (isDemo) return; // X-D1: no AI-key backend in demo
    if (!localEndpoint.trim()) return;
    // Strip trailing slashes so we never produce double-slash URLs like
    // http://localhost:8000//v1/chat/completions when concatenating the path.
    const normalizedEndpoint = stripTrailingSlashes(localEndpoint.trim());
    setLocalSaving(true);
    try {
      const trimmedKey = localApiKey.trim();
      await authenticatedFetch("/api/ai/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "local_llm",
          endpointUrl: normalizedEndpoint,
          modelOverride: localModel.trim() || null,
          apiKey: trimmedKey || null,
        }),
      });
      setSavedKeys(prev => ({
        ...prev,
        local_llm: {
          hasKey: trimmedKey.length > 0,
          endpointUrl: normalizedEndpoint,
          modelOverride: localModel.trim() || null,
        },
      }));
      setLocalEndpoint(normalizedEndpoint);
      setLocalApiKey("");
      await commitActiveProvider("local_llm");
    } finally {
      setLocalSaving(false);
    }
  };

  const handleRemoveKey = async (provider: string) => {
    if (isDemo) return; // X-D1: no AI-key backend in demo
    await authenticatedFetch("/api/ai/keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    }).catch(() => {});
    setSavedKeys(prev => {
      const updated = { ...prev };
      delete updated[provider];
      return updated;
    });
    if (provider === "openai") { setByokOpenaiModels([]); setByokOpenaiModel(""); }
    if (provider === "anthropic") { setByokAnthropicModels([]); setByokAnthropicModel(""); }
  };

  const handleUpdateByokModel = async (sub: ByokSubProvider) => {
    const model = sub === "openai" ? byokOpenaiModel : byokAnthropicModel;
    setByokModelSaving(true);
    try {
      await authenticatedFetch("/api/ai/keys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: sub, modelOverride: model.trim() || null }),
      });
      setSavedKeys(prev => ({
        ...prev,
        [sub]: { ...prev[sub], modelOverride: model.trim() || null },
      }));
    } finally {
      setByokModelSaving(false);
    }
  };

  // Derived: which provider card is highlighted
  const activeCard =
    aiProvider === "openai" || aiProvider === "anthropic"
      ? "byok"
      : aiProvider && COMPAT_IDS.includes(aiProvider as CompatProvider)
        ? "compat"
        : aiProvider;

  return (
    <section className="space-y-4">
      {/* Dev-only: local Claude proxy routing (renders null unless the flag is set) */}
      <ClaudeProxyDevPanel />

      {/* Provider selection cards */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-2">AI Provider</label>
        <div className="grid grid-cols-2 gap-2">
          {/* Graphe Free */}
          <button
            onClick={() => handleAiProviderChange("graphe_free")}
            className={cn(
              "flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all",
              activeCard === "graphe_free"
                ? "border-primary bg-primary/10"
                : "border-panel-border bg-background hover:border-primary/40"
            )}
          >
            <div className="flex items-center gap-1.5">
              <Zap className={cn("w-3.5 h-3.5", activeCard === "graphe_free" ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("text-sm font-medium", activeCard === "graphe_free" ? "text-primary" : "text-foreground")}>Graphe Free</span>
            </div>
            <span className="text-2xs text-muted-foreground">Built-in, no key needed</span>
          </button>

          {/* Google AI Studio */}
          <button
            onClick={() => handleAiProviderChange("google_ai_studio")}
            className={cn(
              "flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all",
              activeCard === "google_ai_studio"
                ? "border-primary bg-primary/10"
                : "border-panel-border bg-background hover:border-primary/40"
            )}
          >
            <div className="flex items-center gap-1.5">
              <Key className={cn("w-3.5 h-3.5", activeCard === "google_ai_studio" ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("text-sm font-medium", activeCard === "google_ai_studio" ? "text-primary" : "text-foreground")}>Google AI Studio</span>
            </div>
            <span className="text-2xs text-muted-foreground">Your own Gemini key</span>
          </button>

          {/* Custom BYOK */}
          <button
            onClick={() => handleAiProviderChange(byokSubProvider)}
            className={cn(
              "flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all",
              activeCard === "byok"
                ? "border-primary bg-primary/10"
                : "border-panel-border bg-background hover:border-primary/40"
            )}
          >
            <div className="flex items-center gap-1.5">
              <Key className={cn("w-3.5 h-3.5", activeCard === "byok" ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("text-sm font-medium", activeCard === "byok" ? "text-primary" : "text-foreground")}>OpenAI / Anthropic</span>
            </div>
            <span className="text-2xs text-muted-foreground">Your own API key</span>
          </button>

          {/* Local / Hosted LLM */}
          <button
            onClick={() => handleAiProviderChange("local_llm")}
            className={cn(
              "flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all",
              activeCard === "local_llm"
                ? "border-primary bg-primary/10"
                : "border-panel-border bg-background hover:border-primary/40"
            )}
          >
            <div className="flex items-center gap-1.5">
              <Server className={cn("w-3.5 h-3.5", activeCard === "local_llm" ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("text-sm font-medium", activeCard === "local_llm" ? "text-primary" : "text-foreground")}>Local / Hosted LLM</span>
            </div>
            <span className="text-2xs text-muted-foreground">Ollama, LM Studio, etc.</span>
          </button>

          {/* OpenAI-Compatible (OpenRouter, Groq, Mistral, Together, Fireworks, custom) */}
          <button
            onClick={() => handleAiProviderChange(compatProvider)}
            className={cn(
              "flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all",
              activeCard === "compat"
                ? "border-primary bg-primary/10"
                : "border-panel-border bg-background hover:border-primary/40"
            )}
          >
            <div className="flex items-center gap-1.5">
              <Cloud className={cn("w-3.5 h-3.5", activeCard === "compat" ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("text-sm font-medium", activeCard === "compat" ? "text-primary" : "text-foreground")}>OpenAI-Compatible</span>
            </div>
            <span className="text-2xs text-muted-foreground">OpenRouter, Groq, Mistral…</span>
          </button>
        </div>
      </div>

      {/* Graphe Free detail */}
      {activeCard === "graphe_free" && (
        <div className="p-4 rounded-xl bg-background border border-panel-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Usage this hour</span>
            {usageData && (
              <span className="text-xs text-muted-foreground">
                {usageData.hourlyUsed} / {usageData.hourlyLimit} requests
              </span>
            )}
          </div>
          {usageData && (
            <div className="w-full bg-panel-border rounded-full h-1.5">
              <div
                className="bg-primary rounded-full h-1.5 transition-all"
                style={{ width: `${Math.min(100, (usageData.hourlyUsed / usageData.hourlyLimit) * 100)}%` }}
              />
            </div>
          )}
          {usageCountdown > 0 && usageData && usageData.hourlyUsed >= usageData.hourlyLimit && (
            <p className="text-2xs text-warning">
              Limit reached — resets in {Math.floor(usageCountdown / 60)}m {usageCountdown % 60}s
            </p>
          )}
          <p className="text-2xs text-muted-foreground leading-relaxed">
            Uses Gemini Flash Lite. Switch to a paid provider for higher limits and model choice.
          </p>
        </div>
      )}

      {/* Google AI Studio detail */}
      {activeCard === "google_ai_studio" && (
        <div className="p-4 rounded-xl bg-background border border-panel-border space-y-3">
          {savedKeys["google_ai_studio"]?.hasKey ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                <span className="text-sm text-foreground">API key saved</span>
              </div>
              <button
                onClick={() => handleRemoveKey("google_ai_studio")}
                className="text-xs text-destructive/80 hover:text-destructive transition-colors"
              >
                Remove
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Google AI Studio API Key</label>
                <div className="relative">
                  <input
                    type={googleKeyVisible ? "text" : "password"}
                    value={googleKey}
                    onChange={(e) => setGoogleKey(e.target.value)}
                    placeholder="AIza..."
                    className="w-full bg-panel border border-panel-border rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setGoogleKeyVisible(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {googleKeyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Model override <span className="font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={googleModelOverride}
                  onChange={(e) => setGoogleModelOverride(e.target.value)}
                  placeholder="e.g. gemini-2.0-flash"
                  className="w-full bg-panel border border-panel-border rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <button
                onClick={handleSaveGoogleKey}
                disabled={!googleKey.trim() || googleSaving}
                className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary-hover transition-colors"
              >
                {googleSaving ? "Saving…" : "Save Key"}
              </button>
            </>
          )}
        </div>
      )}

      {/* BYOK — OpenAI / Anthropic detail */}
      {activeCard === "byok" && (
        <div className="p-4 rounded-xl bg-background border border-panel-border space-y-3">
          {/* Sub-provider toggle */}
          <div className="flex gap-2">
            {(["openai", "anthropic"] as ByokSubProvider[]).map((sp) => (
              <button
                key={sp}
                onClick={() => {
                  setByokSubProvider(sp);
                  handleAiProviderChange(sp);
                }}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all",
                  byokSubProvider === sp
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-panel-border text-muted-foreground hover:text-foreground"
                )}
              >
                {sp === "openai" ? "OpenAI" : "Anthropic"}
              </button>
            ))}
          </div>

          {/* OpenAI */}
          {byokSubProvider === "openai" && (
            savedKeys["openai"]?.hasKey ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                  <span className="text-sm text-foreground">OpenAI key saved</span>
                </div>
                <button onClick={() => handleRemoveKey("openai")} className="text-xs text-destructive/80 hover:text-destructive transition-colors">Remove</button>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">OpenAI API Key</label>
                <div className="relative">
                  <input
                    type={byokOpenaiKeyVisible ? "text" : "password"}
                    value={byokOpenaiKey}
                    onChange={(e) => setByokOpenaiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-panel border border-panel-border rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none pr-9"
                  />
                  <button type="button" onClick={() => setByokOpenaiKeyVisible(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {byokOpenaiKeyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )
          )}

          {/* Anthropic */}
          {byokSubProvider === "anthropic" && (
            savedKeys["anthropic"]?.hasKey ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                  <span className="text-sm text-foreground">Anthropic key saved</span>
                </div>
                <button onClick={() => handleRemoveKey("anthropic")} className="text-xs text-destructive/80 hover:text-destructive transition-colors">Remove</button>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Anthropic API Key</label>
                <div className="relative">
                  <input
                    type={byokAnthropicKeyVisible ? "text" : "password"}
                    value={byokAnthropicKey}
                    onChange={(e) => setByokAnthropicKey(e.target.value)}
                    placeholder="sk-ant-..."
                    className="w-full bg-panel border border-panel-border rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none pr-9"
                  />
                  <button type="button" onClick={() => setByokAnthropicKeyVisible(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {byokAnthropicKeyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )
          )}

          {/* Model (required for BYOK) */}
          {(() => {
            const sub = byokSubProvider;
            const models = sub === "openai" ? byokOpenaiModels : byokAnthropicModels;
            const modelsLoading = sub === "openai" ? byokOpenaiModelsLoading : byokAnthropicModelsLoading;
            const model = sub === "openai" ? byokOpenaiModel : byokAnthropicModel;
            const setModel = sub === "openai" ? setByokOpenaiModel : setByokAnthropicModel;
            const placeholder = sub === "openai" ? "e.g. gpt-4o" : "e.g. claude-opus-4-6";
            const keySaved = !!(sub === "openai" ? savedKeys["openai"]?.hasKey : savedKeys["anthropic"]?.hasKey);
            const savedModel = (sub === "openai" ? savedKeys["openai"]?.modelOverride : savedKeys["anthropic"]?.modelOverride) ?? "";
            const modelChanged = keySaved && model !== savedModel;
            return (
              <>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Model <span className="font-normal">(required)</span>
                  </label>
                  {modelsLoading ? (
                    <div className="w-full bg-panel border border-panel-border rounded-lg px-3 py-2 text-sm text-muted-foreground">
                      Loading models…
                    </div>
                  ) : models.length > 0 ? (
                    <Select value={model} onValueChange={setModel}>
                      <SelectTrigger className="w-full bg-panel border-panel-border rounded-lg">
                        <SelectValue placeholder="Select a model…" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-panel-border">
                        {models.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder={placeholder}
                      className="w-full bg-panel border border-panel-border rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    />
                  )}
                </div>

                {/* Update model — only when key is saved and model changed */}
                {keySaved && modelChanged && (
                  <button
                    onClick={() => handleUpdateByokModel(sub)}
                    disabled={!model.trim() || byokModelSaving}
                    className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary-hover transition-colors"
                  >
                    {byokModelSaving ? "Saving…" : "Update Model"}
                  </button>
                )}
              </>
            );
          })()}

          {/* Save button — only show when key not yet saved */}
          {!(byokSubProvider === "openai" ? savedKeys["openai"]?.hasKey : savedKeys["anthropic"]?.hasKey) && (
            <button
              onClick={() => handleSaveByokKey(byokSubProvider)}
              disabled={!(byokSubProvider === "openai" ? byokOpenaiKey.trim() : byokAnthropicKey.trim()) || (byokSubProvider === "openai" ? byokOpenaiSaving : byokAnthropicSaving)}
              className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary-hover transition-colors"
            >
              {(byokSubProvider === "openai" ? byokOpenaiSaving : byokAnthropicSaving) ? "Saving…" : "Save Key"}
            </button>
          )}
        </div>
      )}

      {/* Local / Hosted LLM detail */}
      {/* OpenAI-Compatible detail (9.2) */}
      {activeCard === "compat" && (
        <div className="p-4 rounded-xl bg-background border border-panel-border space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Provider</label>
            <select
              value={compatProvider}
              onChange={(e) => { const p = e.target.value as CompatProvider; setCompatProvider(p); handleAiProviderChange(p); }}
              className="w-full bg-panel border border-panel-border rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              {COMPAT_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>{p.label} — {p.hint}</option>
              ))}
            </select>
          </div>

          {savedKeys[compatProvider]?.hasKey ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                <span className="text-sm text-foreground truncate">
                  {COMPAT_PROVIDERS.find(p => p.id === compatProvider)?.label} key saved
                  {savedKeys[compatProvider]?.modelOverride ? ` · ${savedKeys[compatProvider]?.modelOverride}` : ""}
                </span>
              </div>
              <button onClick={() => handleRemoveKey(compatProvider)} className="text-xs text-destructive/80 hover:text-destructive transition-colors shrink-0 ml-3">Remove</button>
            </div>
          ) : (
            <>
              {compatProvider === "custom_openai" && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Base URL</label>
                  <input
                    type="text"
                    value={compatEndpoint}
                    onChange={(e) => setCompatEndpoint(e.target.value)}
                    placeholder="https://your-host/v1"
                    className="w-full bg-panel border border-panel-border rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">API Key</label>
                <div className="relative">
                  <input
                    type={compatKeyVisible ? "text" : "password"}
                    value={compatKey}
                    onChange={(e) => setCompatKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-panel border border-panel-border rounded-lg px-3 py-2 pr-9 text-sm focus:border-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setCompatKeyVisible(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={compatKeyVisible ? "Hide API key" : "Show API key"}
                  >
                    {compatKeyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Model {compatModelsLoading && <span className="font-normal">(loading…)</span>}
                </label>
                <input
                  type="text"
                  list="compat-models"
                  value={compatModel}
                  onChange={(e) => setCompatModel(e.target.value)}
                  placeholder={compatModels.length ? "Pick or type a model" : "e.g. meta-llama/llama-3.1-8b-instruct"}
                  className="w-full bg-panel border border-panel-border rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
                <datalist id="compat-models">
                  {compatModels.map((m) => <option key={m} value={m} />)}
                </datalist>
              </div>
              <button
                onClick={handleSaveCompatKey}
                disabled={!compatKey.trim() || !compatModel.trim() || (compatProvider === "custom_openai" && !compatEndpoint.trim()) || compatSaving}
                className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary-hover transition-colors"
              >
                {compatSaving ? "Saving…" : "Save Key"}
              </button>
              <p className="text-2xs text-muted-foreground">A model is required — enter your key to auto-discover available models.</p>
            </>
          )}
        </div>
      )}

      {activeCard === "local_llm" && (
        <div className="p-4 rounded-xl bg-background border border-panel-border space-y-3">
          {savedKeys["local_llm"]?.endpointUrl ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                <span className="text-sm text-foreground truncate">{savedKeys["local_llm"].endpointUrl}</span>
                {savedKeys["local_llm"].hasKey && (
                  <span className="text-2xs text-success font-medium px-1.5 py-0.5 rounded bg-success/10 shrink-0">key set</span>
                )}
              </div>
              <button onClick={() => handleRemoveKey("local_llm")} className="text-xs text-destructive/80 hover:text-destructive transition-colors shrink-0 ml-3">Remove</button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Endpoint URL</label>
                <input
                  type="text"
                  value={localEndpoint}
                  onChange={(e) => setLocalEndpoint(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="w-full bg-panel border border-panel-border rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center justify-between">
                  <span>Model name <span className="font-normal">(optional)</span></span>
                  <button
                    type="button"
                    onClick={() => void discoverLocalModels(localEndpoint, localApiKey)}
                    disabled={!localEndpoint.trim() || localModelsLoading}
                    className="text-2xs text-primary hover:underline disabled:opacity-50 disabled:no-underline disabled:text-muted-foreground"
                  >
                    {localModelsLoading ? "Discovering…" : "Discover"}
                  </button>
                </label>
                <input
                  type="text"
                  list="local-models"
                  value={localModel}
                  onChange={(e) => setLocalModel(e.target.value)}
                  placeholder="e.g. llama3.2"
                  className="w-full bg-panel border border-panel-border rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
                <datalist id="local-models">
                  {localModels.map((m) => <option key={m} value={m} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  API key <span className="font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <input
                    type={localApiKeyVisible ? "text" : "password"}
                    value={localApiKey}
                    onChange={(e) => setLocalApiKey(e.target.value)}
                    placeholder="Only if your server requires auth"
                    className="w-full bg-panel border border-panel-border rounded-lg px-3 py-2 pr-9 text-sm focus:border-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setLocalApiKeyVisible(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={localApiKeyVisible ? "Hide API key" : "Show API key"}
                  >
                    {localApiKeyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <button
                onClick={handleSaveLocalLlm}
                disabled={!localEndpoint.trim() || localSaving}
                className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary-hover transition-colors"
              >
                {localSaving ? "Saving…" : "Save Endpoint"}
              </button>
            </>
          )}
          <p className="text-2xs text-muted-foreground">
            Endpoint must expose an OpenAI-compatible <code className="text-2xs bg-panel px-1 py-0.5 rounded">/v1/chat/completions</code> API.
          </p>
        </div>
      )}

      {/* No provider selected yet */}
      {!aiProvider && (
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          Select a provider above to get started.
        </div>
      )}
    </section>
  );
}
