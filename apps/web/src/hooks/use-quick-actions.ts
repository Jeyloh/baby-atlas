"use client";

import { useCallback } from "react";
import type { QuickAction } from "@baby-atlas/schemas";
import { trpc } from "@/lib/trpc/provider";
import { useTimer } from "@/hooks/use-timer";
import {
  getLeftElapsedMs,
  getRightElapsedMs,
  type ActiveTimer,
} from "@/stores/timer-store";

export type QuickActionResult =
  | { kind: "logged"; undo: () => Promise<void> }
  | { kind: "started"; undo: () => Promise<void> }
  | { kind: "stopped"; durationMs: number }
  | { kind: "needsDetails" };

export interface QuickActionState {
  active: boolean;
  startedAt?: Date;
}

const DIAPER_TYPE = {
  diaperWet: "WET",
  diaperDirty: "DIRTY",
  diaperBoth: "BOTH",
} as const;

/**
 * Per-side seconds for a breastfeed being stopped. The local timer tracks
 * both sides precisely. Without it (started on another device), the stored
 * value for the other side is kept and the running side gets the rest, so
 * the two always add up to the total duration.
 */
export function breastSideDurations(
  localTimer: ActiveTimer | undefined,
  record: {
    side: "LEFT" | "RIGHT" | "BOTH" | null;
    leftDurationSeconds: number | null;
    rightDurationSeconds: number | null;
  } | null,
  totalSeconds: number
): { leftDurationSeconds?: number; rightDurationSeconds?: number } {
  if (localTimer) {
    return {
      leftDurationSeconds: Math.round(getLeftElapsedMs(localTimer) / 1000),
      rightDurationSeconds: Math.round(getRightElapsedMs(localTimer) / 1000),
    };
  }
  if (record?.side === "LEFT") {
    const right = record.rightDurationSeconds ?? 0;
    return { leftDurationSeconds: Math.max(0, totalSeconds - right), rightDurationSeconds: right };
  }
  if (record?.side === "RIGHT") {
    const left = record.leftDurationSeconds ?? 0;
    return { leftDurationSeconds: left, rightDurationSeconds: Math.max(0, totalSeconds - left) };
  }
  return {};
}

// Sleep started between 19:00 and 06:59 counts as night sleep
export function sleepTypeFor(date: Date): "NAP" | "NIGHT" {
  const hour = date.getHours();
  return hour >= 19 || hour < 7 ? "NIGHT" : "NAP";
}

/**
 * Runs one-tap actions for the home screen. Timers follow the same pattern
 * as the log modal: the DB record is the source of truth and the local timer
 * store mirrors it, so the modal can stop a timer started here and the other
 * way round. If another caregiver started a timer, the DB record id is used.
 */
