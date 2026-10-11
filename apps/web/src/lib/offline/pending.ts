import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@baby-atlas/api";
import type { OutboxEntry } from "./outbox";

export type LastActivities = inferRouterOutputs<AppRouter>["timeline"]["getLastActivities"];

type Sleep = NonNullable<LastActivities["activeSleep"]>;
type Feeding = NonNullable<LastActivities["activeFeeding"]>;
type Diaper = NonNullable<LastActivities["lastDiaper"]>;
type Pumping = NonNullable<LastActivities["activePumping"]>;

function newer<T>(current: T | null, candidate: T, time: (record: T) => Date): T {
  return current && time(current) > time(candidate) ? current : candidate;
}

/**
 * The home screen data as it will be once the queued writes reach the
 * server. Applied on every render instead of written into the query cache,
 * so a refetch that lands before the queue is sent cannot undo a tap.
 */
export function applyPending(last: LastActivities, entries: OutboxEntry[]): LastActivities {
  const next = { ...last };

  for (const { childId, recordId, op } of entries) {
    switch (op.path) {
      case "sleep.start": {
        const startTime = op.input.startTime ?? new Date();
        next.activeSleep = {
          id: recordId,
          childId,
          startTime,
          endTime: null,
          sleepType: op.input.sleepType ?? "NAP",
          quality: null,
          notes: null,
          createdAt: startTime,
          updatedAt: startTime,
        } satisfies Sleep;
        break;
      }
      case "sleep.end":
        if (next.activeSleep?.id === recordId) {
          next.lastSleep = { ...next.activeSleep, endTime: op.input.endTime ?? new Date() };
          next.activeSleep = null;
        }
        break;
      case "sleep.delete":
        if (next.activeSleep?.id === recordId) next.activeSleep = null;
        break;

      case "feeding.startBreastfeeding": {
        const startTime = op.input.startTime ?? new Date();
        next.activeFeeding = {
          ...emptyFeeding(recordId, childId, startTime),
          feedingType: "BREAST",
          side: op.input.side,
        };
        break;
      }
      case "feeding.switchBreastfeedingSide":
        if (next.activeFeeding?.id === recordId) {
          next.activeFeeding = {
            ...next.activeFeeding,
            side: op.input.newSide,
            leftDurationSeconds: op.input.leftDurationSeconds ?? next.activeFeeding.leftDurationSeconds,
            rightDurationSeconds: op.input.rightDurationSeconds ?? next.activeFeeding.rightDurationSeconds,
          };
        }
        break;
      case "feeding.endBreastfeeding":
        if (next.activeFeeding?.id === recordId) {
          next.lastBreastfeeding = {
            ...next.activeFeeding,
            endTime: op.input.endTime ?? new Date(),
            leftDurationSeconds: op.input.leftDurationSeconds ?? next.activeFeeding.leftDurationSeconds,
            rightDurationSeconds: op.input.rightDurationSeconds ?? next.activeFeeding.rightDurationSeconds,
          };
          next.activeFeeding = null;
        }
        break;
      case "feeding.logBottle":
        next.lastBottle = newer(
          next.lastBottle,
          {
            ...emptyFeeding(recordId, childId, op.input.startTime),
            feedingType: "BOTTLE",
            amountMl: op.input.amountMl,
            bottleContentType: op.input.bottleContentType ?? null,
          },
          (record) => record.startTime
        );
        break;
      case "feeding.delete":
        if (next.activeFeeding?.id === recordId) next.activeFeeding = null;
        break;

      case "diaper.log": {
        const time = op.input.time ?? new Date();
        next.lastDiaper = newer(
          next.lastDiaper,
          {
            id: recordId,
            childId,
            time,
            diaperType: op.input.diaperType,
            color: null,
            consistency: null,
            size: null,
            amount: null,
            notes: null,
            createdAt: time,
            updatedAt: time,
          } satisfies Diaper,
          (record) => record.time
        );
        break;
      }
      case "diaper.delete":
        break;

      case "pumping.start": {
        const startTime = op.input.startTime ?? new Date();
        next.activePumping = {
          id: recordId,
          childId,
          startTime,
          endTime: null,
          amountMl: null,
          side: op.input.side ?? null,
          notes: null,
          createdAt: startTime,
          updatedAt: startTime,
        } satisfies Pumping;
        break;
      }
      case "pumping.end":
        if (next.activePumping?.id === recordId) {
          next.lastPumping = { ...next.activePumping, endTime: op.input.endTime ?? new Date() };
          next.activePumping = null;
        }
        break;
      case "pumping.delete":
        if (next.activePumping?.id === recordId) next.activePumping = null;
        break;
    }
  }

  return next;
}

function emptyFeeding(id: string, childId: string, startTime: Date): Feeding {
  return {
    id,
    childId,
    feedingType: "BREAST",
    startTime,
    endTime: null,
    side: null,
    leftDurationSeconds: null,
    rightDurationSeconds: null,
    amountMl: null,
    bottleContentType: null,
    foodItems: [],
    notes: null,
    createdAt: startTime,
    updatedAt: startTime,
  };
}
