"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useToast } from "@/hooks/use-toast";
import { currentPushEndpoint } from "@/lib/notifications/client";
import { releaseDevice } from "@/lib/offline/device-owner";
import { trpc } from "@/lib/trpc/provider";

// Removing the push registration must not hold up signing out on a bad connection
const PUSH_UNSUBSCRIBE_TIMEOUT_MS = 3000;

/**
 * Signs out, then removes the user's data from the device. Signing out
 * needs the server, so offline nothing is cleared and a toast explains why.
 */
export function useSignOut() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const t = useTranslations("nav");
  const { client } = trpc.useUtils();

  return useCallback(async () => {
    // While the session is still valid, remove this device from the server.
    // The browser subscription itself is dropped by releaseDevice after sign-out.
    try {
      const endpoint = await currentPushEndpoint();
      if (endpoint) {
        await Promise.race([
          client.notifications.unsubscribe.mutate({ endpoint }),
          new Promise((resolve) => setTimeout(resolve, PUSH_UNSUBSCRIBE_TIMEOUT_MS)),
        ]);
      }
    } catch {
      // Best effort: a dead registration is removed when the push service rejects it
    }

    try {
      await signOut({ redirect: false });
    } catch {
      toast({ title: t("signOutFailed"), variant: "destructive" });
      return;
    }
    await releaseDevice(queryClient);
    window.location.assign("/");
  }, [client, queryClient, toast, t]);
}
