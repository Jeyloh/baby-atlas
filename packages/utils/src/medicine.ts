const HOUR_MS = 60 * 60 * 1000;
const WINDOW_MS = 24 * HOUR_MS;

export interface MedicineDoseRecord {
  id: string;
  time: Date;
  skipped: boolean;
}

export interface MedicineDoseSettings {
  /** Smallest gap between doses, in hours, as set by the parent */
  minIntervalHours?: number | null;
  /** Most doses in any rolling 24 hours, as set by the parent */
  maxDosesPer24h?: number | null;
}

export interface MedicineDoseStatus {
  /** Latest dose actually given at or before `at` (skipped records are ignored) */
  lastDose: { id: string; time: Date } | null;
  /** Doses given in the 24 hours up to `at` (a dose exactly 24 h ago is outside) */
  dosesLast24h: number;
  /** Earliest time the interval setting allows the next dose, or null */
  nextByInterval: Date | null;
  /** Earliest time the 24-hour limit allows the next dose, or null when not at the limit */
  nextByMax: Date | null;
  /** The later of the two, or null when nothing holds the next dose back */
  nextAllowedAt: Date | null;
  /** At `at`, the interval setting has not passed yet */
  tooSoon: boolean;
  /** At `at`, the 24-hour limit is already reached */
  maxReached: boolean;
}

/**
 * Where a medicine stands against the limits the parent entered. This only
 * compares the log with those settings; it never suggests a dose or timing.
 * `at` is the moment a dose would be given (default: now).
 */
export function medicineDoseStatus(
  records: MedicineDoseRecord[],
  settings: MedicineDoseSettings,
  at: Date = new Date()
): MedicineDoseStatus {
  const atMs = at.getTime();
  const given = records
    .filter((r) => !r.skipped && r.time.getTime() <= atMs)
    .sort((a, b) => a.time.getTime() - b.time.getTime());

  const last = given[given.length - 1];
  const lastDose = last ? { id: last.id, time: last.time } : null;

  const windowStart = atMs - WINDOW_MS;
  const inWindow = given.filter((r) => r.time.getTime() > windowStart);
  const dosesLast24h = inWindow.length;

  const { minIntervalHours, maxDosesPer24h } = settings;

  const nextByInterval =
    lastDose && minIntervalHours != null && minIntervalHours > 0
      ? new Date(lastDose.time.getTime() + minIntervalHours * HOUR_MS)
      : null;

  // At the limit, the next dose is allowed once enough old doses roll out of the window
  const maxReached = maxDosesPer24h != null && dosesLast24h >= maxDosesPer24h;
  let nextByMax: Date | null = null;
  if (maxReached) {
    const blocking = inWindow[dosesLast24h - maxDosesPer24h];
    if (blocking) nextByMax = new Date(blocking.time.getTime() + WINDOW_MS);
  }

  let nextAllowedAt: Date | null = null;
  for (const candidate of [nextByInterval, nextByMax]) {
    if (candidate && (!nextAllowedAt || candidate > nextAllowedAt)) nextAllowedAt = candidate;
  }

  const tooSoon = nextByInterval !== null && atMs < nextByInterval.getTime();

  return { lastDose, dosesLast24h, nextByInterval, nextByMax, nextAllowedAt, tooSoon, maxReached };
}
