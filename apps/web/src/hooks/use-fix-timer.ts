"use client";

import { useCallback } from "react";
import { TRPCClientError } from "@trpc/client";
import { trpc } from "@/lib/trpc/provider";
import { useUserId } from "@/hooks/use-last-activities";
import { breastSideDurations } from "@/hooks/use-quick-actions";
import { queueOp } from "@/lib/offline/outbox";
import { useTimerStore } from "@/stores/timer-store";
import type { RunningTimer } from "@/hooks/use-running-timers";

/** The timer was already stopped, for example on another device. */
export class TimerAlreadyEndedError extends Error {
  constructor() {
    super("The timer has already stopped");
  }
}

export class FixTimerUnavailableError extends Error {
  constructor() {
    super("Signed-in user is not known yet");
  }
}

/**
 * Ends a running timer at a chosen time. Sleep, breastfeeds and pumping go
 * through the outbox like the quick actions, so the home screen is right at
 * once and the write survives being offline. Activities have no outbox
 * operation and use the mutation directly; if the server says the timer has
 * already ended, the local timer is cleared, the queries refresh and
 * TimerAlreadyEndedError is thrown. Either way the matching
 * timer in the local store is removed, and the queries refetch, so a timer
 * started on another device (only in the database) is cleared everywhere too.
 */
export function useFixTimer(childId: string) {
  const userId = useUserId();
  const utils = trpc.useUtils();
  const endActivity = trpc.activity.end.useMutation();

  return useCallback(
    async (timer: RunningTimer, endTime: Date) => {
      const needsOutbox = timer.kind === "sleep" || timer.kind === "breast" || timer.kind === "pumping";
      if (needsOutbox && !userId) throw new FixTimerUnavailableError();

      const { timers, stopTimer } = useTimerStore.getState();
      const stopLocal = () => {
        for (const local of Object.values(timers)) {
          if (local.recordId === timer.recordId) stopTimer(local.id);
        }
      };

      const id = timer.recordId;
      switch (timer.kind) {
        case "sleep":
          queueOp(userId!, childId, id, { path: "sleep.end", input: { id, endTime } });
          break;
        case "breast": {
          // The local timer counts up to now, so it is not used here: the
          // forgotten time would end up in the side durations
          const totalSeconds = Math.max(
            0,
            Math.round((endTime.getTime() - timer.startTime.getTime()) / 1000)
          );
          const durations = breastSideDurations(
            undefined,
            {
              side: timer.side,
              leftDurationSeconds: timer.leftDurationSeconds ?? null,
              rightDurationSeconds: timer.rightDurationSeconds ?? null,
            },
            totalSeconds
          );
          queueOp(userId!, childId, id, {
            path: "feeding.endBreastfeeding",
            input: { id, endTime, ...durations },
          });
          break;
        }
        case "pumping":
          queueOp(userId!, childId, id, { path: "pumping.end", input: { id, endTime } });
          break;
        case "activity":
          try {
            await endActivity.mutateAsync({ id, endTime });
          } catch (error) {
            if (error instanceof TRPCClientError && error.data?.code === "CONFLICT") {
              stopLocal();
              await utils.timeline.invalidate();
              await utils.activity.invalidate();
              throw new TimerAlreadyEndedError();
            }
            throw error;
          }
          break;
      }

      stopLocal();
      // The outbox invalidates after it has sent. Direct mutations refresh here.
      if (!needsOutbox) {
        await Promise.all([utils.timeline.invalidate(), utils.activity.invalidate()]);
      }
    },
    [childId, userId, utils, endActivity]
  );
}
