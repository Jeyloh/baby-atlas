const OSLO_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Oslo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today in Oslo as `YYYY-MM-DD`, the value format of `<input type="date">`. */
export function todayInputValue(now: Date = new Date()): string {
  return OSLO_DATE.format(now);
}

/** Date-only database values are stored at UTC midnight. */
export function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function fromDateInputValue(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
