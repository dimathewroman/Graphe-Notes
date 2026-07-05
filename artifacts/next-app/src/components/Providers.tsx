"use client";

import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { TokenSync } from "@/lib/token-sync";
import { PHProvider } from "@/components/PostHogProvider";
import { useMotionInit } from "@/hooks/use-motion";
import { useAtmosphereInit } from "@/hooks/use-atmosphere";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = (error as { status?: number })?.status;
        if (status !== undefined && status < 500) return false;
        return failureCount < 3;
      },
      retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 5000),
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

export { queryClient };

function MotionInit() {
  useMotionInit();
  return null;
}

function AtmosphereInit() {
  useAtmosphereInit();
  return null;
}

// M3 (cheap): warn on connectivity loss. Authenticated mode has no offline queue
// yet (Yjs Phase 1), so a persistent warning is the honest signal that edits may
// not be saving until the connection returns.
function NetworkStatusInit() {
  useEffect(() => {
    const onOffline = () =>
      toast.error("You're offline — changes may not save until you reconnect.", {
        id: "network-offline",
        duration: Infinity,
      });
    const onOnline = () => {
      toast.dismiss("network-offline");
      toast.success("Back online.", { id: "network-online", duration: 2500 });
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    if (typeof navigator !== "undefined" && navigator.onLine === false) onOffline();
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider>
      <QueryClientProvider client={queryClient}>
        <MotionInit />
        <AtmosphereInit />
        <NetworkStatusInit />
        <TokenSync />
        <Toaster />
        {children}
      </QueryClientProvider>
    </PHProvider>
  );
}
