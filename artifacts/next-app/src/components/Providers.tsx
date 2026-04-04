"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TokenSync } from "@/lib/token-sync";

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

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TokenSync />
      <Toaster />
      {children}
    </QueryClientProvider>
  );
}
