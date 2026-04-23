import { useState, useEffect, useCallback } from "react";
import {
  X, Key, Cloud, Download, Server, Palette, Sun, Moon, Monitor,
  AlertCircle, CheckCircle2, Shield, ShieldCheck, KeyRound, LogOut, Zap, Eye, EyeOff,
  Wind, Minus,
} from "lucide-react";
import { NotificationCadenceEditor } from "./NotificationCadenceEditor";
import { useAppStore } from "@/store";
import type { MotionLevel } from "@/store";
import posthog from "posthog-js";
import { useAuth } from "@/hooks/use-auth";
import { IconButton } from "./ui/IconButton";
import { motion, AnimatePresence } from "framer-motion";
import { cn, sha256 } from "@/lib/utils";
import { useBreakpoint } from "@/hooks/use-mobile";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { PinPad } from "./PinPad";
import { authenticatedFetch } from "@workspace/api-client-react/custom-fetch";

const ACCENT_PRESETS = [
  { name: "Periwinkle", value: "216 78% 63%",  hex: "#5B93E8" },
  { name: "Indigo",  value: "239 84% 67%",  hex: "#6366f1" },
  { name: "Purple",  value: "270 76% 65%",  hex: "#a855f7" },
  { name: "Rose",    value: "350 89% 62%",  hex: "#f43f5e" },
  { name: "Amber",   value: "38 92% 50%",   hex: "#f59e0b" },
  { name: "Emerald", value: "160 84% 39%",  hex: "#10b981" },
  { name: "Cyan",    value: "189 94% 43%",  hex: "#06b6d4" },
  { name: "Slate",   value: "215 25% 57%",  hex: "#64748b" },
];

