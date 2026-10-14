import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { RunningTimer } from "@/hooks/use-running-timers";

const mocks = vi.hoisted(() => ({
  userId: "user1" as string | undefined,
  updateFeeding: vi.fn(),
  endActivity: vi.fn(),
  invalidate: vi.fn(async () => undefined),
}));

vi.mock("@/lib/trpc/provider", () => ({
  trpc: {
    useUtils: () => ({
      timeline: { invalidate: mocks.invalidate },
      feeding: { invalidate: mocks.invalidate },
      activity: { invalidate: mocks.invalidate },
    }),
    feeding: { update: { useMutation: () => ({ mutateAsync: mocks.updateFeeding }) } },
    activity: { end: { useMutation: () => ({ mutateAsync: mocks.endActivity }) } },
  },
}));
vi.mock("@/hooks/use-last-activities", () => ({ useUserId: () => mocks.userId }));

import { useFixTimer, FixTimerUnavailableError } from "./use-fix-timer";
import { useOutbox } from "@/lib/offline/outbox";
import { useTimerStore } from "@/stores/timer-store";

const START = new Date("2026-03-01T10:00:00Z");
const END = new Date("2026-03-01T11:00:00Z");

function timer(overrides: Partial<RunningTimer>): RunningTimer {
  return {
    kind: "sleep",
    recordId: "rec1",
    startTime: START,
    sleepType: "NAP",
    side: null,
    activityType: null,
    key: "nap",
    thresholdMin: 180,
    tier: 1,
    ...overrides,
  } as RunningTimer;
}

describe("useFixTimer", () => {
  beforeEach(() => {
    mocks.userId = "user1";
    vi.clearAllMocks();
    useOutbox.setState({ entries: [] });
    useTimerStore.setState({ timers: {} });
  });

  it("queues sleep.end at the chosen time and clears the matching local timer", async () => {
    const localId = useTimerStore.getState().startTimer({
      type: "sleep",
      childId: "child1",
      recordId: "rec1",
      startTime: START.getTime(),
    });
    const otherId = useTimerStore.getState().startTimer({
      type: "pumping",
      childId: "child1",
      recordId: "other",
      startTime: START.getTime(),
    });
    const { result } = renderHook(() => useFixTimer("child1"));

    await act(() => result.current(timer({}), END));

    expect(useOutbox.getState().entries).toMatchObject([
      { userId: "user1", childId: "child1", recordId: "rec1", op: { path: "sleep.end", input: { id: "rec1", endTime: END } } },
    ]);
    expect(useTimerStore.getState().timers[localId]).toBeUndefined();
    expect(useTimerStore.getState().timers[otherId]).toBeDefined();
  });

  it("still stops a timer that exists only in the database", async () => {
    const { result } = renderHook(() => useFixTimer("child1"));
    await act(() => result.current(timer({ kind: "pumping" }), END));
    expect(useOutbox.getState().entries[0].op).toEqual({
      path: "pumping.end",
      input: { id: "rec1", endTime: END },
    });
  });

  it("ends a breastfeed with side durations that add up to the corrected length", async () => {
    const { result } = renderHook(() => useFixTimer("child1"));
    await act(() =>
      result.current(
        timer({ kind: "breast", side: "RIGHT", leftDurationSeconds: 600, rightDurationSeconds: 0 }),
        END
      )
    );
    expect(useOutbox.getState().entries[0].op).toEqual({
      path: "feeding.endBreastfeeding",
      input: { id: "rec1", endTime: END, leftDurationSeconds: 600, rightDurationSeconds: 3000 },
    });
  });

  it("uses the mutations for bottle feeds and activities, then refreshes queries", async () => {
    const { result } = renderHook(() => useFixTimer("child1"));

    await act(() => result.current(timer({ kind: "bottle" }), END));
    expect(mocks.updateFeeding).toHaveBeenCalledWith({ id: "rec1", endTime: END });

    await act(() => result.current(timer({ kind: "activity" }), END));
    expect(mocks.endActivity).toHaveBeenCalledWith({ id: "rec1", endTime: END });

    expect(useOutbox.getState().entries).toEqual([]);
    expect(mocks.invalidate).toHaveBeenCalled();
  });

  it("fails without queueing when the signed-in user is not known", async () => {
    mocks.userId = undefined;
    const { result } = renderHook(() => useFixTimer("child1"));

    await expect(act(() => result.current(timer({}), END))).rejects.toBeInstanceOf(
      FixTimerUnavailableError
    );
    expect(useOutbox.getState().entries).toEqual([]);
  });

  it("does not clear the local timer when the mutation fails", async () => {
    mocks.endActivity.mockRejectedValueOnce(new Error("offline"));
    const localId = useTimerStore.getState().startTimer({
      type: "activity",
      childId: "child1",
      recordId: "rec1",
      startTime: START.getTime(),
    });
    const { result } = renderHook(() => useFixTimer("child1"));

    await expect(act(() => result.current(timer({ kind: "activity" }), END))).rejects.toThrow("offline");
    expect(useTimerStore.getState().timers[localId]).toBeDefined();
  });
});
