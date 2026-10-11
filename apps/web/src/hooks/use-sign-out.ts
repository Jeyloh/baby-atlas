"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useToast } from "@/hooks/use-toast";
import { signOutAndClearDevice } from "@/lib/offline/query-persister";

/** Signs out and clears this user's saved data, or explains why it could not. */
export function useSignOut() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const t = useTranslations("nav");

  return useCallback(() => {
    signOutAndClearDevice(queryClient).catch(() => {
      toast({ title: t("signOutFailed"), variant: "destructive" });
    });
  }, [queryClient, toast, t]);
}