type ThemeMode = "dark" | "light";
type AiProvider = "graphe_free" | "google_ai_studio" | "openai" | "anthropic" | "local_llm";
type ByokSubProvider = "openai" | "anthropic";
type KeyInfo = { hasKey: boolean; endpointUrl: string | null; modelOverride: string | null };
type UsageData = { hourlyUsed: number; hourlyLimit: number; resetInMs: number };

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
  const { isSettingsOpen, setSettingsOpen, settingsInitialTab, motionLevel, setMotionLevel } = useAppStore();
  const { user, logout } = useAuth();
  const bp = useBreakpoint();
  const isMobile = bp === "mobile";

  const handleMotionChange = (level: MotionLevel) => {
    setMotionLevel(level);
    localStorage.setItem("motion_level", level);
    try {
      posthog.capture("motion_level_changed", { level, timestamp: new Date().toISOString() });
    } catch { /* PostHog may not be ready */ }
  };

  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [accentColor, setAccentColor] = useState(ACCENT_PRESETS[0].value);
  const [activeTab, setActiveTab] = useState<"appearance" | "ai" | "data" | "security" | "quickbits" | "account">("appearance");
  const [mobileSubPage, setMobileSubPage] = useState<typeof activeTab | null>(null);

  // Quick Bits settings state
  const [qbExpirationDays, setQbExpirationDays] = useState(3);
  const [qbNotificationHours, setQbNotificationHours] = useState<number[]>([24]);
  const [qbSaving, setQbSaving] = useState(false);

  // Security / vault state
  const [vaultConfigured, setVaultConfigured] = useState(false);
  const [securityMode, setSecurityMode] = useState<"idle" | "setup" | "reset">("idle");
  const [securityStep, setSecurityStep] = useState<"current" | "new" | "confirm">("current");
  const [securityFirstPin, setSecurityFirstPin] = useState("");
  const [securityCurrentPin, setSecurityCurrentPin] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [securityLoading, setSecurityLoading] = useState(false);

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

  // Usage (Graphe Free)
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [usageCountdown, setUsageCountdown] = useState(0);

  // ── Load saved prefs on open ────────────────────────────────────
  useEffect(() => {
    if (isSettingsOpen) {
      setThemeMode((localStorage.getItem("theme_mode") as ThemeMode) || "dark");
      setAccentColor(localStorage.getItem("theme_accent") || ACCENT_PRESETS[0].value);
      if (settingsInitialTab) {
        setActiveTab(settingsInitialTab);
        if (isMobile) setMobileSubPage(settingsInitialTab);
      } else {
        setMobileSubPage(null);
      }
    }
  }, [isSettingsOpen]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Load AI settings when AI tab is active ──────────────────────
  useEffect(() => {
    if (activeTab !== "ai" || !isSettingsOpen) return;

    authenticatedFetch("/api/ai/settings")
      .then(r => r.json())
      .then((data: { activeAiProvider: string | null }) => {
        const p = data.activeAiProvider as AiProvider | null;
        setAiProvider(p);
        if (p === "openai" || p === "anthropic") setByokSubProvider(p);
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
  }, [activeTab, isSettingsOpen]);

  // ── Usage countdown timer ────────────────────────────────────────
  useEffect(() => {
    if (usageCountdown <= 0) return;
    const timer = setInterval(() => setUsageCountdown(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [usageCountdown]);

  useEffect(() => {
    if (activeTab === "security" && isSettingsOpen) {
      authenticatedFetch("/api/vault/status")
        .then(r => r.json())
        .then((data: { isConfigured: boolean }) => setVaultConfigured(data.isConfigured))
        .catch(() => {});
      setSecurityMode("idle");
      setSecurityStep("current");
      setSecurityFirstPin("");
      setSecurityCurrentPin("");
      setSecurityError("");
    }
  }, [activeTab, isSettingsOpen]);

  useEffect(() => {
    if (activeTab === "quickbits" && isSettingsOpen) {
      authenticatedFetch("/api/quick-bits/settings")
        .then(r => r.json())
        .then((data: { defaultExpirationDays: number; defaultNotificationHours: number[] }) => {
          setQbExpirationDays(data.defaultExpirationDays ?? 3);
          setQbNotificationHours(data.defaultNotificationHours ?? [24]);
        })
        .catch(() => {});
    }
  }, [activeTab, isSettingsOpen]);

  // ── AI handlers ─────────────────────────────────────────────────
  // Commit the active provider to the server. Also flips hasCompletedAiSetup
  // so the first-time AI setup modal won't reappear after a direct Settings save.
  const commitActiveProvider = async (newProvider: AiProvider) => {
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
      (newProvider === "local_llm" && Boolean(savedKeys["local_llm"]?.endpointUrl));

    if (isConfigured) await commitActiveProvider(newProvider);
  };

  const handleSaveGoogleKey = async () => {
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

  const handleSaveLocalLlm = async () => {
    if (!localEndpoint.trim()) return;
    // Strip trailing slashes so we never produce double-slash URLs like
    // http://localhost:8000//v1/chat/completions when concatenating the path.
    const normalizedEndpoint = localEndpoint.trim().replace(/\/+$/, "");
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

  // ── Security handlers ────────────────────────────────────────────
  const handleSecurityPinSubmit = useCallback(async (pin: string) => {
    setSecurityError("");
    setSecurityLoading(true);

    try {
      if (securityMode === "setup") {
        if (securityStep === "new") {
          setSecurityFirstPin(pin);
          setSecurityStep("confirm");
          setSecurityLoading(false);
          return;
        }
        if (securityStep === "confirm") {
          if (pin !== securityFirstPin) {
            setSecurityError("PINs don't match. Try again.");
            setSecurityFirstPin("");
            setSecurityStep("new");
            setSecurityLoading(false);
            return;
          }
          const hash = await sha256(pin);
          const res = await authenticatedFetch("/api/vault/setup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ passwordHash: hash }),
          });
          if (!res.ok) throw new Error("Setup failed");
          setVaultConfigured(true);
          setSecurityMode("idle");
        }
      }

      if (securityMode === "reset") {
        if (securityStep === "current") {
          // Verify the current PIN against the server immediately — don't let
          // the user type their new PIN only to find out the current one was wrong.
          const currentHash = await sha256(pin);
          const verifyRes = await authenticatedFetch("/api/vault/unlock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ passwordHash: currentHash }),
          });
          if (!verifyRes.ok) {
            setSecurityError("Incorrect PIN. Please try again.");
            setSecurityLoading(false);
            return;
          }
          // Store the hash (already computed) so we don't need to rehash later.
          setSecurityCurrentPin(currentHash);
          setSecurityStep("new");
          setSecurityLoading(false);
          return;
        }
        if (securityStep === "new") {
          setSecurityFirstPin(pin);
          setSecurityStep("confirm");
          setSecurityLoading(false);
          return;
        }
        if (securityStep === "confirm") {
          if (pin !== securityFirstPin) {
            setSecurityError("PINs don't match. Try again.");
            setSecurityFirstPin("");
            setSecurityStep("new");
            setSecurityLoading(false);
            return;
          }
          // securityCurrentPin is already the hash (set at the "current" step above).
          const currentHash = securityCurrentPin;
          const newHash = await sha256(pin);
          const res = await authenticatedFetch("/api/vault/change-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currentPasswordHash: currentHash, newPasswordHash: newHash }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error((data as { error?: string }).error || "Failed to change PIN");
          }
          setSecurityMode("idle");
        }
      }
    } catch (err: unknown) {
      setSecurityError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSecurityLoading(false);
    }
  }, [securityMode, securityStep, securityFirstPin, securityCurrentPin]);

  const getSecurityStepInfo = () => {
    if (securityMode === "setup") {
      if (securityStep === "new") return { title: "Create Vault PIN", subtitle: "Enter a 4–6 digit PIN" };
      if (securityStep === "confirm") return { title: "Confirm PIN", subtitle: "Re-enter your PIN to confirm" };
    }
    if (securityMode === "reset") {
      if (securityStep === "current") return { title: "Current PIN", subtitle: "Enter your current vault PIN" };
      if (securityStep === "new") return { title: "New PIN", subtitle: "Enter a new 4–6 digit PIN" };
      if (securityStep === "confirm") return { title: "Confirm New PIN", subtitle: "Re-enter your new PIN" };
    }
    return { title: "", subtitle: "" };
  };

  const handleSave = () => {
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
    { id: "security" as const, label: "Security & Sign-In", icon: Shield },
    { id: "quickbits" as const, label: "Quick Bits", icon: Zap },
    { id: "account" as const, label: "Account", icon: LogOut },
  ] as const;

  const handleQbSave = async () => {
    setQbSaving(true);
    try {
      await authenticatedFetch("/api/quick-bits/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultExpirationDays: qbExpirationDays, defaultNotificationHours: qbNotificationHours }),
      });
      setSettingsOpen(false);
    } catch {
      // silently fail for now
    } finally {
      setQbSaving(false);
    }
  };

  // Derived: which provider card is highlighted
  const activeCard = aiProvider === "openai" || aiProvider === "anthropic" ? "byok" : aiProvider;

  return (
    <AnimatePresence>
      {isSettingsOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSettingsOpen(false)}
            className="fixed inset-0 bg-black/35 z-40"
            style={{ backdropFilter: "blur(14px) saturate(1.2)", WebkitBackdropFilter: "blur(14px) saturate(1.2)" }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1, transition: { type: "spring", stiffness: 380, damping: 30 } }}
            exit={{ opacity: 0, transition: { duration: 0.15, ease: "easeOut" } }}
            className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-[720px] md:h-[min(580px,80vh)] bg-panel border border-panel-border rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col md:flex-row"
          >
            {/* Left sidebar nav */}
            <div className="hidden md:flex flex-col w-[200px] border-r border-panel-border bg-background/40 shrink-0">
              <div className="p-4 pb-2">
                <p className="text-sm font-semibold text-foreground">Graphe Notes</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mt-0.5">Settings</p>
              </div>
              <nav className="flex-1 px-2 py-2 space-y-0.5">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150",
                      activeTab === tab.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-panel-hover hover:text-foreground"
                    )}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </nav>
              {user && (
                <div className="p-3 border-t border-panel-border mt-auto">
                  <div className="flex items-center gap-2">
                    {user.profileImageUrl ? (
                      <img src={user.profileImageUrl} alt="" referrerPolicy="no-referrer" className="w-7 h-7 rounded-full shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-medium shrink-0">
                        {(user.firstName || user.email || "U")[0].toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{[user.firstName, user.lastName].filter(Boolean).join(" ") || "User"}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile: settings list or sub-page */}
            {isMobile && !mobileSubPage && (
              <div className="flex-1 flex flex-col overflow-hidden md:hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-panel-border bg-background/30 shrink-0">
                  <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
                  <IconButton onClick={() => setSettingsOpen(false)}>
                    <X className="w-5 h-5" />
                  </IconButton>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => { setActiveTab(tab.id); setMobileSubPage(tab.id); }}
                      className="w-full flex items-center gap-3 px-5 py-4 text-sm text-foreground hover:bg-panel-hover transition-colors border-b border-panel-border/50"
                    >
                      <tab.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-left">{tab.label}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Right content area: always on desktop/tablet, only when a sub-page is
                selected on mobile. Conditional rendering (not CSS hidden) ensures
                AnimatePresence never has a stale motion.div to flash on re-entry. */}
            {(!isMobile || mobileSubPage) && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Content header */}
              <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-panel-border bg-background/30 shrink-0">
                <div className="flex items-center gap-2">
                  {isMobile && (
                    <button onClick={() => setMobileSubPage(null)} className="min-w-[44px] min-h-[44px] -ml-2 flex items-center justify-center rounded-lg hover:bg-panel transition-colors">
                      <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                    </button>
                  )}
                  <h2 className="text-lg font-semibold tracking-tight capitalize">
                    {tabs.find(t => t.id === activeTab)?.label ?? "Settings"}
                  </h2>
                </div>
                <IconButton onClick={() => setSettingsOpen(false)}>
                  <X className="w-5 h-5" />
                </IconButton>
              </div>

              <div className="flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                className="p-6 space-y-6"
              >

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
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Motion</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { id: "full" as MotionLevel, label: "Full", icon: Zap, desc: "Spring physics" },
                        { id: "reduced" as MotionLevel, label: "Reduced", icon: Wind, desc: "No springs" },
                        { id: "minimal" as MotionLevel, label: "Minimal", icon: Minus, desc: "Opacity only" },
                      ] as const).map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => handleMotionChange(opt.id)}
                          className={cn(
                            "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-sm font-medium",
                            motionLevel === opt.id
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-panel-border bg-background hover:border-primary/40 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <opt.icon className="w-4 h-4" />
                          <span>{opt.label}</span>
                          <span className="text-[9px] font-normal opacity-70">{opt.desc}</span>
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
                        <span className="text-[11px] text-muted-foreground">Built-in, no key needed</span>
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
                        <span className="text-[11px] text-muted-foreground">Your own Gemini key</span>
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
                        <span className="text-[11px] text-muted-foreground">Your own API key</span>
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
                        <span className="text-[11px] text-muted-foreground">Ollama, LM Studio, etc.</span>
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
                        <p className="text-[11px] text-amber-500">
                          Limit reached — resets in {Math.floor(usageCountdown / 60)}m {usageCountdown % 60}s
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
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
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span className="text-sm text-foreground">API key saved</span>
                          </div>
                          <button
                            onClick={() => handleRemoveKey("google_ai_studio")}
                            className="text-xs text-red-400 hover:text-red-300 transition-colors"
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
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                              <span className="text-sm text-foreground">OpenAI key saved</span>
                            </div>
                            <button onClick={() => handleRemoveKey("openai")} className="text-xs text-red-400 hover:text-red-300 transition-colors">Remove</button>
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
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                              <span className="text-sm text-foreground">Anthropic key saved</span>
                            </div>
                            <button onClick={() => handleRemoveKey("anthropic")} className="text-xs text-red-400 hover:text-red-300 transition-colors">Remove</button>
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
                                <select
                                  value={model}
                                  onChange={(e) => setModel(e.target.value)}
                                  className="w-full bg-panel border border-panel-border rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
                                >
                                  <option value="">Select a model…</option>
                                  {models.map((m) => (
                                    <option key={m} value={m}>{m}</option>
                                  ))}
                                </select>
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
                  {activeCard === "local_llm" && (
                    <div className="p-4 rounded-xl bg-background border border-panel-border space-y-3">
                      {savedKeys["local_llm"]?.endpointUrl ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span className="text-sm text-foreground truncate">{savedKeys["local_llm"].endpointUrl}</span>
                            {savedKeys["local_llm"].hasKey && (
                              <span className="text-[10px] text-emerald-500 font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 shrink-0">key set</span>
                            )}
                          </div>
                          <button onClick={() => handleRemoveKey("local_llm")} className="text-xs text-red-400 hover:text-red-300 transition-colors shrink-0 ml-3">Remove</button>
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
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                              Model name <span className="font-normal">(optional)</span>
                            </label>
                            <input
                              type="text"
                              value={localModel}
                              onChange={(e) => setLocalModel(e.target.value)}
                              placeholder="e.g. llama3.2"
                              className="w-full bg-panel border border-panel-border rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
                            />
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
                      <p className="text-[11px] text-muted-foreground">
                        Endpoint must expose an OpenAI-compatible <code className="text-[10px] bg-panel px-1 py-0.5 rounded">/v1/chat/completions</code> API.
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

              {activeTab === "security" && (
                <section className="space-y-4">
                  {securityMode === "idle" ? (
                    <>
                      <div className="p-4 rounded-xl bg-background border border-panel-border flex items-start gap-4">
                        <div className={cn("p-2 rounded-lg shrink-0", vaultConfigured ? "bg-emerald-500/10 text-emerald-500" : "bg-muted-foreground/10 text-muted-foreground")}>
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-medium mb-1">Vault Protection</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {vaultConfigured
                              ? "Your vault is configured. Notes moved to the vault are protected with your PIN."
                              : "Set up a PIN to protect sensitive notes in your vault."}
                          </p>
                        </div>
                      </div>
                      {vaultConfigured ? (
                        <button
                          onClick={() => { setSecurityMode("reset"); setSecurityStep("current"); setSecurityError(""); setSecurityFirstPin(""); setSecurityCurrentPin(""); }}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 hover:bg-amber-500/20 text-sm font-medium transition-colors"
                        >
                          <KeyRound className="w-4 h-4" />
                          Reset Vault PIN
                        </button>
                      ) : (
                        <button
                          onClick={() => { setSecurityMode("setup"); setSecurityStep("new"); setSecurityError(""); setSecurityFirstPin(""); }}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 text-sm font-medium transition-colors"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          Set Vault PIN
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="py-2">
                      <PinPad
                        key={`${securityMode}-${securityStep}`}
                        title={getSecurityStepInfo().title}
                        subtitle={getSecurityStepInfo().subtitle}
                        error={securityError}
                        onSubmit={handleSecurityPinSubmit}
                        onCancel={() => { setSecurityMode("idle"); setSecurityError(""); }}
                        submitLabel={securityStep === "confirm" ? "Confirm" : "Next"}
                      />
                    </div>
                  )}
                </section>
              )}

              {/* ── QUICK BITS TAB ─────────────────────────── */}
              {activeTab === "quickbits" && (
                <>
                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Default Expiration</h3>
                    <div className="flex gap-2 flex-wrap">
                      {[1, 2, 3, 5, 7].map((days) => (
                        <button
                          key={days}
                          onClick={() => setQbExpirationDays(days)}
                          className={cn(
                            "flex-1 min-w-[52px] py-2 rounded-xl border text-sm font-medium transition-all",
                            qbExpirationDays === days
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-panel-border bg-background hover:border-primary/40 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {days === 1 ? "1 day" : `${days} days`}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Default Notifications</h3>
                    <NotificationCadenceEditor value={qbNotificationHours} onChange={setQbNotificationHours} />
                  </section>
                </>
              )}

              {/* ── ACCOUNT TAB ───────────────────────────────── */}
              {activeTab === "account" && (
                <section className="space-y-4">
                  {user && (
                    <div className="p-4 rounded-xl bg-background border border-panel-border flex items-center gap-3">
                      {user.profileImageUrl ? (
                        <img src={user.profileImageUrl} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-medium shrink-0">
                          {(user.firstName || user.email || "U")[0].toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{[user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "User"}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={logout}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-sm font-medium transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </section>
              )}

              </motion.div>
              </AnimatePresence>
              </div>

              <div className="p-4 border-t border-panel-border bg-background/50 flex justify-end gap-3 shrink-0">
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-panel-hover transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={
                    activeTab === "quickbits" ? handleQbSave
                    : activeTab === "ai" ? () => setSettingsOpen(false)
                    : activeTab === "account" ? () => setSettingsOpen(false)
                    : handleSave
                  }
                  disabled={activeTab === "quickbits" && qbSaving}
                  className="px-6 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl text-sm font-medium transition-colors shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95 disabled:opacity-60"
                >
                  {activeTab === "quickbits" && qbSaving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
