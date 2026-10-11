"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ThemeProvider } from "next-themes";
import { TRPCProvider } from "@/lib/trpc/provider";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/toaster";
import { OfflineData } from "@/components/offline/offline-data";
import { OutboxSync } from "@/components/offline/outbox-sync";
import { ServiceWorkerRegistration } from "@/components/offline/service-worker-registration";
import { OFFLINE_DATA_MAX_AGE_MS } from "@/lib/offline/query-persister";

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
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          <TRPCProvider queryClient={queryClient}>
            {children}
            <OfflineData />
            <OutboxSync />
            <ServiceWorkerRegistration />
            <Toaster />
          </TRPCProvider>
        </QueryClientProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
