"use client";

import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc/provider";
import { sharedFreshness } from "@/lib/shared-freshness";
import { mergeSupportData, type SupportData } from "@/lib/support/support-data";
import { useLastActivities } from "./use-last-activities";

/** The current time, refreshed every minute so predictions and "in 20 min" stay right. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * Recent feeds, sleeps, diapers and temperatures for the support cards: the
 * last few days from the server, with the home screen's latest activities
 * (including quick actions not yet synced) laid over them.
 */
export function useSupportData(childId: string): SupportData | undefined {
  const recent = trpc.timeline.getRecentActivity.useQuery({ childId }, sharedFreshness);
  const { data: last } = useLastActivities(childId);

  return useMemo(
    () => (recent.data ? mergeSupportData(recent.data, last) : undefined),
    [recent.data, last]
  );
}
