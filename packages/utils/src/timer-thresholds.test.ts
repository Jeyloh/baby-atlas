import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIMER_THRESHOLD_MINUTES,
  endTimeProblem,
  fixTimerParam,
  parseFixTimerParam,
  suggestedEndTime,
  thresholdMinutes,
  tierReachedAt,
  timerRecordType,
  timerThresholdKey,
  timerTier,
} from "./timer-thresholds";

const start = new Date("2026-03-01T10:00:00Z");
const minutesAfter = (min: number) => new Date(start.getTime() + min * 60_000);

describe("timerThresholdKey", () => {
  it("separates naps from night sleep and defaults to nap", () => {
    expect(timerThresholdKey("sleep", "NIGHT")).toBe("nightSleep");
    expect(timerThresholdKey("sleep", "NAP")).toBe("nap");
    expect(timerThresholdKey("sleep")).toBe("nap");
  });

  it("maps the other kinds", () => {
    expect(timerThresholdKey("breast")).toBe("breastfeeding");
    expect(timerThresholdKey("bottle")).toBe("bottle");
    expect(timerThresholdKey("pumping")).toBe("pumping");
    expect(timerThresholdKey("activity")).toBe("activity");
  });
});

describe("thresholdMinutes", () => {
  it("uses defaults without overrides", () => {
    expect(thresholdMinutes("nap")).toBe(DEFAULT_TIMER_THRESHOLD_MINUTES.nap);
    expect(thresholdMinutes("nap", {})).toBe(DEFAULT_TIMER_THRESHOLD_MINUTES.nap);
    expect(thresholdMinutes("nap", null)).toBe(DEFAULT_TIMER_THRESHOLD_MINUTES.nap);
  });

  it("uses a valid override for that type only", () => {
    expect(thresholdMinutes("nap", { nap: 90 })).toBe(90);
    expect(thresholdMinutes("bottle", { nap: 90 })).toBe(DEFAULT_TIMER_THRESHOLD_MINUTES.bottle);
  });

  it("ignores nonsense overrides", () => {
    expect(thresholdMinutes("nap", { nap: 0 })).toBe(DEFAULT_TIMER_THRESHOLD_MINUTES.nap);
    expect(thresholdMinutes("nap", { nap: Number.NaN })).toBe(DEFAULT_TIMER_THRESHOLD_MINUTES.nap);
    expect(thresholdMinutes("nap", { nap: -5 })).toBe(DEFAULT_TIMER_THRESHOLD_MINUTES.nap);
  });
});

describe("timerTier", () => {
  it("is 0 below the threshold", () => {
    expect(timerTier(start, minutesAfter(59), 60)).toBe(0);
  });

  it("is 1 from the threshold up to twice the threshold", () => {
    expect(timerTier(start, minutesAfter(60), 60)).toBe(1);
    expect(timerTier(start, minutesAfter(119), 60)).toBe(1);
  });

  it("is 2 from twice the threshold and stays 2", () => {
    expect(timerTier(start, minutesAfter(120), 60)).toBe(2);
    expect(timerTier(start, minutesAfter(5000), 60)).toBe(2);
  });
});

describe("tierReachedAt", () => {
  it("adds one or two thresholds to the start", () => {
    expect(tierReachedAt(start, 60, 1)).toEqual(minutesAfter(60));
    expect(tierReachedAt(start, 60, 2)).toEqual(minutesAfter(120));
  });
});

describe("suggestedEndTime", () => {
  it("is start plus a typical length for an old timer", () => {
    expect(suggestedEndTime(start, minutesAfter(600), "nap")).toEqual(minutesAfter(60));
  });

  it("never passes now", () => {
    expect(suggestedEndTime(start, minutesAfter(10), "nap")).toEqual(minutesAfter(10));
  });
});

describe("endTimeProblem", () => {
  const now = minutesAfter(300);

  it("accepts an end between start and now, now included", () => {
    expect(endTimeProblem(start, minutesAfter(60), now)).toBeNull();
    expect(endTimeProblem(start, now, now)).toBeNull();
  });

  it("rejects an end at or before the start", () => {
    expect(endTimeProblem(start, start, now)).toBe("beforeStart");
    expect(endTimeProblem(start, minutesAfter(-5), now)).toBe("beforeStart");
  });

  it("rejects an end in the future", () => {
    expect(endTimeProblem(start, minutesAfter(301), now)).toBe("inFuture");
  });

  it("rejects an invalid date", () => {
    expect(endTimeProblem(start, new Date("nope"), now)).toBe("invalid");
  });
});

describe("fixTimer param", () => {
  it("round-trips a type and record id", () => {
    expect(fixTimerParam("sleep", "clx123")).toBe("sleep:clx123");
    expect(parseFixTimerParam("feeding:clx123")).toEqual({ type: "feeding", recordId: "clx123" });
  });

  it("rejects malformed values", () => {
    expect(parseFixTimerParam(null)).toBeNull();
    expect(parseFixTimerParam("")).toBeNull();
    expect(parseFixTimerParam("sleep")).toBeNull();
    expect(parseFixTimerParam("medicine:clx123")).toBeNull();
    expect(parseFixTimerParam("sleep:")).toBeNull();
    expect(parseFixTimerParam("sleep:a b")).toBeNull();
    expect(parseFixTimerParam("sleep:../x")).toBeNull();
  });

  it("stores breast and bottle feeds as feeding", () => {
    expect(timerRecordType("breast")).toBe("feeding");
    expect(timerRecordType("bottle")).toBe("feeding");
    expect(timerRecordType("sleep")).toBe("sleep");
    expect(timerRecordType("activity")).toBe("activity");
  });
});
