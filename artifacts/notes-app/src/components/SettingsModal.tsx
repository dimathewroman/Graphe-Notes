import { useState, useEffect, useCallback } from "react";
import {
  X, Key, Cloud, Download, Server, Palette, Sun, Moon, Monitor,
  RefreshCw, AlertCircle, CheckCircle2, ChevronDown
} from "lucide-react";
import { useAppStore } from "@/store";
import { IconButton } from "./ui/IconButton";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const ACCENT_PRESETS = [
  { name: "Blue",    value: "217 91% 60%",  hex: "#3b82f6" },
  { name: "Indigo",  value: "239 84% 67%",  hex: "#6366f1" },
  { name: "Purple",  value: "270 76% 65%",  hex: "#a855f7" },
  { name: "Rose",    value: "350 89% 62%",  hex: "#f43f5e" },
  { name: "Amber",   value: "38 92% 50%",   hex: "#f59e0b" },
  { name: "Emerald", value: "160 84% 39%",  hex: "#10b981" },
  { name: "Cyan",    value: "189 94% 43%",  hex: "#06b6d4" },
  { name: "Slate",   value: "215 25% 57%",  hex: "#64748b" },
];

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCachedModels(provider: string): { models: string[]; cachedAt: number } | null {
  try {
    const raw = localStorage.getItem(`ai_models_${provider}`);
    const ts = localStorage.getItem(`ai_models_${provider}_at`);
    if (!raw || !ts) return null;
    return { models: JSON.parse(raw) as string[], cachedAt: Number(ts) };
  } catch {
    return null;
  }
}

function setCachedModels(provider: string, models: string[]) {
  localStorage.setItem(`ai_models_${provider}`, JSON.stringify(models));
  localStorage.setItem(`ai_models_${provider}_at`, String(Date.now()));
}

type ThemeMode = "dark" | "light";
type FetchStatus = "idle" | "loading" | "live" | "fallback" | "error";

function applyTheme(mode: ThemeMode, accent: string) {
  if (mode === "light") {
    document.documentElement.classList.add("light");
  } else {
    document.documentElement.classList.remove("light");
  }
  if (accent) {
    document.documentElement.style.setProperty("--primary", accent);
    document.documentElement.style.setProperty("--ring", accent);
  } else {
    document.documentElement.style.removeProperty("--primary");
    document.documentElement.style.removeProperty("--ring");
  }
}

