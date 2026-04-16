// Motion level system — reads from Zustand store and provides animation configs.
// All Framer Motion components should use useAnimationConfig() rather than hardcoding durations.

"use client";

import { useEffect, type CSSProperties } from "react";
import { useAppStore } from "@/store";
import type { MotionLevel } from "@/store";
import posthog from "posthog-js";

export type { MotionLevel };

export function useMotionLevel(): MotionLevel {
  return useAppStore((s) => s.motionLevel);
}

export function useSetMotionLevel() {
  const setMotionLevel = useAppStore((s) => s.setMotionLevel);
  return (level: MotionLevel) => {
    setMotionLevel(level);
    try {
      posthog.capture("motion_level_changed", { level, timestamp: new Date().toISOString() });
    } catch {
      // PostHog may not be initialized yet
    }
  };
}

// Run this once at the app root to sync prefers-reduced-motion and apply data-motion attribute.
export function useMotionInit() {
  const motionLevel = useAppStore((s) => s.motionLevel);
  const setMotionLevel = useAppStore((s) => s.setMotionLevel);

  // On mount: read prefers-reduced-motion and apply initial level
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Only auto-set if the user hasn't overridden it (check localStorage)
    const stored = localStorage.getItem("motion_level") as MotionLevel | null;
    if (stored && ["full", "reduced", "minimal"].includes(stored)) {
      setMotionLevel(stored);
      return;
    }

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) setMotionLevel("reduced");

    const handler = (e: MediaQueryListEvent) => {
      const stored = localStorage.getItem("motion_level");
      if (!stored) setMotionLevel(e.matches ? "reduced" : "full");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync data-motion attribute on <html> element so CSS can respond to it
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.motion = motionLevel;
  }, [motionLevel]);
}

export type AnimationConfig = ReturnType<typeof useAnimationConfig>;

// Returns animation durations and Framer Motion transition objects for the current level.
export function useAnimationConfig() {
  const level = useMotionLevel();

  if (level === "minimal") {
    return {
      level,
      useScale: false,
      microTransition: { duration: 0.1, ease: "linear" as const },
      fastTransition: { duration: 0.1, ease: "linear" as const },
      standardTransition: { duration: 0.1, ease: "linear" as const },
      emphasisTransition: { duration: 0.1, ease: "easeOut" as const },
      spring: { type: "tween" as const, duration: 0.1, ease: "linear" as const },
      exitTransition: { duration: 0.1, ease: "linear" as const },
      initialVariants: { opacity: 0 },
      enterVariants: { opacity: 1 },
      exitVariants: { opacity: 0 },
      // Card-item exit: opacity-only, no vertical compress
      cardExitVariants: { opacity: 0, transition: { duration: 0.1, ease: "linear" as const } },
      cardExitStyle: undefined as CSSProperties | undefined,
    } as const;
  }

  if (level === "reduced") {
    return {
      level,
      useScale: false,
      microTransition: { duration: 0.05, ease: "easeOut" as const },
      fastTransition: { duration: 0.08, ease: "easeOut" as const },
      standardTransition: { duration: 0.11, ease: "easeOut" as const },
      emphasisTransition: { duration: 0.15, ease: "easeOut" as const },
      spring: { type: "tween" as const, duration: 0.15, ease: "easeOut" as const },
      exitTransition: { duration: 0.1, ease: "easeOut" as const },
      initialVariants: { opacity: 0 },
      enterVariants: { opacity: 1 },
      exitVariants: { opacity: 0 },
      // Card-item exit: opacity-only fade, no vertical compress
      cardExitVariants: { opacity: 0, transition: { duration: 0.15, ease: "easeIn" as const } },
      cardExitStyle: undefined as CSSProperties | undefined,
    } as const;
  }

  // full
  return {
    level,
    useScale: true,
    microTransition: { duration: 0.1, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
    fastTransition: { duration: 0.16, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
    standardTransition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
    emphasisTransition: { type: "spring" as const, stiffness: 280, damping: 20 },
    spring: { type: "spring" as const, stiffness: 300, damping: 22 },
    exitTransition: { duration: 0.2, ease: [0.4, 0, 1, 1] as [number, number, number, number] },
    initialVariants: { opacity: 0, y: 4, scale: 0.97 },
    enterVariants: { opacity: 1, y: 0, scale: 1 },
    exitVariants: { opacity: 0, x: -8, scale: 0.97 },
    // Card-item exit: vertical compress + fade. originY: 0 anchors the top edge.
    cardExitVariants: { opacity: 0, scaleY: 0, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] as [number, number, number, number] } },
    cardExitStyle: { originY: 0 } as CSSProperties,
  };
}
