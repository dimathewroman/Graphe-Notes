"use client";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { useEffect } from "react";
import type { CaptureResult, Properties } from "posthog-js";

const SAFE_EXCEPTION_TYPES = new Set([
  "Error", "TypeError", "RangeError", "ReferenceError", "SyntaxError", "URIError", "EvalError", "AggregateError",
  "DOMException", "AbortError", "DataError", "EncodingError", "InvalidAccessError", "InvalidCharacterError",
  "InvalidModificationError", "InvalidNodeTypeError", "InvalidStateError", "NetworkError", "NotAllowedError",
  "NotFoundError", "NotReadableError", "OperationError", "QuotaExceededError", "SecurityError", "TimeoutError",
]);

function safeExceptionType(properties: Properties): string {
  const exceptionList = properties.$exception_list;
  if (!Array.isArray(exceptionList)) return "Error";

  const firstException = exceptionList[0];
  if (!firstException || typeof firstException !== "object" || Array.isArray(firstException)) return "Error";

  const type = (firstException as Record<string, unknown>).type;
  return typeof type === "string" && SAFE_EXCEPTION_TYPES.has(type) ? type : "Error";
}

function scrubExceptionBeforeSend(event: CaptureResult | null): CaptureResult | null {
  if (!event || event.event !== "$exception") return event;

  const exceptionType = safeExceptionType(event.properties);
  const properties: Properties = {
    // Preserve only a standard error class for grouping. Never pass through
    // message, stack, filenames, paths, or arbitrary caller properties.
    $exception_type: exceptionType,
  };
  for (const key of ["token", "$token", "distinct_id", "$lib", "$lib_version"] as const) {
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

function telemetryApiHost(): string | null {
  // The hosted app owns its same-origin /ingest rewrite. A static asset bundle
  // has no rewrite server, so it remains telemetry-silent until a separately
  // configured direct ingest host is supplied at build time.
  if (process.env.NEXT_PUBLIC_STATIC_CLIENT === "1") {
    return process.env.NEXT_PUBLIC_POSTHOG_INGEST_HOST || null;
  }

  return "/ingest";
}

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    if (posthog.__loaded) return; // already initialized (e.g. HMR)

    const apiHost = telemetryApiHost();
    if (!apiHost) return;

    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: apiHost,
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
