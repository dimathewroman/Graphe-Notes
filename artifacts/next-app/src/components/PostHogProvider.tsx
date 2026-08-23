"use client";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { useEffect } from "react";
import type { CaptureResult, Properties } from "posthog-js";

function scrubExceptionBeforeSend(event: CaptureResult | null): CaptureResult | null {
  if (!event || event.event !== "$exception") return event;

  const properties: Properties = {
    // Keep a generic type for PostHog error grouping without sending the raw
    // error message, stack, user-authored context, or arbitrary attributes.
    $exception_list: [{ type: "Error" }],
  };
  for (const key of ["$lib", "$lib_version"] as const) {
    const value = event.properties[key];
    if (typeof value === "string") properties[key] = value;
  }

  return {
    uuid: event.uuid,
    event: "$exception",
    properties,
    ...(event.timestamp ? { timestamp: event.timestamp } : {}),
  };
}

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    if (posthog.__loaded) return; // already initialized (e.g. HMR)

    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: "/ingest",
      ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.posthog.com",
      defaults: "2026-01-30",
      // Product analytics is deliberate: user-authored note and PIN DOM must
      // never be collected by browser-side automatic instrumentation.
      autocapture: false,
      disable_session_recording: true,
      capture_pageview: false,
      capture_pageleave: false,
      rageclick: false,
      capture_exceptions: true,
      before_send: scrubExceptionBeforeSend,
      loaded: (ph) => {
        if (process.env.NODE_ENV === "development") {
          ph.debug();
        }
      },
    });
  }, []);

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
