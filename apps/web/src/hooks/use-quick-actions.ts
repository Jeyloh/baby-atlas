"use client";

import { useCallback } from "react";
import type { QuickAction } from "@baby-atlas/schemas";
import { useTimer } from "@/hooks/use-timer";
import { useLastActivities, useUserId } from "@/hooks/use-last-activities";
import { discardRecord, queueOp, type OutboxOp } from "@/lib/offline/outbox";
import { createRecordId } from "@/lib/offline/record-id";
import {
  getLeftElapsedMs,
  getRightElapsedMs,
  useTimerStore,
  type ActiveTimer,
} from "@/stores/timer-store";

export type QuickActionResult =
  | { kind: "logged"; undo: () => void }
  | { kind: "started"; undo: () => void }
  | { kind: "stopped"; durationMs: number }
  | { kind: "switched"; side: "LEFT" | "RIGHT" }
  | { kind: "needsDetails" }
  | { kind: "unavailable" };

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
 * Runs one-tap actions for the home screen. Every write goes through the
 * outbox with an id picked here, so taps work offline and undo or stop can
 * refer to a record the server has not seen yet. Timers follow the same
 * pattern as the log modal: the DB record is the source of truth and the
 * local timer store mirrors it, so the modal can stop a timer started here
 * and the other way round. If another caregiver started a timer, the DB
 * record id is used.
 */
export function useQuickActions(childId: string) {
  const { data: last } = useLastActivities(childId);
  const userId = useUserId();

  const sleepTimer = useTimer(childId, "sleep");
  const feedingTimer = useTimer(childId, "feeding");
  const pumpingTimer = useTimer(childId, "pumping");
  const switchTimerSide = useTimerStore((s) => s.switchBreastfeedingSide);

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
    (action: QuickAction): QuickActionResult => {
      // Only missing on a first ever start without a connection
      if (!userId) return { kind: "unavailable" };
      const queue = (recordId: string, op: OutboxOp) => queueOp(userId, childId, recordId, op);
      const discard = (recordId: string, op: OutboxOp) => discardRecord(userId, childId, recordId, op);
      const now = new Date();

      switch (action) {
        case "diaperWet":
        case "diaperDirty":
        case "diaperBoth": {
          const recordId = createRecordId();
          queue(recordId, {
            path: "diaper.log",
            input: { recordId, childId, time: now, diaperType: DIAPER_TYPE[action] },
          });
          return {
            kind: "logged",
            undo: () => discard(recordId, { path: "diaper.delete", input: { id: recordId } }),
          };
        }

        case "bottle": {
          const previous = last?.lastBottle;
          if (!previous?.amountMl) return { kind: "needsDetails" };
          const recordId = createRecordId();
          queue(recordId, {
            path: "feeding.logBottle",
            input: {
              recordId,
              childId,
              startTime: now,
              amountMl: previous.amountMl,
              bottleContentType: previous.bottleContentType ?? undefined,
            },
          });
          return {
            kind: "logged",
            undo: () => discard(recordId, { path: "feeding.delete", input: { id: recordId } }),
          };
        }

        case "sleep": {
          sleepTimer.stop();
          if (runningSleepId) {
            const startedAt = activeSleep?.startTime ?? now;
            queue(runningSleepId, { path: "sleep.end", input: { id: runningSleepId, endTime: now } });
            return { kind: "stopped", durationMs: now.getTime() - startedAt.getTime() };
          }
          const sleepType = sleepTypeFor(now);
          const recordId = createRecordId();
          queue(recordId, {
            path: "sleep.start",
            input: { recordId, childId, sleepType, startTime: now },
          });
          sleepTimer.start({ sleepType });
          sleepTimer.update({ recordId });
          return {
            kind: "started",
            undo: () => {
              sleepTimer.stop();
              discard(recordId, { path: "sleep.delete", input: { id: recordId } });
            },
          };
        }

        case "breastLeft":
        case "breastRight": {
          const side = action === "breastLeft" ? "LEFT" : "RIGHT";
          const localTimer =
            feedingTimer.timer?.recordId === runningFeedingId ? feedingTimer.timer : undefined;
          const runningSide = activeFeeding?.side ?? localTimer?.metadata?.feedingSide;

          // Tapping the other side during a feed switches sides, like the log modal
          if (runningFeedingId && (runningSide === "LEFT" || runningSide === "RIGHT") && runningSide !== side) {
            const startedAt = activeFeeding?.startTime ?? new Date(localTimer?.startTime ?? now);
            const totalSeconds = Math.round((now.getTime() - startedAt.getTime()) / 1000);
            const durations = breastSideDurations(localTimer, activeFeeding, totalSeconds);
            if (localTimer) switchTimerSide(localTimer.id, side);
            queue(runningFeedingId, {
              path: "feeding.switchBreastfeedingSide",
              input: { id: runningFeedingId, newSide: side, ...durations },
            });
            return { kind: "switched", side };
          }

          feedingTimer.stop();
          if (runningFeedingId) {
            const startedAt = activeFeeding?.startTime ?? new Date(localTimer?.startTime ?? now);
            const totalSeconds = Math.round((now.getTime() - startedAt.getTime()) / 1000);
            queue(runningFeedingId, {
              path: "feeding.endBreastfeeding",
              input: {
                id: runningFeedingId,
                endTime: now,
                ...breastSideDurations(localTimer, activeFeeding, totalSeconds),
              },
            });
            return { kind: "stopped", durationMs: totalSeconds * 1000 };
          }
          const recordId = createRecordId();
          queue(recordId, {
            path: "feeding.startBreastfeeding",
            input: { recordId, childId, side, startTime: now },
          });
          feedingTimer.start({ feedingSide: side });
          feedingTimer.update({ recordId });
          return {
            kind: "started",
            undo: () => {
              feedingTimer.stop();
              discard(recordId, { path: "feeding.delete", input: { id: recordId } });
            },
          };
        }

        case "pumping": {
          pumpingTimer.stop();
          if (runningPumpingId) {
            const startedAt = activePumping?.startTime ?? now;
            queue(runningPumpingId, {
              path: "pumping.end",
              input: { id: runningPumpingId, endTime: now },
            });
            return { kind: "stopped", durationMs: now.getTime() - startedAt.getTime() };
          }
          const recordId = createRecordId();
          queue(recordId, {
            path: "pumping.start",
            input: { recordId, childId, startTime: now },
          });
          pumpingTimer.start({});
          pumpingTimer.update({ recordId });
          return {
            kind: "started",
            undo: () => {
              pumpingTimer.stop();
              discard(recordId, { path: "pumping.delete", input: { id: recordId } });
            },
          };
        }
      }
    },
    [
      userId, childId, last, activeSleep, activeFeeding, activePumping,
      runningSleepId, runningFeedingId, runningPumpingId,
      sleepTimer, feedingTimer, pumpingTimer, switchTimerSide,
    ]
  );

  return { state, run };
}
