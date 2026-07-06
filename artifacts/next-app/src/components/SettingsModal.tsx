import { useState, useEffect, useCallback, useRef } from "react";
import NextImage from "next/image";
import {
  X, Key, Cloud, Download, Server, Palette, Sun, Moon, Monitor,
  Shield, ShieldCheck, KeyRound, LogOut, Zap,
  Wind, Minus, CircleDot, Contrast, Accessibility,
} from "lucide-react";
import { NotificationCadenceEditor } from "./NotificationCadenceEditor";
import { useAppStore } from "@/store";
import type { MotionLevel, DarkModeLevel, ColorblindMode } from "@/store";
import { applyDarkModeLevel, applyColorblindMode } from "@/hooks/use-atmosphere";
import { useAuth } from "@/hooks/use-auth";
import { IconButton } from "./ui/IconButton";
import { motion, AnimatePresence } from "framer-motion";
import { useAnimationConfig, useSetMotionLevel } from "@/hooks/use-motion";
import { cn } from "@/lib/utils";
import { useDemoMode } from "@/lib/demo-context";
import { Dialog, DialogClose } from "./ui/dialog";
import { Dialog as DialogPrimitive, VisuallyHidden } from "radix-ui";
import { useBreakpoint } from "@/hooks/use-mobile";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { PinPad } from "./PinPad";
import { authenticatedFetch } from "@workspace/api-client-react/custom-fetch";
import { useQueryClient } from "@tanstack/react-query";
import { AI_SETTINGS_QUERY_KEY } from "@/lib/execute-ai-request";
import { AiSettingsTab } from "./settings/AiSettingsTab";

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
  // Atomic Zustand selectors (E1) — one subscription per value.
  const isSettingsOpen = useAppStore(s => s.isSettingsOpen);
  const queryClient = useQueryClient();

  // G16-partial: when settings closes, refresh the cached AI settings so the next
  // AI action picks up any provider / key / endpoint change made here.
  const prevSettingsOpen = useRef(isSettingsOpen);
  useEffect(() => {
    if (prevSettingsOpen.current && !isSettingsOpen) {
      queryClient.invalidateQueries({ queryKey: AI_SETTINGS_QUERY_KEY });
    }
    prevSettingsOpen.current = isSettingsOpen;
  }, [isSettingsOpen, queryClient]);
  const setSettingsOpen = useAppStore(s => s.setSettingsOpen);
  const settingsInitialTab = useAppStore(s => s.settingsInitialTab);
  const motionLevel = useAppStore(s => s.motionLevel);
  const setMotionLevel = useAppStore(s => s.setMotionLevel);
  const darkModeLevel = useAppStore(s => s.darkModeLevel);
  const setDarkModeLevel = useAppStore(s => s.setDarkModeLevel);
  const colorblindMode = useAppStore(s => s.colorblindMode);
  const setColorblindMode = useAppStore(s => s.setColorblindMode);
  const { user, logout } = useAuth();
  const isDemo = useDemoMode();
  const bp = useBreakpoint();
  const isMobile = bp === "mobile";
  const anim = useAnimationConfig();
  const setMotionLevelWithTracking = useSetMotionLevel();

  const handleMotionChange = (level: MotionLevel) => {
    setMotionLevelWithTracking(level);
    localStorage.setItem("motion_level", level);
  };

  const handleDarkLevelChange = (level: DarkModeLevel) => {
    setDarkModeLevel(level);
    applyDarkModeLevel(level);
  };

  const handleColorblindChange = (mode: ColorblindMode) => {
    setColorblindMode(mode);
    applyColorblindMode(mode);
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

  useEffect(() => {
    if (activeTab === "security" && isSettingsOpen) {
      if (isDemo) {
        // X-D3: demo vault state is the sessionStorage PIN hash (source of truth).
        setVaultConfigured(!!sessionStorage.getItem("demo_vault_hash"));
      } else {
        authenticatedFetch("/api/vault/status")
          .then(r => r.json())
          .then((data: { isConfigured: boolean }) => setVaultConfigured(data.isConfigured))
          .catch(() => {});
      }
      setSecurityMode("idle");
      setSecurityStep("current");
      setSecurityFirstPin("");
      setSecurityCurrentPin("");
      setSecurityError("");
    }
  }, [activeTab, isSettingsOpen, isDemo]);

  useEffect(() => {
    if (activeTab === "quickbits" && isSettingsOpen) {
      // X-D1: demo has no settings backend — show the defaults, fire no request.
      if (isDemo) {
        setQbExpirationDays(3);
        setQbNotificationHours([24]);
        return;
      }
      authenticatedFetch("/api/quick-bits/settings")
        .then(r => r.json())
        .then((data: { defaultExpirationDays: number; defaultNotificationHours: number[] }) => {
          setQbExpirationDays(data.defaultExpirationDays ?? 3);
          setQbNotificationHours(data.defaultNotificationHours ?? [24]);
        })
        .catch(() => {});
    }
  }, [activeTab, isSettingsOpen, isDemo]);

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
          if (isDemo) {
            // X-D3/D4: demo vault is client-only — the PIN lives in sessionStorage
            // (the same key NoteShell/Sidebar read), no authenticated request.
            sessionStorage.setItem("demo_vault_hash", pin);
          } else {
            // Send plaintext PIN — hashing happens server-side with bcrypt
            const res = await authenticatedFetch("/api/vault/setup", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pin }),
            });
            if (!res.ok) throw new Error("Setup failed");
          }
          setVaultConfigured(true);
          setSecurityMode("idle");
        }
      }

      if (securityMode === "reset") {
        if (securityStep === "current") {
          // Verify the current PIN immediately — don't let the user type their new
          // PIN only to find out the current one was wrong.
          if (isDemo) {
            // X-D4: compare against the sessionStorage PIN (source of truth).
            const stored = sessionStorage.getItem("demo_vault_hash");
            if (stored && stored !== pin) {
              setSecurityError("Incorrect PIN. Please try again.");
              setSecurityLoading(false);
              return;
            }
          } else {
            const verifyRes = await authenticatedFetch("/api/vault/unlock", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pin }),
            });
            if (!verifyRes.ok) {
              setSecurityError("Incorrect PIN. Please try again.");
              setSecurityLoading(false);
              return;
            }
          }
          // Store the plaintext PIN so we can send it in the change-password call.
          setSecurityCurrentPin(pin);
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
          if (isDemo) {
            // X-D4: rotate the sessionStorage PIN, no authenticated request.
            sessionStorage.setItem("demo_vault_hash", pin);
          } else {
            // Send plaintext PINs — hashing happens server-side with bcrypt
            const res = await authenticatedFetch("/api/vault/change-password", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ currentPin: securityCurrentPin, newPin: pin }),
            });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error((data as { error?: string }).error || "Failed to change PIN");
            }
          }
          setSecurityMode("idle");
        }
      }
    } catch (err: unknown) {
      setSecurityError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSecurityLoading(false);
    }
  }, [securityMode, securityStep, securityFirstPin, securityCurrentPin, isDemo]);

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
    if (isDemo) { setSettingsOpen(false); return; } // X-D1: no settings backend in demo
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

  return (
    <Dialog open={isSettingsOpen} onOpenChange={(open) => { if (!open) setSettingsOpen(false); }}>
      <DialogPrimitive.Portal forceMount>
        <AnimatePresence>
          {isSettingsOpen && (
            <>
              <DialogPrimitive.Overlay forceMount asChild>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/35 z-40"
                  style={{ backdropFilter: "blur(14px) saturate(1.2)", WebkitBackdropFilter: "blur(14px) saturate(1.2)" }}
                />
              </DialogPrimitive.Overlay>
              <DialogPrimitive.Content forceMount asChild
                aria-describedby={undefined}
                onOpenAutoFocus={(e) => e.preventDefault()}>
                <motion.div
                  data-testid="settings-modal"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1, transition: { type: "spring", stiffness: 380, damping: 30 } }}
                  exit={{ opacity: 0, transition: anim.fastTransition }}
                  className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-[720px] md:h-[min(580px,80vh)] bg-panel border border-panel-border rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col md:flex-row luminance-border-top"
                >
                  <VisuallyHidden.Root asChild>
                    <DialogPrimitive.Title>Settings</DialogPrimitive.Title>
                  </VisuallyHidden.Root>
            {/* Left sidebar nav */}
            <div className="hidden md:flex flex-col w-[200px] border-r border-panel-border bg-background/40 shrink-0">
              <div className="p-4 pb-2">
                <p className="text-sm font-semibold text-foreground">Graphe Notes</p>
                <p className="text-2xs uppercase tracking-wider text-muted-foreground font-medium mt-0.5">Settings</p>
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
                      <NextImage src={user.profileImageUrl} alt="" width={28} height={28} referrerPolicy="no-referrer" className="rounded-full shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-medium shrink-0">
                        {(user.firstName || user.email || "U")[0].toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{[user.firstName, user.lastName].filter(Boolean).join(" ") || "User"}</p>
                      <p className="text-2xs text-muted-foreground truncate">{user.email}</p>
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
                  <DialogClose asChild>
                    <IconButton>
                      <X className="w-5 h-5" />
                    </IconButton>
                  </DialogClose>
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
                <DialogClose asChild>
                  <IconButton>
                    <X className="w-5 h-5" />
                  </IconButton>
                </DialogClose>
              </div>

              <div className="flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={anim.microTransition}
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
                          <span className="text-2xs font-normal opacity-70">{opt.desc}</span>
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
                        <span className="px-2 py-0.5 rounded-full text-2xs bg-primary/10 text-primary border border-primary/20">#tag</span>
                        <button className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium">Button</button>
                      </div>
                    </div>
                  </section>

                  {/* Dark mode level — only shown in dark mode */}
                  {themeMode === "dark" && (
                    <section className="space-y-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dark Intensity</h3>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { id: "soft" as DarkModeLevel, label: "Soft", icon: Moon, desc: "Warm & gentle", swatch: "#1C1F28" },
                          { id: "default" as DarkModeLevel, label: "Dark", icon: CircleDot, desc: "Balanced depth", swatch: "#151720" },
                          { id: "oled" as DarkModeLevel, label: "OLED", icon: Contrast, desc: "True black", swatch: "#000000" },
                        ] as const).map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => handleDarkLevelChange(opt.id)}
                            data-testid={`dark-level-${opt.id}`}
                            className={cn(
                              "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-sm font-medium",
                              darkModeLevel === opt.id
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-panel-border bg-background hover:border-primary/40 text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <span className="w-5 h-5 rounded-full border border-panel-border shrink-0" style={{ backgroundColor: opt.swatch }} />
                            <span>{opt.label}</span>
                            <span className="text-2xs font-normal opacity-70">{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Accessibility — colorblind modes */}
                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Accessibility</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { id: "none" as ColorblindMode, label: "Default", desc: "Standard colors" },
                        { id: "protanopia" as ColorblindMode, label: "P/D", desc: "Red-green safe" },
                        { id: "tritanopia" as ColorblindMode, label: "Trit.", desc: "Blue-yellow safe" },
                      ] as const).map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => handleColorblindChange(opt.id)}
                          data-testid={`colorblind-${opt.id}`}
                          className={cn(
                            "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-sm font-medium",
                            colorblindMode === opt.id
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-panel-border bg-background hover:border-primary/40 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Accessibility className="w-4 h-4" />
                          <span>{opt.label}</span>
                          <span className="text-2xs font-normal opacity-70">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-2xs text-muted-foreground leading-relaxed">
                      Remaps semantic colors (errors, success, warnings) for colorblind users. P/D = Protanopia &amp; Deuteranopia.
                    </p>
                  </section>
                </>
              )}

              {/* ── AI TAB ─────────────────────────────────── */}
              {activeTab === "ai" && <AiSettingsTab isDemo={isDemo} />}

              {/* ── DATA TAB ───────────────────────────────── */}
              {activeTab === "data" && (
                <section className="space-y-4">
                  <div className="p-4 rounded-xl bg-background border border-panel-border flex items-start gap-4">
                    <div className="p-2 bg-success/10 text-success rounded-lg shrink-0">
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
                        <div className={cn("p-2 rounded-lg shrink-0", vaultConfigured ? "bg-success/10 text-success" : "bg-muted-foreground/10 text-muted-foreground")}>
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
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-warning/10 border border-warning/20 text-warning hover:bg-warning/20 text-sm font-medium transition-colors"
                        >
                          <KeyRound className="w-4 h-4" />
                          Reset Vault PIN
                        </button>
                      ) : (
                        <button
                          onClick={() => { setSecurityMode("setup"); setSecurityStep("new"); setSecurityError(""); setSecurityFirstPin(""); }}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-ai-accent/10 border border-ai-accent/20 text-ai-accent hover:bg-ai-accent/20 text-sm font-medium transition-colors"
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
                        <NextImage src={user.profileImageUrl} alt="" width={36} height={36} referrerPolicy="no-referrer" className="rounded-full shrink-0" />
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
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive hover:bg-destructive/20 text-sm font-medium transition-colors"
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
              </DialogPrimitive.Content>
            </>
          )}
        </AnimatePresence>
      </DialogPrimitive.Portal>
    </Dialog>
  );
}
