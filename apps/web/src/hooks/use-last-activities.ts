"use client";

import { useMemo } from "react";
import { trpc } from "@/lib/trpc/provider";
import { sharedFreshness } from "@/lib/shared-freshness";
import { isUnsent, useOutbox } from "@/lib/offline/outbox";
import { applyPending } from "@/lib/offline/pending";

/** The signed-in user's id, from the saved query cache when offline. */
export function useUserId() {
  return trpc.user.get.useQuery().data?.id;
}

/** The latest activity of each kind, including the user's quick actions not yet synced. */
export function useLastActivities(childId: string) {
  const query = trpc.timeline.getLastActivities.useQuery({ childId }, sharedFreshness);
  const userId = useUserId();
  const entries = useOutbox((state) => state.entries);

  const data = useMemo(() => {
    if (!query.data) return undefined;
    const pending = entries.filter((e) => e.childId === childId && e.userId === userId);
    return pending.length ? applyPending(query.data, pending) : query.data;
  }, [query.data, entries, childId, userId]);

  return { data, isLoading: query.isLoading };
}

export function usePendingCount(childId: string) {
  const userId = useUserId();
  return useOutbox((state) => state.entries.filter((e) => e.childId === childId && isUnsent(e, userId)).length);
}
