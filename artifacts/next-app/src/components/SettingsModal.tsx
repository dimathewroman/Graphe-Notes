import { useState, useEffect, useRef } from "react";
import NextImage from "next/image";
import {
  X, Key, Cloud, Palette, Shield, LogOut, Zap,
  ArrowLeft, ChevronRight,
} from "lucide-react";
import { useAppStore } from "@/store";
import { useAuth } from "@/hooks/use-auth";
import { IconButton } from "./ui/IconButton";
import { motion, AnimatePresence } from "framer-motion";
import { useAnimationConfig } from "@/hooks/use-motion";
import { cn } from "@/lib/utils";
import { useDemoMode } from "@/lib/demo-context";
import { Dialog, DialogClose } from "./ui/dialog";
import { Dialog as DialogPrimitive, VisuallyHidden } from "radix-ui";
import { useBreakpoint } from "@/hooks/use-mobile";
import { authenticatedFetch } from "@workspace/api-client-react/custom-fetch";
import { useQueryClient } from "@tanstack/react-query";
import { AI_SETTINGS_QUERY_KEY } from "@/lib/execute-ai-request";
import { AiSettingsTab } from "./settings/AiSettingsTab";
import { AppearanceSettingsTab, ACCENT_PRESETS, applyTheme, type ThemeMode } from "./settings/AppearanceSettingsTab";
import { DataSettingsTab } from "./settings/DataSettingsTab";
import { SecuritySettingsTab } from "./settings/SecuritySettingsTab";
import { AccountSettingsTab } from "./settings/AccountSettingsTab";
import { QuickBitsSettingsTab } from "./settings/QuickBitsSettingsTab";

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
  const { user } = useAuth();
  const isDemo = useDemoMode();
  const bp = useBreakpoint();
  const isMobile = bp === "mobile";
  const anim = useAnimationConfig();

  const [activeTab, setActiveTab] = useState<"appearance" | "ai" | "data" | "security" | "quickbits" | "account">("appearance");
  const [mobileSubPage, setMobileSubPage] = useState<typeof activeTab | null>(null);

  // Theme mode + accent color are provisional — live-previewed on change but only
  // persisted by the footer's Save (so Discard reverts them on reload). Kept in the
  // shell so the footer can persist them, like the Quick Bits tab.
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [accentColor, setAccentColor] = useState(ACCENT_PRESETS[0].value);

  // Quick Bits settings state — kept in the shell so the shared footer's
  // "Save Changes" button (handleQbSave / qbSaving) stays wired to it.
  const [qbExpirationDays, setQbExpirationDays] = useState(3);
  const [qbNotificationHours, setQbNotificationHours] = useState<number[]>([24]);
  const [qbSaving, setQbSaving] = useState(false);

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

  // Live-preview theme changes without persisting (persist happens on Save).
  const handleModeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    applyTheme(mode, accentColor);
  };
  const handleAccentChange = (value: string) => {
    setAccentColor(value);
    applyTheme(themeMode, value);
  };
  // Footer "Save Changes" for appearance/data/security: persist theme + close.
  const handleSave = () => {
    localStorage.setItem("theme_mode", themeMode);
    localStorage.setItem("theme_accent", accentColor);
    applyTheme(themeMode, accentColor);
    setSettingsOpen(false);
  };

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
                <AppearanceSettingsTab
                  themeMode={themeMode}
                  accentColor={accentColor}
                  onModeChange={handleModeChange}
                  onAccentChange={handleAccentChange}
                />
              )}

              {/* ── AI TAB ─────────────────────────────────── */}
              {activeTab === "ai" && <AiSettingsTab isDemo={isDemo} />}

              {/* ── DATA TAB ───────────────────────────────── */}
              {activeTab === "data" && <DataSettingsTab />}

              {/* ── SECURITY TAB ───────────────────────────── */}
              {activeTab === "security" && <SecuritySettingsTab isDemo={isDemo} />}

              {/* ── QUICK BITS TAB ─────────────────────────── */}
              {activeTab === "quickbits" && (
                <QuickBitsSettingsTab
                  expirationDays={qbExpirationDays}
                  setExpirationDays={setQbExpirationDays}
                  notificationHours={qbNotificationHours}
                  setNotificationHours={setQbNotificationHours}
                />
              )}

              {/* ── ACCOUNT TAB ───────────────────────────────── */}
              {activeTab === "account" && <AccountSettingsTab />}

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
                    : activeTab === "ai" || activeTab === "account" ? () => setSettingsOpen(false)
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
