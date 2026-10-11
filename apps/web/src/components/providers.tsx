"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { useEffect, useState } from "react";
import { ThemeProvider } from "next-themes";
import { TRPCProvider } from "@/lib/trpc/provider";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/toaster";
import { OutboxSync } from "@/components/offline/outbox-sync";
import { ServiceWorkerRegistration } from "@/components/offline/service-worker-registration";
import {
  createQueryPersister,
  OFFLINE_DATA_MAX_AGE_MS,
  QUERY_CACHE_BUSTER,
} from "@/lib/offline/query-persister";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 1000,
            refetchOnWindowFocus: false,
            // Saved data must outlive the persister's max age, or it is dropped on restore
            gcTime: OFFLINE_DATA_MAX_AGE_MS,
          },
          mutations: {
            // Forms show an error when offline instead of waiting forever.
            // Quick actions queue through the outbox instead.
            networkMode: "always",
          },
        },
      })
  );
  // Restored in the background instead of through PersistQueryClientProvider,
  // which holds every query idle until the restore ends. That made isLoading
  // false with no data on the server and first paint, so pages flashed their
  // empty states. Hydrating never replaces data newer than the saved copy.
  useEffect(() => {
    const [unsubscribe] = persistQueryClient({
      queryClient,
      persister: createQueryPersister(),
      maxAge: OFFLINE_DATA_MAX_AGE_MS,
      buster: QUERY_CACHE_BUSTER,
    });
    return unsubscribe;
  }, [queryClient]);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          <TRPCProvider queryClient={queryClient}>
            {children}
            <OutboxSync />
            <ServiceWorkerRegistration />
            <Toaster />
          </TRPCProvider>
        </QueryClientProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
