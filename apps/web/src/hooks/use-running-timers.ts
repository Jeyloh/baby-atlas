"use client";

import { useEffect, useMemo, useState } from "react";
import {
  thresholdMinutes,
  timerThresholdKey,
  timerTier,
  type TimerThresholdKey,
  type TimerTier,
} from "@baby-atlas/utils";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@baby-atlas/api";
import { trpc } from "@/lib/trpc/provider";
import { sharedFreshness } from "@/lib/shared-freshness";
import { useOutbox, type OutboxPath } from "@/lib/offline/outbox";
import { useUserId } from "@/hooks/use-last-activities";

type RunningTimerRow = inferRouterOutputs<AppRouter>["timeline"]["getRunningTimers"]["timers"][number];

export interface RunningTimer extends RunningTimerRow {
  key: TimerThresholdKey;
  thresholdMin: number;
  /** 0 normal, 1 past the threshold, 2 past twice the threshold */
  tier: TimerTier;
}

// Queued writes that end or remove a record. Until they are sent and the
// queries refetched, the timer counts as stopped.
const ENDING_PATHS: ReadonlySet<OutboxPath> = new Set([
  "sleep.end",
  "sleep.delete",
  "feeding.endBreastfeeding",
  "feeding.delete",
  "pumping.end",
  "pumping.delete",
]);

const TICK_MS = 30_000;

/**
 * The child's running timers, whoever started them, with the tier each has
 * reached under the user's own thresholds (notification settings). Timers the
 * user has already stopped offline are left out.
 */
export function useRunningTimers(childId: string) {
  const query = trpc.timeline.getRunningTimers.useQuery({ childId }, sharedFreshness);
  const settings = trpc.notifications.getSettings.useQuery();
  const userId = useUserId();
  const entries = useOutbox((state) => state.entries);

  // Re-evaluate the tiers while the page is open
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const overrides = settings.data?.timerThresholds;

  const timers = useMemo<RunningTimer[] | undefined>(() => {
    if (!query.data) return undefined;
    const rows = query.data.timers;
    const ending = new Set(
      entries
        .filter((e) => e.userId === userId && ENDING_PATHS.has(e.op.path))
        .map((e) => e.recordId)
    );
    return rows
      .filter((row) => !ending.has(row.recordId))
      .map((row) => {
        const key = timerThresholdKey(row.kind, row.sleepType);
        const thresholdMin = thresholdMinutes(key, overrides);
        return { ...row, key, thresholdMin, tier: timerTier(row.startTime, now, thresholdMin) };
      });
  }, [query.data, entries, userId, overrides, now]);

  // Viewers can read but not stop timers
  const canEdit = query.data ? query.data.memberRole !== "VIEWER" : false;

  return { timers, now, canEdit, isLoading: query.isLoading };
}