export function SettingsModal() {
  const { isSettingsOpen, setSettingsOpen } = useAppStore();

  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o");
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [accentColor, setAccentColor] = useState(ACCENT_PRESETS[0].value);
  const [activeTab, setActiveTab] = useState<"appearance" | "ai" | "data">("appearance");

  // Model list state
  const [models, setModels] = useState<string[]>([]);
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>("idle");
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);

  // ── Load saved prefs on open ────────────────────────────────────
  useEffect(() => {
    if (isSettingsOpen) {
      const savedProvider = localStorage.getItem("ai_provider") || "openai";
      const savedKey = localStorage.getItem("ai_api_key") || "";
      const savedModel = localStorage.getItem("ai_model") || "gpt-4o";
      setProvider(savedProvider);
      setApiKey(savedKey);
      setModel(savedModel);
      setThemeMode((localStorage.getItem("theme_mode") as ThemeMode) || "dark");
      setAccentColor(localStorage.getItem("theme_accent") || ACCENT_PRESETS[0].value);

      // Pre-populate from cache immediately
      const cached = getCachedModels(savedProvider);
      if (cached) {
        setModels(cached.models);
        setLastFetchedAt(cached.cachedAt);
        const stale = Date.now() - cached.cachedAt > CACHE_TTL_MS;
        setFetchStatus(stale ? "idle" : "live");
      } else {
        setModels([]);
        setFetchStatus("idle");
      }
    }
  }, [isSettingsOpen]);

  // ── Fetch models from API proxy ─────────────────────────────────
  const fetchModels = useCallback(
    async (prov: string, key: string, force = false) => {
      if (!isSettingsOpen) return;

      // Check cache first (unless forced)
      if (!force) {
        const cached = getCachedModels(prov);
        if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
          setModels(cached.models);
          setLastFetchedAt(cached.cachedAt);
          setFetchStatus("live");
          return;
        }
      }

      setFetchStatus("loading");
      try {
        const params = new URLSearchParams({ provider: prov });
        if (key.trim()) params.set("apiKey", key.trim());
        const res = await fetch(`/api/models?${params}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const data = (await res.json()) as { models: string[]; source: "live" | "fallback" };
        setModels(data.models);
        setCachedModels(prov, data.models);
        setLastFetchedAt(Date.now());
        setFetchStatus(data.source === "live" ? "live" : "fallback");
      } catch {
        setFetchStatus("error");
      }
    },
    [isSettingsOpen]
  );

  // Auto-fetch when AI tab is active and models are stale/empty
  useEffect(() => {
    if (activeTab === "ai" && isSettingsOpen) {
      fetchModels(provider, apiKey);
    }
  }, [activeTab, isSettingsOpen, provider]); // intentionally excludes apiKey to avoid re-fetching on every keystroke

  // When provider changes, reset model to first of new list
  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    const cached = getCachedModels(newProvider);
    if (cached) {
      setModels(cached.models);
      setLastFetchedAt(cached.cachedAt);
      setFetchStatus(Date.now() - cached.cachedAt < CACHE_TTL_MS ? "live" : "idle");
      setModel(cached.models[0] || "");
    } else {
      setModels([]);
      setFetchStatus("idle");
      setModel("");
    }
    // Fetch fresh for new provider
    fetchModels(newProvider, apiKey);
  };

  // When API key is saved (on blur), refetch with the new key
  const handleApiKeyBlur = () => {
    if (apiKey.trim()) fetchModels(provider, apiKey, true);
  };

  const handleSave = () => {
    localStorage.setItem("ai_provider", provider);
    localStorage.setItem("ai_api_key", apiKey);
    localStorage.setItem("ai_model", model);
    localStorage.setItem("theme_mode", themeMode);
    localStorage.setItem("theme_accent", accentColor);
    applyTheme(themeMode, accentColor);
    setSettingsOpen(false);
  };

  // ── Theme helpers ───────────────────────────────────────────────
  const handleAccentChange = (value: string) => {
    setAccentColor(value);
    applyTheme(themeMode, value);
  };

  const handleModeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    applyTheme(mode, accentColor);
  };

  const tabs = [
    { id: "appearance" as const, label: "Appearance", icon: Palette },
    { id: "ai" as const, label: "AI", icon: Key },
    { id: "data" as const, label: "Data", icon: Cloud },
  ];

  const statusInfo = {
    idle:     { icon: null,            text: "" },
    loading:  { icon: <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground" />, text: "Fetching models…" },
    live:     { icon: <CheckCircle2 className="w-3 h-3 text-emerald-500" />,              text: lastFetchedAt ? `Updated ${new Date(lastFetchedAt).toLocaleDateString()}` : "" },
    fallback: { icon: <AlertCircle className="w-3 h-3 text-amber-500" />,                text: "Showing defaults — add API key to see all models" },
    error:    { icon: <AlertCircle className="w-3 h-3 text-destructive" />,               text: "Could not fetch models" },
  }[fetchStatus];

  return (
    <AnimatePresence>
      {isSettingsOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSettingsOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-panel border border-panel-border rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-panel-border bg-background/50">
              <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
              <IconButton onClick={() => setSettingsOpen(false)}>
                <X className="w-5 h-5" />
              </IconButton>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-panel-border bg-background/30 px-4">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors",
                    activeTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">

              {/* ── APPEARANCE TAB ─────────────────────────── */}
              {activeTab === "appearance" && (
                <>
                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Color Mode</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "dark" as ThemeMode, label: "Dark", icon: Moon },
                        { id: "light" as ThemeMode, label: "Light", icon: Sun },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => handleModeChange(opt.id)}
                          className={cn(
                            "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all text-sm font-medium",
                            themeMode === opt.id
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-panel-border bg-background hover:border-primary/40 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <opt.icon className="w-5 h-5" />
                          {opt.label}
                        </button>
                      ))}
                      <button
                        disabled
                        className="flex flex-col items-center gap-2 p-4 rounded-xl border border-panel-border bg-background text-muted-foreground opacity-40 cursor-not-allowed text-sm"
                      >
                        <Monitor className="w-5 h-5" />
                        System
                      </button>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Accent Color</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {ACCENT_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          onClick={() => handleAccentChange(preset.value)}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-xs font-medium",
                            accentColor === preset.value
                              ? "border-2 bg-background text-foreground"
                              : "border-panel-border bg-background text-muted-foreground hover:text-foreground hover:border-panel-hover"
                          )}
                          style={accentColor === preset.value ? { borderColor: preset.hex } : {}}
                        >
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: preset.hex }} />
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preview</h3>
                    <div className="p-4 rounded-xl bg-background border border-panel-border space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <span className="text-sm font-medium text-foreground">Sample Note</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">This is how your notes will look with the selected theme.</p>
                      <div className="flex gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary border border-primary/20">#tag</span>
                        <button className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium">Button</button>
                      </div>
                    </div>
                  </section>
                </>
              )}

              {/* ── AI TAB ─────────────────────────────────── */}
              {activeTab === "ai" && (
                <section className="space-y-4">
                  {/* Provider */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Provider</label>
                    <select
                      value={provider}
                      onChange={(e) => handleProviderChange(e.target.value)}
                      className="w-full bg-background border border-panel-border rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none appearance-none cursor-pointer"
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="google">Google Gemini</option>
                    </select>
                  </div>

                  {/* API Key */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">API Key</label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      onBlur={handleApiKeyBlur}
                      placeholder={provider === "openai" ? "sk-..." : provider === "anthropic" ? "sk-ant-..." : "AIza..."}
                      className="w-full bg-background border border-panel-border rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Enter your key and click elsewhere to load your available models.
                    </p>
                  </div>

                  {/* Model dropdown */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-muted-foreground">Model</label>
                      <button
                        onClick={() => fetchModels(provider, apiKey, true)}
                        disabled={fetchStatus === "loading"}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                        title="Refresh model list"
                      >
                        <RefreshCw className={cn("w-2.5 h-2.5", fetchStatus === "loading" && "animate-spin")} />
                        Refresh
                      </button>
                    </div>

                    {/* Status badge */}
                    {statusInfo.text && (
                      <div className="flex items-center gap-1.5 mb-1.5 text-[11px] text-muted-foreground">
                        {statusInfo.icon}
                        {statusInfo.text}
                      </div>
                    )}

                    <div className="relative">
                      {models.length > 0 ? (
                        <>
                          <select
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            className="w-full bg-background border border-panel-border rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none appearance-none cursor-pointer pr-8"
                          >
                            {models.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                        </>
                      ) : (
                        <div className="w-full bg-background border border-panel-border rounded-lg px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                          {fetchStatus === "loading" ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                              Loading models…
                            </>
                          ) : (
                            "No models found — check your API key"
                          )}
                        </div>
                      )}
                    </div>

                    {/* Custom model override */}
                    <details className="mt-2">
                      <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
                        Use a custom model ID instead
                      </summary>
                      <input
                        type="text"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        placeholder="e.g. gpt-4o-2024-11-20"
                        className="mt-1.5 w-full bg-background border border-panel-border rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      />
                    </details>
                  </div>
                </section>
              )}

              {/* ── DATA TAB ───────────────────────────────── */}
              {activeTab === "data" && (
                <section className="space-y-4">
                  <div className="p-4 rounded-xl bg-background border border-panel-border flex items-start gap-4">
                    <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg shrink-0">
                      <Server className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-1">Backend Database Sync Active</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Your notes are automatically saved to your private server database in real-time. Access them from any device securely.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button disabled className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-panel border border-panel-border text-muted-foreground text-sm opacity-50 cursor-not-allowed">
                      <Cloud className="w-4 h-4" />
                      Google Drive (Soon)
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-panel hover:bg-panel-hover border border-panel-border text-foreground transition-colors text-sm">
                      <Download className="w-4 h-4" />
                      Export All JSON
                    </button>
                  </div>
                </section>
              )}

            </div>

            <div className="p-4 border-t border-panel-border bg-background/50 flex justify-end">
              <button
                onClick={handleSave}
                className="px-6 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl text-sm font-medium transition-colors shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95"
              >
                Save Settings
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
