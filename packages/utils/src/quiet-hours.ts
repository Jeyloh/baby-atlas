import { OSLO_TIME_ZONE } from "./oslo-day";

const osloClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: OSLO_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Minutes after midnight in Oslo for an instant (0..1439). */
export function osloMinutesOfDay(date: Date): number {
  const parts = osloClock.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return (hour % 24) * 60 + minute;
}

/**
 * Whether an instant falls inside quiet hours, given as minutes after
 * midnight in Oslo. The start is included and the end is not. A range can
 * cross midnight (22:00 to 07:00). No range (null, or start equal to end)
 * means there are no quiet hours.
 */
export function isInQuietHours(
  date: Date,
  quietStart: number | null,
  quietEnd: number | null
): boolean {
  if (quietStart === null || quietEnd === null || quietStart === quietEnd) return false;
  const minutes = osloMinutesOfDay(date);
  if (quietStart < quietEnd) return minutes >= quietStart && minutes < quietEnd;
  return minutes >= quietStart || minutes < quietEnd;
}

/** 1320 -> "22:00" (24-hour clock, for time inputs). */
export function formatMinutesOfDay(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "22:00" -> 1320, or null when the text is not a valid HH:MM time. */
export function parseMinutesOfDay(text: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(text);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}