export function useQuickActions(childId: string) {
  const utils = trpc.useUtils();
  const { data: last } = trpc.timeline.getLastActivities.useQuery({ childId });

  const sleepTimer = useTimer(childId, "sleep");
  const feedingTimer = useTimer(childId, "feeding");
  const pumpingTimer = useTimer(childId, "pumping");

  const invalidate = useCallback(() => {
    void utils.timeline.invalidate();
    void utils.sleep.invalidate();
    void utils.feeding.invalidate();
    void utils.diaper.invalidate();
    void utils.pumping.invalidate();
  }, [utils]);

  const opts = { onSettled: invalidate };
  const logDiaper = trpc.diaper.log.useMutation(opts);
  const deleteDiaper = trpc.diaper.delete.useMutation(opts);
  const logBottle = trpc.feeding.logBottle.useMutation(opts);
  const deleteFeeding = trpc.feeding.delete.useMutation(opts);
  const startSleep = trpc.sleep.start.useMutation(opts);
  const endSleep = trpc.sleep.end.useMutation(opts);
  const deleteSleep = trpc.sleep.delete.useMutation(opts);
  const startBreast = trpc.feeding.startBreastfeeding.useMutation(opts);
  const endBreast = trpc.feeding.endBreastfeeding.useMutation(opts);
  const startPumping = trpc.pumping.start.useMutation(opts);
  const endPumping = trpc.pumping.end.useMutation(opts);
  const deletePumping = trpc.pumping.delete.useMutation(opts);

  const activeSleep = last?.activeSleep ?? null;
  const activeFeeding = last?.activeFeeding ?? null;
  const activePumping = last?.activePumping ?? null;

  // Once the server state has loaded it decides what is running. A local
  // timer without a matching open record was stopped on another device and
  // must not be "stopped" again, which would overwrite the real end time.
  const loaded = last !== undefined;
  const runningSleepId = loaded ? activeSleep?.id : sleepTimer.timer?.recordId;
  const runningFeedingId = loaded ? activeFeeding?.id : feedingTimer.timer?.recordId;
  const runningPumpingId = loaded ? activePumping?.id : pumpingTimer.timer?.recordId;

  const state: Record<QuickAction, QuickActionState> = {
    diaperWet: { active: false },
    diaperDirty: { active: false },
    diaperBoth: { active: false },
    bottle: { active: false },
    sleep: { active: !!runningSleepId, startedAt: activeSleep?.startTime },
    breastLeft: {
      active: !!runningFeedingId && (activeFeeding?.side ?? feedingTimer.timer?.metadata?.feedingSide) === "LEFT",
      startedAt: activeFeeding?.startTime,
    },
    breastRight: {
      active: !!runningFeedingId && (activeFeeding?.side ?? feedingTimer.timer?.metadata?.feedingSide) === "RIGHT",
      startedAt: activeFeeding?.startTime,
    },
    pumping: { active: !!runningPumpingId, startedAt: activePumping?.startTime },
  };

  const run = useCallback(
    async (action: QuickAction): Promise<QuickActionResult> => {
      const now = new Date();

      switch (action) {
        case "diaperWet":
        case "diaperDirty":
        case "diaperBoth": {
          const record = await logDiaper.mutateAsync({
            childId,
            time: now,
            diaperType: DIAPER_TYPE[action],
          });
          return {
            kind: "logged",
            undo: async () => void (await deleteDiaper.mutateAsync({ id: record.id })),
          };
        }

        case "bottle": {
          const previous = last?.lastBottle;
          if (!previous?.amountMl) return { kind: "needsDetails" };
          const record = await logBottle.mutateAsync({
            childId,
            startTime: now,
            amountMl: previous.amountMl,
            bottleContentType: previous.bottleContentType ?? undefined,
          });
          return {
            kind: "logged",
            undo: async () => void (await deleteFeeding.mutateAsync({ id: record.id })),
          };
        }

        case "sleep": {
          sleepTimer.stop();
          if (runningSleepId) {
            const startedAt = activeSleep?.startTime ?? now;
            await endSleep.mutateAsync({ id: runningSleepId, endTime: now });
            return { kind: "stopped", durationMs: now.getTime() - startedAt.getTime() };
          }
          const sleepType = sleepTypeFor(now);
          const record = await startSleep.mutateAsync({ childId, sleepType, startTime: now });
          sleepTimer.start({ sleepType });
          sleepTimer.update({ recordId: record.id });
          return {
            kind: "started",
            undo: async () => {
              sleepTimer.stop();
              await deleteSleep.mutateAsync({ id: record.id });
            },
          };
        }

        case "breastLeft":
        case "breastRight": {
          const side = action === "breastLeft" ? "LEFT" : "RIGHT";
          // Read the local timer before it is cleared: it has per-side totals
          const localTimer =
            feedingTimer.timer?.recordId === runningFeedingId ? feedingTimer.timer : undefined;
          feedingTimer.stop();
          if (runningFeedingId) {
            // Any running feed is stopped, whichever side button was tapped
            const startedAt = activeFeeding?.startTime ?? new Date(localTimer?.startTime ?? now);
            const totalSeconds = Math.round((now.getTime() - startedAt.getTime()) / 1000);
            await endBreast.mutateAsync({
              id: runningFeedingId,
              endTime: now,
              ...breastSideDurations(localTimer, activeFeeding, totalSeconds),
            });
            return { kind: "stopped", durationMs: totalSeconds * 1000 };
          }
          const record = await startBreast.mutateAsync({ childId, side, startTime: now });
          feedingTimer.start({ feedingSide: side });
          feedingTimer.update({ recordId: record.id });
          return {
            kind: "started",
            undo: async () => {
              feedingTimer.stop();
              await deleteFeeding.mutateAsync({ id: record.id });
            },
          };
        }

        case "pumping": {
          pumpingTimer.stop();
          if (runningPumpingId) {
            const startedAt = activePumping?.startTime ?? now;
            await endPumping.mutateAsync({ id: runningPumpingId, endTime: now });
            return { kind: "stopped", durationMs: now.getTime() - startedAt.getTime() };
          }
          const record = await startPumping.mutateAsync({ childId, startTime: now });
          pumpingTimer.start({});
          pumpingTimer.update({ recordId: record.id });
          return {
            kind: "started",
            undo: async () => {
              pumpingTimer.stop();
              await deletePumping.mutateAsync({ id: record.id });
            },
          };
        }
      }
    },
    [
      childId, last, activeSleep, activeFeeding, activePumping,
      runningSleepId, runningFeedingId, runningPumpingId,
      sleepTimer, feedingTimer, pumpingTimer,
      logDiaper, deleteDiaper, logBottle, deleteFeeding,
      startSleep, endSleep, deleteSleep, startBreast, endBreast,
      startPumping, endPumping, deletePumping,
    ]
  );

  return { state, run };
}
