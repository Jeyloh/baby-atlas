export const OSLO_TIME_ZONE = "Europe/Oslo";

const osloDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: OSLO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The calendar day in Oslo for an instant, as YYYY-MM-DD. */
export function osloDayKey(date: Date): string {
  return osloDayFormatter.format(date);
}

/**
 * The last `days` Oslo calendar days ending today, oldest first, as
 * YYYY-MM-DD. Steps back by calendar day rather than 24 hours, because Oslo
 * days are 23 or 25 hours long when daylight saving time changes.
 */
export function lastOsloDayKeys(days: number, now: Date): string[] {
  const [y, m, d] = osloDayKey(now).split("-").map(Number) as [number, number, number];
  return Array.from({ length: days }, (_, i) =>
    new Date(Date.UTC(y, m - 1, d - (days - 1 - i))).toISOString().slice(0, 10)
  );
}
