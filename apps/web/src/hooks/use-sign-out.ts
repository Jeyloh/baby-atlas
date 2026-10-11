"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useToast } from "@/hooks/use-toast";
import { releaseDevice } from "@/lib/offline/device-owner";

/**
 * Signs out, then removes the user's data from the device. Signing out
 * needs the server, so offline nothing is cleared and a toast explains why.
 */
export function useSignOut() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const t = useTranslations("nav");

  return useCallback(async () => {
    try {
      await signOut({ redirect: false });
    } catch {
      toast({ title: t("signOutFailed"), variant: "destructive" });
      return;
    }
    await releaseDevice(queryClient);
    window.location.assign("/");
  }, [queryClient, toast, t]);
}
