import { lastOsloDayKeys } from "./oslo-day";

/** Mood at or below this counts as a hard day. */
export const LOW_MOOD_MAX = 2;
/** Hard days in the last week before the gentle support card is shown. */
export const LOW_MOOD_DAYS_NEEDED = 4;
const WINDOW_DAYS = 7;

/**
 * Whether the last 7 Oslo days (today included) hold at least 4 check-ins with
 * mood 2 or lower. Entries are the user's own, with `date` as YYYY-MM-DD.
 */
export function shouldShowSupport(
  entries: ReadonlyArray<{ date: string; mood: number }>,
  now: Date
): boolean {
  const days = new Set(lastOsloDayKeys(WINDOW_DAYS, now));
  const lowDays = new Set(
    entries.filter((e) => days.has(e.date) && e.mood <= LOW_MOOD_MAX).map((e) => e.date)
  );
  return lowDays.size >= LOW_MOOD_DAYS_NEEDED;
}
