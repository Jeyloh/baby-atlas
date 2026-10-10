import { describe, it, expect, vi, afterEach } from "vitest";
import { breastSideDurations } from "./use-quick-actions";
import type { ActiveTimer } from "@/stores/timer-store";

describe("breastSideDurations", () => {
  afterEach(() => vi.useRealTimers());

  it("uses the local timer's per-side totals after a side switch", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 25));
    const timer: ActiveTimer = {
      id: "t",
      type: "feeding",
      childId: "c",
      startTime: new Date(2026, 0, 1, 12, 0).getTime(),
      metadata: {
        feedingSide: "RIGHT",
        leftAccumulatedMs: 10 * 60_000,
        currentSideStartTime: new Date(2026, 0, 1, 12, 10).getTime(),
      },
    };

    expect(breastSideDurations(timer, null, 25 * 60)).toEqual({
      leftDurationSeconds: 600,
      rightDurationSeconds: 900,
    });
  });

  it("keeps the other side's stored value when only the DB record is known", () => {
    const record = { side: "RIGHT" as const, leftDurationSeconds: 600, rightDurationSeconds: 300 };
    expect(breastSideDurations(undefined, record, 1500)).toEqual({
      leftDurationSeconds: 600,
      rightDurationSeconds: 900,
    });
  });

  it("gives the whole duration to the running side when nothing is stored", () => {
    const record = { side: "LEFT" as const, leftDurationSeconds: null, rightDurationSeconds: null };
    expect(breastSideDurations(undefined, record, 1200)).toEqual({
      leftDurationSeconds: 1200,
      rightDurationSeconds: 0,
    });
  });
});
