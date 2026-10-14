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

export interface MedicineDoseCheck {
  /** Nearest given dose at or before `at` */
  previousDose: { id: string; time: Date } | null;
  /** Nearest given dose after `at` (only when a dose is back-dated) */
  laterDose: { id: string; time: Date } | null;
  /** The previous dose is closer than the interval setting */
  tooSoonAfterPrevious: boolean;
  /** Earliest time the interval setting allows after the previous dose */
  allowedFrom: Date | null;
  /** The later dose is closer than the interval setting */
  tooCloseToLater: boolean;
  /** The most doses already given in any 24 h window that includes `at` */
  maxInWindow: number;
  /** Adding a dose at `at` would put some 24 h window over the limit */
  overMax: boolean;
  /** Any of the above: worth asking before saving */
  needsConfirm: boolean;
}

/**
 * Checks a dose about to be saved at `at` (possibly back-dated) against the
 * doses on both sides of it: the interval to the nearest dose before and after,
 * and the limit in every rolling 24 h window that contains `at`.
 */
export function medicineDoseCheck(
  records: MedicineDoseRecord[],
  settings: MedicineDoseSettings,
  at: Date
): MedicineDoseCheck {
  const atMs = at.getTime();
  const given = records
    .filter((r) => !r.skipped)
    .sort((a, b) => a.time.getTime() - b.time.getTime());

  const before = given.filter((r) => r.time.getTime() <= atMs);
  const after = given.filter((r) => r.time.getTime() > atMs);
  const prev = before[before.length - 1];
  const later = after[0];

  const { minIntervalHours, maxDosesPer24h } = settings;
  const intervalMs =
    minIntervalHours != null && minIntervalHours > 0 ? minIntervalHours * HOUR_MS : null;

  const allowedFrom =
    prev && intervalMs !== null ? new Date(prev.time.getTime() + intervalMs) : null;
  const tooSoonAfterPrevious = allowedFrom !== null && atMs < allowedFrom.getTime();
  const tooCloseToLater =
    later !== undefined && intervalMs !== null && later.time.getTime() - atMs < intervalMs;

  // Windows [start, start + 24 h) that contain `at` start at `at` or at an
  // existing dose less than 24 h before it. The fullest one decides.
  const starts = [
    atMs,
    ...given.map((r) => r.time.getTime()).filter((t) => t <= atMs && t > atMs - WINDOW_MS),
  ];
  let maxInWindow = 0;
  for (const start of starts) {
    const count = given.filter((r) => {
      const t = r.time.getTime();
      return t >= start && t < start + WINDOW_MS;
    }).length;
    if (count > maxInWindow) maxInWindow = count;
  }
  const overMax = maxDosesPer24h != null && maxInWindow >= maxDosesPer24h;

  return {
    previousDose: prev ? { id: prev.id, time: prev.time } : null,
    laterDose: later ? { id: later.id, time: later.time } : null,
    tooSoonAfterPrevious,
    allowedFrom,
    tooCloseToLater,
    maxInWindow,
    overMax,
    needsConfirm: tooSoonAfterPrevious || tooCloseToLater || overMax,
  };
}
