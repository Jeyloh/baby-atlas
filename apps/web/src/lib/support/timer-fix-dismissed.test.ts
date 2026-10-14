import { describe, expect, it } from "vitest";
import {
  clearTimerFixDismissals,
  pruneTimerFixDismissals,
  readTimerFixDismissals,
  TIMER_FIX_DISMISSED_KEY,
  writeTimerFixDismissals,
} from "./timer-fix-dismissed";

const NOW = new Date("2026-01-15T11:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

describe("timer fix dismissals", () => {
  it("starts empty, also without storage or with broken data", () => {
    expect(readTimerFixDismissals(memoryStorage(), NOW)).toEqual({});
    expect(readTimerFixDismissals(null, NOW)).toEqual({});
    expect(
      readTimerFixDismissals(memoryStorage({ [TIMER_FIX_DISMISSED_KEY]: "{oops" }), NOW)
    ).toEqual({});
  });

  it("round-trips the saved answers", () => {
    const storage = memoryStorage();
    const value = { r1: { tier: 1, at: daysAgo(1) } };
    writeTimerFixDismissals(storage, value);
    expect(readTimerFixDismissals(storage, NOW)).toEqual(value);
  });

  it("drops answers older than 7 days", () => {
    const storage = memoryStorage();
    writeTimerFixDismissals(storage, {
      old: { tier: 1, at: daysAgo(8) },
      fresh: { tier: 2, at: daysAgo(6) },
    });
    expect(Object.keys(readTimerFixDismissals(storage, NOW))).toEqual(["fresh"]);
  });

  it("keeps an answer saved in the older format, as answered now", () => {
    const storage = memoryStorage({ [TIMER_FIX_DISMISSED_KEY]: JSON.stringify({ r1: 1 }) });
    expect(readTimerFixDismissals(storage, NOW)).toEqual({
      r1: { tier: 1, at: NOW.toISOString() },
    });
  });

  it("prunes answers for timers that are no longer running", () => {
    const value = { a: { tier: 1, at: daysAgo(0) }, b: { tier: 2, at: daysAgo(0) } };
    expect(Object.keys(pruneTimerFixDismissals(value, new Set(["b"])))).toEqual(["b"]);
  });

  it("clears the key", () => {
    localStorage.setItem(TIMER_FIX_DISMISSED_KEY, "{}");
    localStorage.setItem("other", "keep");
    clearTimerFixDismissals(localStorage);
    expect(localStorage.getItem(TIMER_FIX_DISMISSED_KEY)).toBeNull();
    expect(localStorage.getItem("other")).toBe("keep");
    localStorage.clear();
  });
});
