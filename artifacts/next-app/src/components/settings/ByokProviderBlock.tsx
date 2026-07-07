import { useState, useEffect, useCallback, useRef } from "react";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import { stripTrailingSlashes } from "@lib/ai-providers";
import { authenticatedFetch } from "@workspace/api-client-react/custom-fetch";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "../ui/select";

// One combined "bring your own key" block covering every fixed-host provider that
// discovers models server-side, plus the client-side custom OpenAI-compatible host.
const BYOK_PROVIDERS = [
  { id: "google_ai_studio", label: "Google AI Studio", placeholder: "AIza…" },
  { id: "openai", label: "OpenAI", placeholder: "sk-…" },
  { id: "anthropic", label: "Anthropic", placeholder: "sk-ant-…" },
  { id: "openrouter", label: "OpenRouter", placeholder: "sk-or-…" },
  { id: "groq", label: "Groq", placeholder: "gsk_…" },
  { id: "mistral", label: "Mistral", placeholder: "…" },
  { id: "together", label: "Together AI", placeholder: "…" },
  { id: "fireworks", label: "Fireworks", placeholder: "fw_…" },
  { id: "custom_openai", label: "Custom (OpenAI-compatible)", placeholder: "…", needsEndpoint: true },
] as const;

const BYOK_IDS = BYOK_PROVIDERS.map((p) => p.id) as readonly string[];

export type KeyInfo = {
  hasKey: boolean;
  endpointUrl: string | null;
  modelOverride: string | null;
  fastModelOverride: string | null;
};

type ByokProviderBlockProps = {
  isDemo: boolean;
  savedKeys: Record<string, KeyInfo>;
  setSavedKeys: React.Dispatch<React.SetStateAction<Record<string, KeyInfo>>>;
  activeProvider: string | null;
  onActivate: (provider: string) => Promise<void> | void;
};

const parseModelIds = (data: { data?: Array<{ id?: string }> }): string[] =>
  (data.data ?? [])
    .map((m) => m.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0)
    .sort();

