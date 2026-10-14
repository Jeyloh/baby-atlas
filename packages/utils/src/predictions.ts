import { osloMinutesOfDay } from "./quiet-hours";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// ---------------------------------------------------------------------------
// Feeds
// ---------------------------------------------------------------------------

/** How far back feeds count towards the typical interval. */
export const FEED_HISTORY_HOURS = 48;
/** Feeds that start within this many minutes of the previous one count as one feed (side switch, cluster). */
export const FEED_MERGE_MINUTES = 20;
/**
 * Feed predictions are for babies. From this age solids and the toddler's own
 * rhythm make the interval between breast and bottle feeds a poor guide.
 */
export const FEED_PREDICTION_MAX_MONTHS = 12;
/** Fewer feeds than this and there is no prediction. */
export const MIN_FEEDS_FOR_PREDICTION = 4;
/** A gap longer than this is a missing log or a long sleep, not a feeding rhythm. */
export const MAX_FEED_INTERVAL_MINUTES = 8 * 60;
/** Night starts and ends at these minutes after midnight in Oslo. */
const NIGHT_START = 22 * 60;
const NIGHT_END = 6 * 60;

export interface FeedEvent {
  startTime: Date;
}

export interface NextFeedPrediction {
  /** Predicted start of the next feed */
  at: Date;
  /** The median interval the prediction is based on, in minutes */
  intervalMinutes: number;
  /** Number of intervals the median was taken from */
  sampleSize: number;
  /** Start of the most recent feed */
  lastFeedAt: Date;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function isNightMinute(minutesOfDay: number): boolean {
  return minutesOfDay >= NIGHT_START || minutesOfDay < NIGHT_END;
}

/**
 * Feed start times from the last 48 hours, oldest first, with feeds that
 * follow each other within 20 minutes merged into one.
 */
export function recentFeedStarts(feeds: FeedEvent[], now: Date): Date[] {
  const since = now.getTime() - FEED_HISTORY_HOURS * HOUR;
  const times = feeds
    .map((f) => f.startTime.getTime())
    .filter((t) => t >= since && t <= now.getTime())
    .sort((a, b) => a - b);

  const merged: number[] = [];
  for (const t of times) {
    const previous = merged[merged.length - 1];
    if (previous !== undefined && t - previous < FEED_MERGE_MINUTES * MINUTE) continue;
    merged.push(t);
  }
  return merged.map((t) => new Date(t));
}

/**
 * The typical time between feeds in minutes, or null when there are fewer
 * than four feeds in the last 48 hours. Gaps over 8 hours are ignored. Night
 * gaps (starting 22:00 to 06:00 Oslo) are left out when enough daytime gaps
 * exist, because babies often sleep longer at night than they feed by day.
 */
export function typicalFeedIntervalMinutes(
  feeds: FeedEvent[],
  now: Date,
  mode: "day" | "night" = "day"
): { minutes: number; sampleSize: number; lastFeedAt: Date } | null {
  const starts = recentFeedStarts(feeds, now);
  if (starts.length < MIN_FEEDS_FOR_PREDICTION) return null;

  const intervals: { minutes: number; night: boolean }[] = [];
  for (let i = 1; i < starts.length; i++) {
    const minutes = (starts[i]!.getTime() - starts[i - 1]!.getTime()) / MINUTE;
    if (minutes > MAX_FEED_INTERVAL_MINUTES) continue;
    intervals.push({ minutes, night: isNightMinute(osloMinutesOfDay(starts[i - 1]!)) });
  }

  let used = intervals;
  if (mode === "night") {
    used = intervals.filter((i) => i.night);
  } else {
    const day = intervals.filter((i) => !i.night);
    if (day.length >= 3) used = day;
  }
  if (used.length < 3) return null;

  return {
    minutes: median(used.map((i) => i.minutes)),
    sampleSize: used.length,
    lastFeedAt: starts[starts.length - 1]!,
  };
}

/**
 * When the next feed is likely, from the median interval of recent feeds.
 * Returns null with fewer than four feeds in the last 48 hours. Callers pass
 * breast and bottle feeds (not solids) and skip the prediction while a feed
 * is running.
 */
export function predictNextFeed(feeds: FeedEvent[], now: Date): NextFeedPrediction | null {
  let typical = typicalFeedIntervalMinutes(feeds, now);
  if (!typical) return null;

  // A feed at night (the last one started 22:00-06:00, or the daytime rhythm
  // lands in that window) follows the night rhythm: the median of night gaps,
  // when at least three exist. Without them there is no honest guess, so none.
  const dayAt = typical.lastFeedAt.getTime() + typical.minutes * MINUTE;
  if (
    isNightMinute(osloMinutesOfDay(typical.lastFeedAt)) ||
    isNightMinute(osloMinutesOfDay(new Date(dayAt)))
  ) {
    typical = typicalFeedIntervalMinutes(feeds, now, "night");
    if (!typical) return null;
  }

  return {
    at: new Date(typical.lastFeedAt.getTime() + typical.minutes * MINUTE),
    intervalMinutes: Math.round(typical.minutes),
    sampleSize: typical.sampleSize,
    lastFeedAt: typical.lastFeedAt,
  };
}

// ---------------------------------------------------------------------------
// Naps
// ---------------------------------------------------------------------------

/** After this age the app stops predicting naps. */
export const NAP_PREDICTION_MAX_MONTHS = 36;
/** Own wake windows count from this many hours back. */
export const WAKE_WINDOW_HISTORY_HOURS = 72;
export const MIN_OWN_WAKE_WINDOWS = 3;
/** A wake window longer than this is a day without naps or a missing log. */
export const MAX_WAKE_WINDOW_MINUTES = 8 * 60;
/** From this age a predicted nap late in the evening is bedtime, not a nap. */
const BEDTIME_FROM_AGE_MONTHS = 3;
const BEDTIME_START = 19 * 60 + 30;

/**
 * Typical awake time between sleeps by age in months, in minutes (the middle
 * of the usual range). These are common guidance figures used by child health
 * nurses and sleep guides, not official targets, so the prediction is only a
 * hint: every child differs, and the child's own recent wake windows are
 * blended in. Helsenorge only says that the youngest babies are often awake
 * for 30 to 60 minutes (https://www.helsenorge.no/barn/sovn-hos-barn/).
 *
 * Ranges used: 0-1 mo 45-60 min, 1-3 mo 60-90, 3-4 mo 75-120, 4-6 mo
 * 90-150, 6-8 mo 2-3 h, 8-10 mo 2.5-3.5 h, 10-15 mo 3-4 h, 15-18 mo 4-6 h
 * (moving to one nap), 18-36 mo 5-6 h.
 */
export const WAKE_WINDOW_BY_AGE: { fromMonths: number; minutes: number }[] = [
  { fromMonths: 0, minutes: 52 },
  { fromMonths: 1, minutes: 75 },
  { fromMonths: 3, minutes: 98 },
  { fromMonths: 4, minutes: 120 },
  { fromMonths: 6, minutes: 150 },
  { fromMonths: 8, minutes: 180 },
  { fromMonths: 10, minutes: 210 },
  { fromMonths: 15, minutes: 300 },
  { fromMonths: 18, minutes: 330 },
];

/** Age in whole days (birth date is a calendar date; both are treated as UTC days). */
export function ageInDays(birthDate: Date, now: Date): number {
  const birth = Date.UTC(birthDate.getUTCFullYear(), birthDate.getUTCMonth(), birthDate.getUTCDate());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((today - birth) / DAY);
}

/** Age in months as a fraction (30.44 days per month). */
export function ageInMonths(birthDate: Date, now: Date): number {
  return ageInDays(birthDate, now) / 30.44;
}

/** The usual wake window for a child of this age in months, in minutes. */
export function wakeWindowForAge(months: number): number {
  let result = WAKE_WINDOW_BY_AGE[0]!.minutes;
  for (const row of WAKE_WINDOW_BY_AGE) {
    if (months >= row.fromMonths) result = row.minutes;
  }
  return result;
}

export interface SleepEvent {
  startTime: Date;
  /** null while the sleep is running */
  endTime: Date | null;
  sleepType: "NAP" | "NIGHT";
}

export interface NextNapPrediction {
  /** Predicted time the child is ready for the next nap */
  at: Date;
  /** The wake window used, in minutes */
  wakeWindowMinutes: number;
  /** "age" when only the age table is used, "blend" when the child's own windows are included */
  basis: "age" | "blend";
  /** When the child last woke up */
  lastWakeAt: Date;
}

/**
 * Wake windows that ended in a nap, from completed sleeps in the last 72
 * hours. A window is the time from one sleep ending to the next starting.
 */
export function ownWakeWindows(sleeps: SleepEvent[], now: Date): number[] {
  const since = now.getTime() - WAKE_WINDOW_HISTORY_HOURS * HOUR;
  const completed = sleeps
    .filter((s) => s.endTime !== null && s.startTime.getTime() >= since)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  const windows: number[] = [];
  for (let i = 1; i < completed.length; i++) {
    const next = completed[i]!;
    if (next.sleepType !== "NAP") continue;
    const gap = (next.startTime.getTime() - completed[i - 1]!.endTime!.getTime()) / MINUTE;
    if (gap <= 0 || gap > MAX_WAKE_WINDOW_MINUTES) continue;
    windows.push(gap);
  }
  return windows;
}

/**
 * When the child is likely ready for the next nap: the last wake-up plus a
 * wake window for the child's age, blended with the median of the child's own
 * recent wake windows (kept within 60 to 150 percent of the age figure).
 * Returns null for children of 3 years or older, while a sleep is running,
 * when no completed sleep exists, or when the predicted time is in the
 * evening (that is bedtime, not a nap).
 */
export function predictNextNap(input: {
  birthDate: Date;
  now: Date;
  sleeps: SleepEvent[];
}): NextNapPrediction | null {
  const { birthDate, now, sleeps } = input;
  const months = ageInMonths(birthDate, now);
  if (months < 0 || months >= NAP_PREDICTION_MAX_MONTHS) return null;
  if (sleeps.some((s) => s.endTime === null)) return null;

  const lastWake = sleeps
    .filter((s) => s.endTime !== null && s.endTime.getTime() <= now.getTime())
    .reduce<Date | null>(
      (latest, s) => (!latest || s.endTime!.getTime() > latest.getTime() ? s.endTime! : latest),
      null
    );
  if (!lastWake) return null;

  const table = wakeWindowForAge(months);
  const own = ownWakeWindows(sleeps, now);
  let minutes = table;
  let basis: NextNapPrediction["basis"] = "age";
  if (own.length >= MIN_OWN_WAKE_WINDOWS) {
    minutes = Math.min(table * 1.5, Math.max(table * 0.6, (table + median(own)) / 2));
    basis = "blend";
  }

  const at = new Date(lastWake.getTime() + minutes * MINUTE);
  // No nap predictions for the night at any age; from 3 months the evening
  // from 19:30 is bedtime, not a nap
  const minuteOfDay = osloMinutesOfDay(at);
  if (isNightMinute(minuteOfDay)) return null;
  if (months >= BEDTIME_FROM_AGE_MONTHS && minuteOfDay >= BEDTIME_START) return null;

  return { at, wakeWindowMinutes: Math.round(minutes), basis, lastWakeAt: lastWake };
}

// ---------------------------------------------------------------------------
// Shared: where "now" is compared to a predicted time
// ---------------------------------------------------------------------------

/** Minutes either side of the predicted time that count as "now". */
export const PREDICTION_NOW_WINDOW_MINUTES = 15;
/** After this many minutes past the predicted time the prediction is stale and not shown. */
export const PREDICTION_STALE_MINUTES = 90;

export type PredictionPhase = "upcoming" | "now" | "late" | "stale";

/**
 * Where `now` is relative to a predicted time: still ahead, within 15
 * minutes of it, a bit past it, or so far past it that the guess is no longer
 * useful.
 */
export function predictionPhase(at: Date, now: Date): PredictionPhase {
  const diffMinutes = (now.getTime() - at.getTime()) / MINUTE;
  if (diffMinutes < -PREDICTION_NOW_WINDOW_MINUTES) return "upcoming";
  if (diffMinutes <= PREDICTION_NOW_WINDOW_MINUTES) return "now";
  if (diffMinutes <= PREDICTION_STALE_MINUTES) return "late";
  return "stale";
}
