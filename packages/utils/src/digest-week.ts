import { osloDayKey } from "./oslo-day";
import { osloMinutesOfDay } from "./quiet-hours";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** The digest for the week that just ended goes out on Monday from this time (Oslo)... */
export const DIGEST_START_MINUTES = 8 * 60;
/** ...until this time (Oslo). A notice held back by quiet hours is still sent inside the window. */
export const DIGEST_END_MINUTES = 20 * 60;

function parseKey(key: string): [number, number, number] {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return [y, m, d];
}

/** Adds calendar days to a YYYY-MM-DD key (negative steps back). */
export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = parseKey(key);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** ISO weekday of a YYYY-MM-DD key: Monday is 1, Sunday is 7. */
export function isoWeekday(key: string): number {
  const [y, m, d] = parseKey(key);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
}

/** The Monday on or before a YYYY-MM-DD key. */
export function mondayOfKey(key: string): string {
  return addDaysToKey(key, 1 - isoWeekday(key));
}

/** The Monday that starts the last complete Monday to Sunday week in Oslo. */
export function lastFullWeekStart(now: Date): string {
  return addDaysToKey(mondayOfKey(osloDayKey(now)), -7);
}

/**
 * The instant Oslo midnight starts a calendar day. Oslo is UTC+1 or UTC+2 and
 * clocks change at 01:00 UTC, so midnight is always one of two candidates.
 */
export function osloStartOfDay(key: string): Date {
  const [y, m, d] = parseKey(key);
  const utcMidnight = Date.UTC(y, m - 1, d);
  for (const offsetHours of [2, 1]) {
    const candidate = new Date(utcMidnight - offsetHours * HOUR_MS);
    if (osloDayKey(candidate) === key && osloMinutesOfDay(candidate) === 0) {
      return candidate;
    }
  }
  // Unreachable for real Oslo dates, but a date helper should never throw.
  return new Date(utcMidnight - HOUR_MS);
}

/** UTC midnight of a YYYY-MM-DD key, how Prisma stores `@db.Date` columns. */
export function dateOnly(key: string): Date {
  const [y, m, d] = parseKey(key);
  return new Date(Date.UTC(y, m - 1, d));
}

/** The seven YYYY-MM-DD keys of the week that starts on `weekStart`. */
export function weekDayKeys(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(weekStart, i));
}

/** ISO 8601 year and week number of a day key, for example 2026 and 42. */
export function isoWeekOf(key: string): { year: number; week: number } {
  // The Thursday of the same ISO week decides the year.
  const thursday = addDaysToKey(key, 4 - isoWeekday(key));
  const [year, month, day] = parseKey(thursday);
  const dayOfYear = Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / DAY_MS);
  return { year, week: Math.floor(dayOfYear / 7) + 1 };
}

/** "2026-W42" */
export function isoWeekLabel(key: string): string {
  const { year, week } = isoWeekOf(key);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/**
 * Which week the digest push should summarise right now (as its Monday key),
 * or null when it is not the time for it. Only Monday from 08:00 to 20:00
 * Oslo, for the week that just ended, so the numbers are complete.
 */
export function digestWeekToSend(now: Date): string | null {
  const today = osloDayKey(now);
  const minutes = osloMinutesOfDay(now);
  if (isoWeekday(today) !== 1) return null;
  if (minutes < DIGEST_START_MINUTES || minutes >= DIGEST_END_MINUTES) return null;
  return addDaysToKey(today, -7);
}
