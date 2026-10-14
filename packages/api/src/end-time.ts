import { TRPCError } from "@trpc/server";

/**
 * Checks an end time against the start of the same record. An end before the
 * start is a client bug: BAD_REQUEST. An end in the future (a device with a
 * fast clock, or one that queued the write offline) is cut back to now, but
 * never to before the start. `undefined` and `null` pass through, so it can be
 * used on optional update fields.
 */
export function assertEndTime(startTime: Date, endTime: Date, now?: Date): Date;
export function assertEndTime(
  startTime: Date,
  endTime: Date | null | undefined,
  now?: Date
): Date | null | undefined;
export function assertEndTime(
  startTime: Date,
  endTime: Date | null | undefined,
  now: Date = new Date()
): Date | null | undefined {
  if (endTime === undefined || endTime === null) return endTime;
  if (endTime.getTime() < startTime.getTime()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "The end time is before the start time" });
  }
  if (endTime.getTime() > now.getTime()) {
    return new Date(Math.max(now.getTime(), startTime.getTime()));
  }
  return endTime;
}

/** The end time for stopping a timer: the one given (checked), otherwise now. */
export function endTimeOrNow(startTime: Date, endTime: Date | undefined, now: Date = new Date()): Date {
  return assertEndTime(startTime, endTime ?? now, now);
}

/**
 * For update procedures: checks the start and end as they will be after the
 * update (a field that is not in the input keeps its stored value). Returns
 * the end time to store, or undefined to leave it alone.
 */
export function assertUpdatedTimes(
  existing: { startTime: Date; endTime: Date | null },
  input: { startTime?: Date; endTime?: Date | null }
): Date | null | undefined {
  const start = input.startTime ?? existing.startTime;
  if (input.endTime !== undefined) return assertEndTime(start, input.endTime);
  // Only the start moved: it must not pass the stored end
  if (existing.endTime) assertEndTime(start, existing.endTime, existing.endTime);
  return undefined;
}
