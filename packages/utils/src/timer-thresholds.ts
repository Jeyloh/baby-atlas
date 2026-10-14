/**
 * Rules for spotting a forgotten timer: how long each kind of timer normally
 * runs, when it has run suspiciously long, and what end time to suggest.
 */

export type TimerThresholdKey =
  | "nap"
  | "nightSleep"
  | "breastfeeding"
  | "bottle"
  | "pumping"
  | "activity";

/** Minutes per timer type. Missing types use the defaults. */
export type TimerThresholdOverrides = Partial<Record<TimerThresholdKey, number>>;

/** A timer that has run this long is probably forgotten (tier 1). Twice as long is tier 2. */
export const DEFAULT_TIMER_THRESHOLD_MINUTES: Record<TimerThresholdKey, number> = {
  nap: 180,
  nightSleep: 780,
  breastfeeding: 60,
  bottle: 30,
  pumping: 45,
  activity: 120,
};

/** A typical length, used as the suggested end time when fixing a forgotten timer. */
export const TYPICAL_TIMER_MINUTES: Record<TimerThresholdKey, number> = {
  nap: 60,
  nightSleep: 600,
  breastfeeding: 20,
  bottle: 15,
  pumping: 20,
  activity: 30,
};

/** Past this many tiers a timer is not escalated any further. */
export const MAX_TIMER_TIER = 2;

export type TimerTier = 0 | 1 | 2;

export type RunningTimerKind = "sleep" | "breast" | "bottle" | "pumping" | "activity";

/** The threshold type of a running record. */
export function timerThresholdKey(
  kind: RunningTimerKind,
  sleepType?: "NAP" | "NIGHT" | null
): TimerThresholdKey {
  switch (kind) {
    case "sleep":
      return sleepType === "NIGHT" ? "nightSleep" : "nap";
    case "breast":
      return "breastfeeding";
    case "bottle":
      return "bottle";
    case "pumping":
      return "pumping";
    case "activity":
      return "activity";
  }
}

/** Threshold in minutes: a valid override, otherwise the default. */
export function thresholdMinutes(
  key: TimerThresholdKey,
  overrides?: TimerThresholdOverrides | null
): number {
  const override = overrides?.[key];
  return typeof override === "number" && Number.isFinite(override) && override >= 1
    ? override
    : DEFAULT_TIMER_THRESHOLD_MINUTES[key];
}

/** Which tier a timer has reached: 0 (normal), 1 (1x threshold) or 2 (2x threshold). */
export function timerTier(startTime: Date, now: Date, thresholdMin: number): TimerTier {
  const elapsedMin = (now.getTime() - startTime.getTime()) / 60_000;
  if (elapsedMin >= thresholdMin * MAX_TIMER_TIER) return 2;
  if (elapsedMin >= thresholdMin) return 1;
  return 0;
}

/** When a timer reaches a tier. */
export function tierReachedAt(startTime: Date, thresholdMin: number, tier: 1 | 2): Date {
  return new Date(startTime.getTime() + thresholdMin * tier * 60_000);
}

/** Suggested end time for a forgotten timer: start plus a typical length, never later than now. */
export function suggestedEndTime(startTime: Date, now: Date, key: TimerThresholdKey): Date {
  const typical = startTime.getTime() + TYPICAL_TIMER_MINUTES[key] * 60_000;
  return new Date(Math.min(typical, now.getTime()));
}

export type EndTimeProblem = "invalid" | "beforeStart" | "inFuture";

/** An end time must be after the start and not in the future. Returns the problem, if any. */
export function endTimeProblem(startTime: Date, endTime: Date, now: Date): EndTimeProblem | null {
  if (Number.isNaN(endTime.getTime())) return "invalid";
  if (endTime.getTime() <= startTime.getTime()) return "beforeStart";
  if (endTime.getTime() > now.getTime()) return "inFuture";
  return null;
}

/** The table a running timer is stored in. Bottle and breast feeds are both "feeding". */
export type TimerRecordType = "sleep" | "feeding" | "pumping" | "activity";

export function timerRecordType(kind: RunningTimerKind): TimerRecordType {
  return kind === "breast" || kind === "bottle" ? "feeding" : kind;
}

const RECORD_TYPES: readonly TimerRecordType[] = ["sleep", "feeding", "pumping", "activity"];

/** The `?fixTimer=` value of a link that opens the fix dialog: `<type>:<recordId>`. */
export function fixTimerParam(type: TimerRecordType, recordId: string): string {
  return `${type}:${recordId}`;
}

/** Reads a `?fixTimer=` value, or null when it is missing or malformed. */
export function parseFixTimerParam(
  value: string | null | undefined
): { type: TimerRecordType; recordId: string } | null {
  if (!value) return null;
  const separator = value.indexOf(":");
  if (separator < 0) return null;
  const type = value.slice(0, separator) as TimerRecordType;
  const recordId = value.slice(separator + 1);
  if (!RECORD_TYPES.includes(type) || !/^[A-Za-z0-9_-]{1,64}$/.test(recordId)) return null;
  return { type, recordId };
}
