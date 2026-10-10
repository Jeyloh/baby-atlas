"use client";

import { useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

/** Shows the tRPC error message, for example the FORBIDDEN text viewers get on writes. */
export function useErrorToast(title: string) {
  const { toast } = useToast();
  return useCallback(
    (error: { message: string }) =>
      toast({ title, description: error.message, variant: "destructive" }),
    [toast, title]
  );
}