export function ByokProviderBlock({
  isDemo,
  savedKeys,
  setSavedKeys,
  activeProvider,
  onActivate,
}: ByokProviderBlockProps) {
  const initialProvider =
    activeProvider && BYOK_IDS.includes(activeProvider) ? activeProvider : "google_ai_studio";

  const [provider, setProvider] = useState<string>(initialProvider);
  const [apiKey, setApiKey] = useState("");
  const [keyVisible, setKeyVisible] = useState(false);
  const [endpoint, setEndpoint] = useState("");
  const [model, setModel] = useState("");
  const [fastModel, setFastModel] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isCustom = provider === "custom_openai";
  const meta = BYOK_PROVIDERS.find((p) => p.id === provider)!;
  const info = savedKeys[provider];

  // ── Model discovery ──────────────────────────────────────────────
  // Fixed-host providers discover server-side (key stays server-only, no CORS
  // wall, and no user URL touches our server). custom_openai discovers
  // client-side against the user's own host.
  const fetchModels = useCallback(async (prov: string, key?: string, endpointUrl?: string) => {
    setModelsLoading(true);
    try {
      if (prov === "custom_openai") {
        if (!endpointUrl) { setModels([]); return; }
        const res = await fetch(`${stripTrailingSlashes(endpointUrl)}/models`, {
          headers: key ? { Authorization: `Bearer ${key}` } : {},
        });
        if (!res.ok) { setModels([]); return; }
        setModels(parseModelIds(await res.json()));
        return;
      }
      const res = await authenticatedFetch("/api/ai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: prov, ...(key ? { apiKey: key } : {}) }),
      });
      if (!res.ok) { setModels([]); return; }
      const data = await res.json() as { models?: string[] };
      setModels(data.models ?? []);
    } catch {
      setModels([]);
    } finally {
      setModelsLoading(false);
    }
  }, []);

  // ── On provider change / mount: sync fields + discover for saved keys ──
  // Ref so the effect can read savedKeys without re-running every time the map
  // changes (which would re-fire discovery / activation on unrelated updates).
  const savedKeysRef = useRef(savedKeys);
  savedKeysRef.current = savedKeys;

  useEffect(() => {
    const saved = savedKeysRef.current[provider];
    setModel(saved?.modelOverride ?? "");
    setFastModel(saved?.fastModelOverride ?? "");
    setEndpoint(saved?.endpointUrl ?? "");
    setApiKey("");
    setModels([]);

    const configured = provider === "custom_openai"
      ? Boolean(saved?.hasKey || saved?.endpointUrl)
      : Boolean(saved?.hasKey);

    if (saved?.hasKey) {
      // No apiKey arg — server decrypts the stored key.
      void fetchModels(provider, undefined, saved.endpointUrl ?? undefined);
    }
    if (configured) void onActivate(provider);
  }, [provider, fetchModels, onActivate]);

  // ── Debounce: discover models as the user types the key ──────────
  useEffect(() => {
    const trimmed = apiKey.trim();
    if (!trimmed || trimmed.length < 10 || (isCustom && !endpoint.trim())) {
      return;
    }
    const timer = setTimeout(() => {
      void fetchModels(provider, trimmed, isCustom ? endpoint.trim() : undefined);
    }, 600);
    return () => clearTimeout(timer);
  }, [apiKey, endpoint, provider, isCustom, fetchModels]);

  // ── Remove saved key ─────────────────────────────────────────────
  const handleRemove = async () => {
    if (isDemo) return;
    await authenticatedFetch("/api/ai/keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    }).catch(() => {});
    setSavedKeys((prev) => {
      const updated = { ...prev };
      delete updated[provider];
      return updated;
    });
    setModels([]);
    setModel("");
    setFastModel("");
  };

  // ── Save (new key) or Save models (existing key) ─────────────────
  const handleSave = async () => {
    if (isDemo) return;
    const trimmedKey = apiKey.trim();
    setSaving(true);
    try {
      if (trimmedKey) {
        await authenticatedFetch("/api/ai/keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider,
            apiKey: trimmedKey,
            modelOverride: model || null,
            fastModelOverride: fastModel || null,
            ...(isCustom ? { endpointUrl: endpoint.trim() } : {}),
          }),
        });
        setSavedKeys((prev) => ({
          ...prev,
          [provider]: {
            hasKey: true,
            endpointUrl: isCustom ? endpoint.trim() : null,
            modelOverride: model || null,
            fastModelOverride: fastModel || null,
          },
        }));
        setApiKey("");
        await onActivate(provider);
      } else if (info?.hasKey) {
        await authenticatedFetch("/api/ai/keys", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider,
            modelOverride: model || null,
            fastModelOverride: fastModel || null,
          }),
        });
        setSavedKeys((prev) => ({
          ...prev,
          [provider]: {
            ...prev[provider],
            modelOverride: model || null,
            fastModelOverride: fastModel || null,
          },
        }));
        await onActivate(provider);
      }
    } finally {
      setSaving(false);
    }
  };

  const hasNewKey = apiKey.trim().length > 0;
  const keySaved = Boolean(info?.hasKey);
  // Options for the model dropdown: discovered models plus the saved model if it
  // isn't in the discovered list (so it still displays as the current value).
  const modelOptions = model && !models.includes(model) ? [model, ...models] : models;
  const fastModelOptions = fastModel && !models.includes(fastModel) ? [fastModel, ...models] : models;

  const saveDisabled =
    saving ||
    (isCustom && !endpoint.trim()) ||
    (!hasNewKey && !keySaved);

  return (
    <div className="p-4 rounded-xl bg-background border border-panel-border space-y-3">
      {/* Provider dropdown */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Provider</label>
        <Select value={provider} onValueChange={setProvider}>
          <SelectTrigger className="w-full bg-panel border-panel-border rounded-lg">
            <SelectValue placeholder="Select a provider…" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-panel-border">
            {BYOK_PROVIDERS.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Endpoint (custom only) */}
      {isCustom && (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Base URL</label>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="https://your-host/v1"
            className="w-full bg-panel border border-panel-border rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
      )}

      {/* API key row */}
      {keySaved ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
            <span className="text-sm text-foreground truncate">Key saved</span>
          </div>
          <button
            onClick={handleRemove}
            className="text-xs text-destructive/80 hover:text-destructive transition-colors shrink-0 ml-3"
          >
            Remove
          </button>
        </div>
      ) : (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">API Key</label>
          <div className="relative">
            <input
              type={keyVisible ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={meta.placeholder}
              className="w-full bg-panel border border-panel-border rounded-lg px-3 py-2 pr-9 text-sm focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setKeyVisible((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={keyVisible ? "Hide API key" : "Show API key"}
            >
              {keyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}

      {/* Model dropdown */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Model</label>
        <Select value={model} onValueChange={setModel}>
          <SelectTrigger className="w-full bg-panel border-panel-border rounded-lg">
            <SelectValue placeholder="Select a model…" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-panel-border">
            {modelOptions.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {modelsLoading && <p className="text-2xs text-muted-foreground mt-1">Discovering…</p>}
        {!modelsLoading && models.length === 0 && !keySaved && (
          <p className="text-2xs text-muted-foreground mt-1">Enter your key to load models</p>
        )}
      </div>

      {/* Fast model dropdown (optional) */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          Fast model — used for quick tasks (proofread, summarize, extract)
        </label>
        <Select value={fastModel || "__same__"} onValueChange={(v) => setFastModel(v === "__same__" ? "" : v)}>
          <SelectTrigger className="w-full bg-panel border-panel-border rounded-lg">
            <SelectValue placeholder="Same as main model" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-panel-border">
            <SelectItem value="__same__">Same as main model</SelectItem>
            {fastModelOptions.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saveDisabled}
        className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary-hover transition-colors"
      >
        {saving ? "Saving…" : hasNewKey ? "Save" : "Save models"}
      </button>
    </div>
  );
}
