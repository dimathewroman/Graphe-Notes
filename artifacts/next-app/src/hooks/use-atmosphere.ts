// Atmosphere system — dark mode intensity levels and colorblind mode.
// Syncs data-dark-level and data-colorblind attributes on <html> so CSS
// selectors in globals.css can remap surface tokens and semantic colors.

"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store";
import type { DarkModeLevel, ColorblindMode } from "@/store";
import posthog from "posthog-js";

export type { DarkModeLevel, ColorblindMode };

export function useDarkModeLevel(): DarkModeLevel {
  return useAppStore((s) => s.darkModeLevel);
}

export function useColorblindMode(): ColorblindMode {
  return useAppStore((s) => s.colorblindMode);
}

// Call once at the app root (inside Providers) to restore persisted
// preferences and sync DOM attributes.
export function useAtmosphereInit() {
  const darkModeLevel = useAppStore((s) => s.darkModeLevel);
  const setDarkModeLevel = useAppStore((s) => s.setDarkModeLevel);
  const colorblindMode = useAppStore((s) => s.colorblindMode);
  const setColorblindMode = useAppStore((s) => s.setColorblindMode);

  // Restore from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedLevel = localStorage.getItem("dark_mode_level") as DarkModeLevel | null;
    if (storedLevel && ["soft", "default", "oled"].includes(storedLevel)) {
      setDarkModeLevel(storedLevel);
    }

    const storedColorblind = localStorage.getItem("colorblind_mode") as ColorblindMode | null;
    if (storedColorblind && ["none", "protanopia", "tritanopia"].includes(storedColorblind)) {
      setColorblindMode(storedColorblind);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync data-dark-level on <html>
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (darkModeLevel === "default") {
      delete document.documentElement.dataset.darkLevel;
    } else {
      document.documentElement.dataset.darkLevel = darkModeLevel;
    }
  }, [darkModeLevel]);

  // Sync data-colorblind on <html>
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (colorblindMode === "none") {
      delete document.documentElement.dataset.colorblind;
    } else {
      document.documentElement.dataset.colorblind = colorblindMode;
    }
  }, [colorblindMode]);
}

export function applyDarkModeLevel(level: DarkModeLevel) {
  if (level === "default") {
    delete document.documentElement.dataset.darkLevel;
  } else {
    document.documentElement.dataset.darkLevel = level;
  }
  localStorage.setItem("dark_mode_level", level);
  try {
    posthog.capture("dark_mode_level_changed", { level, timestamp: new Date().toISOString() });
  } catch {
    // PostHog may not be initialized yet
  }
}

export function applyColorblindMode(mode: ColorblindMode) {
  if (mode === "none") {
    delete document.documentElement.dataset.colorblind;
  } else {
    document.documentElement.dataset.colorblind = mode;
  }
  localStorage.setItem("colorblind_mode", mode);
  try {
    posthog.capture("colorblind_mode_changed", { mode, timestamp: new Date().toISOString() });
  } catch {
    // PostHog may not be initialized yet
  }
}
