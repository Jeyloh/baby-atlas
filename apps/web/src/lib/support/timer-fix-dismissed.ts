import { removeKeysWithPrefix } from "./browser-storage";

export const TIMER_FIX_DISMISSED_KEY = "baby-atlas-timer-fix-dismissed";
/** A "still going" answer is forgotten after this long, whatever the timer does. */
const KEEP_DAYS = 7;

/** "Still going" answers by record id: the tier that was dismissed and when. A higher tier shows the card again. */
export type TimerFixDismissals = Record<string, { tier: number; at: string }>;

function isFresh(at: string, now: Date): boolean {
  const time = new Date(at).getTime();
  return Number.isFinite(time) && time >= now.getTime() - KEEP_DAYS * 24 * 60 * 60 * 1000;
}

/** The saved answers, without those older than a week. */
export function readTimerFixDismissals(
  storage: Pick<Storage, "getItem"> | null,
  now: Date
): TimerFixDismissals {
  if (!storage) return {};
  try {
    const parsed: unknown = JSON.parse(storage.getItem(TIMER_FIX_DISMISSED_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: TimerFixDismissals = {};
    for (const [id, value] of Object.entries(parsed)) {
      // An older version saved only the tier: treat it as answered now
      if (typeof value === "number") {
        result[id] = { tier: value, at: now.toISOString() };
        continue;
      }
      const entry = value as { tier?: unknown; at?: unknown } | null;
      if (
        entry &&
        typeof entry.tier === "number" &&
        typeof entry.at === "string" &&
        isFresh(entry.at, now)
      ) {
        result[id] = { tier: entry.tier, at: entry.at };
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function writeTimerFixDismissals(
  storage: Pick<Storage, "setItem"> | null,
  value: TimerFixDismissals
): void {
  try {
    storage?.setItem(TIMER_FIX_DISMISSED_KEY, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the card simply shows again
  }
}

/** Keeps only the answers for timers that are still running. */
export function pruneTimerFixDismissals(
  value: TimerFixDismissals,
  runningIds: ReadonlySet<string>
): TimerFixDismissals {
  return Object.fromEntries(Object.entries(value).filter(([id]) => runningIds.has(id)));
}

/** Removes the saved answers from this device (used when the owner changes). */
export function clearTimerFixDismissals(storage: Storage): void {
  removeKeysWithPrefix(storage, TIMER_FIX_DISMISSED_KEY);
}
