import { useState, useEffect, useCallback } from "react";
import { Key, Server, AlertCircle, CheckCircle2, Zap, Eye, EyeOff, FlaskConical } from "lucide-react";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";
import { stripTrailingSlashes } from "@lib/ai-providers";
import { authenticatedFetch } from "@workspace/api-client-react/custom-fetch";
import { ClaudeProxyDevPanel } from "./ClaudeProxyDevPanel";
import { isClaudeProxyEnabled } from "@/hooks/use-claude-proxy";
import { ByokProviderBlock } from "./ByokProviderBlock";

// Providers that live inside the "bring your own key" combined block.
const BYOK_IDS = [
  "google_ai_studio", "openai", "anthropic",
  "openrouter", "groq", "mistral", "together", "fireworks", "custom_openai",
] as const;

type AiProvider = "graphe_free" | "local_llm" | (typeof BYOK_IDS)[number];
type SelectedCard = "graphe_free" | "byok" | "local_llm" | "proxy";
type KeyInfo = {
  hasKey: boolean;
  endpointUrl: string | null;
  modelOverride: string | null;
  fastModelOverride: string | null;
};

type UsageData = { hourlyUsed: number; hourlyLimit: number; resetInMs: number };

export function AiSettingsTab({ isDemo }: { isDemo: boolean }) {
  const isSettingsOpen = useAppStore(s => s.isSettingsOpen);

  // ── AI Provider state ────────────────────────────────────────────
  const [aiProvider, setAiProvider] = useState<AiProvider | null>(null);
  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(null);
  const [savedKeys, setSavedKeys] = useState<Record<string, KeyInfo>>({});

  // Local / Hosted LLM
  const [localEndpoint, setLocalEndpoint] = useState("");
  const [localModel, setLocalModel] = useState("");
  const [localApiKey, setLocalApiKey] = useState("");
  const [localApiKeyVisible, setLocalApiKeyVisible] = useState(false);
  const [localSaving, setLocalSaving] = useState(false);
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [localModelsLoading, setLocalModelsLoading] = useState(false);

  // Usage (Graphe Free)
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [usageCountdown, setUsageCountdown] = useState(0);

  const proxyEnabled = isClaudeProxyEnabled();

  // ── Local model discovery ───────────────────────────────────────
  // Local endpoints are user-controlled, so we discover client-side: the browser
  // can reach the user's own host and no user URL ever touches our server.
  const parseModelIds = (data: { data?: Array<{ id?: string }> }): string[] =>
    (data.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === "string" && id.length > 0).sort();

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
        if (!p) setSelectedCard(null);
        else if (p === "graphe_free" || p === "local_llm") setSelectedCard(p);
        else if ((BYOK_IDS as readonly string[]).includes(p)) setSelectedCard("byok");
        else setSelectedCard(null);
      })
      .catch(() => {});

    authenticatedFetch("/api/ai/keys")
      .then(r => r.json())
      .then((rows: Array<{ provider: string; hasKey: boolean; endpointUrl: string | null; modelOverride: string | null; fastModelOverride: string | null }>) => {
        const map: Record<string, KeyInfo> = {};
        for (const row of rows) {
          map[row.provider] = {
            hasKey: row.hasKey,
            endpointUrl: row.endpointUrl,
            modelOverride: row.modelOverride,
            fastModelOverride: row.fastModelOverride,
          };
        }
        setSavedKeys(map);
        if (map["local_llm"]?.endpointUrl) setLocalEndpoint(map["local_llm"].endpointUrl!);
        if (map["local_llm"]?.modelOverride) setLocalModel(map["local_llm"].modelOverride!);
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
  const commitActiveProvider = useCallback(async (newProvider: string) => {
    if (isDemo) return; // X-D1: no settings backend in demo
    setAiProvider(newProvider as AiProvider);
    await authenticatedFetch("/api/ai/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeAiProvider: newProvider, hasCompletedAiSetup: true }),
    }).catch(() => {});
  }, [isDemo]);

  // Click handler for the graphe_free / local_llm cards. Updates the visible
  // detail panel and only commits to the server when the provider already has a
  // working configuration — BYOK activation is delegated to ByokProviderBlock.
  const handleAiProviderChange = async (newProvider: AiProvider) => {
    const isConfigured =
      newProvider === "graphe_free" ||
      (newProvider === "local_llm" && Boolean(savedKeys["local_llm"]?.endpointUrl));

    if (isConfigured) await commitActiveProvider(newProvider);
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
          fastModelOverride: prev["local_llm"]?.fastModelOverride ?? null,
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
  };

  return (
    <section className="space-y-4">
      {/* Provider selection cards */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-2">AI Provider</label>
        <div className="grid grid-cols-2 gap-2">
          {/* Graphe Free */}
          <button
            onClick={() => { setSelectedCard("graphe_free"); void handleAiProviderChange("graphe_free"); }}
            className={cn(
              "flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all",
              selectedCard === "graphe_free"
                ? "border-primary bg-primary/10"
                : "border-panel-border bg-background hover:border-primary/40"
            )}
          >
            <div className="flex items-center gap-1.5">
              <Zap className={cn("w-3.5 h-3.5", selectedCard === "graphe_free" ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("text-sm font-medium", selectedCard === "graphe_free" ? "text-primary" : "text-foreground")}>Graphe Free</span>
            </div>
            <span className="text-2xs text-muted-foreground">Built-in, no key needed</span>
          </button>

          {/* Bring your own key */}
          <button
            onClick={() => setSelectedCard("byok")}
            className={cn(
              "flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all",
              selectedCard === "byok"
                ? "border-primary bg-primary/10"
                : "border-panel-border bg-background hover:border-primary/40"
            )}
          >
            <div className="flex items-center gap-1.5">
              <Key className={cn("w-3.5 h-3.5", selectedCard === "byok" ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("text-sm font-medium", selectedCard === "byok" ? "text-primary" : "text-foreground")}>Bring your own key</span>
            </div>
            <span className="text-2xs text-muted-foreground">Gemini, OpenAI, Anthropic, OpenRouter…</span>
          </button>

          {/* Local / Hosted LLM */}
          <button
            onClick={() => { setSelectedCard("local_llm"); void handleAiProviderChange("local_llm"); }}
            className={cn(
              "flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all",
              selectedCard === "local_llm"
                ? "border-primary bg-primary/10"
                : "border-panel-border bg-background hover:border-primary/40"
            )}
          >
            <div className="flex items-center gap-1.5">
              <Server className={cn("w-3.5 h-3.5", selectedCard === "local_llm" ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("text-sm font-medium", selectedCard === "local_llm" ? "text-primary" : "text-foreground")}>Local / Hosted LLM</span>
            </div>
            <span className="text-2xs text-muted-foreground">Ollama, LM Studio, etc.</span>
          </button>

          {/* Dev · Claude proxy (flag-gated) */}
          {proxyEnabled && (
            <button
              onClick={() => setSelectedCard("proxy")}
              className={cn(
                "flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all",
                selectedCard === "proxy"
                  ? "border-primary bg-primary/10"
                  : "border-panel-border bg-background hover:border-primary/40"
              )}
            >
              <div className="flex items-center gap-1.5">
                <FlaskConical className={cn("w-3.5 h-3.5", selectedCard === "proxy" ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("text-sm font-medium", selectedCard === "proxy" ? "text-primary" : "text-foreground")}>Dev · Claude proxy</span>
              </div>
              <span className="text-2xs text-muted-foreground">Local dev routing override</span>
            </button>
          )}
        </div>
      </div>

      {/* Graphe Free detail */}
      {selectedCard === "graphe_free" && (
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

      {/* Bring your own key detail */}
      {selectedCard === "byok" && (
        <ByokProviderBlock
          isDemo={isDemo}
          savedKeys={savedKeys}
          setSavedKeys={setSavedKeys}
          activeProvider={aiProvider}
          onActivate={commitActiveProvider}
        />
      )}

      {/* Local / Hosted LLM detail */}
      {selectedCard === "local_llm" && (
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

      {/* Dev · Claude proxy detail */}
      {selectedCard === "proxy" && <ClaudeProxyDevPanel />}

      {/* No provider selected yet */}
      {!selectedCard && (
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          Select a provider above to get started.
        </div>
      )}
    </section>
  );
}
