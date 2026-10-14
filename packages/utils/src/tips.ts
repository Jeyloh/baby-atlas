import { osloDayKey } from "./oslo-day";

/** Weeks 0..52 have a weekly tip, then months 13..36 have a monthly tip. */
export const LAST_TIP_WEEK = 52;
export const FIRST_TIP_MONTH = 13;
export const LAST_TIP_MONTH = 36;

export interface TipPosition {
  /** Key inside the `tips` message namespace, for example `week.12` or `month.14` */
  key: string;
  /** Whole days since this tip's week or month started (0 on the first day) */
  daysIntoTip: number;
}

type Ymd = [number, number, number];

function parseDay(day: string): Ymd {
  return day.split("-").map(Number) as Ymd;
}

function dayNumber([y, m, d]: Ymd): number {
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The day a child born on `birth` turns `months` months old (clamped to the month's end). */
function monthStart([by, bm, bd]: Ymd, months: number): Ymd {
  const index = bm - 1 + months;
  const year = by + Math.floor(index / 12);
  const month = (index % 12) + 1;
  return [year, month, Math.min(bd, daysInMonth(year, month))];
}

/**
 * Which tip applies to a child, by calendar days in Europe/Oslo. `birthDate` is
 * a calendar date (the database stores it as midnight UTC), so its UTC date is
 * the birthday. Age in whole weeks for 0-52, else whole months for 13-36;
 * null before birth, between week 52 and month 13, and beyond month 36.
 */
export function tipPositionForAge(birthDate: Date, now: Date): TipPosition | null {
  const birth = parseDay(birthDate.toISOString().slice(0, 10));
  const today = parseDay(osloDayKey(now));
  const days = dayNumber(today) - dayNumber(birth);
  if (days < 0) return null;

  const weeks = Math.floor(days / 7);
  if (weeks <= LAST_TIP_WEEK) return { key: `week.${weeks}`, daysIntoTip: days % 7 };

  let months = (today[0] - birth[0]) * 12 + (today[1] - birth[1]);
  if (dayNumber(today) < dayNumber(monthStart(birth, months))) months -= 1;
  if (months < FIRST_TIP_MONTH || months > LAST_TIP_MONTH) return null;
  return {
    key: `month.${months}`,
    daysIntoTip: days - (dayNumber(monthStart(birth, months)) - dayNumber(birth)),
  };
}

/** The `tips` namespace key for a child's age today, or null when there is no tip. */
export function tipKeyForAge(birthDate: Date, now: Date): string | null {
  return tipPositionForAge(birthDate, now)?.key ?? null;
}
