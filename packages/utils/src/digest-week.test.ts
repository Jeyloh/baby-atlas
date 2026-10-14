import { describe, it, expect } from "vitest";
import {
  addDaysToKey,
  dateOnly,
  digestWeekToSend,
  isoWeekLabel,
  isoWeekday,
  lastFullWeekStart,
  mondayOfKey,
  osloStartOfDay,
  weekDayKeys,
} from "./digest-week";

describe("day key helpers", () => {
  it("adds days across month and year ends", () => {
    expect(addDaysToKey("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDaysToKey("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("finds the ISO weekday and Monday", () => {
    expect(isoWeekday("2026-10-12")).toBe(1);
    expect(isoWeekday("2026-10-18")).toBe(7);
    expect(mondayOfKey("2026-10-18")).toBe("2026-10-12");
    expect(mondayOfKey("2026-10-12")).toBe("2026-10-12");
  });

  it("lists the seven days of a week", () => {
    expect(weekDayKeys("2026-10-12")).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
    ]);
  });

  it("labels ISO weeks, including the year boundary", () => {
    expect(isoWeekLabel("2026-10-14")).toBe("2026-W42");
    expect(isoWeekLabel("2026-01-01")).toBe("2026-W01");
    expect(isoWeekLabel("2027-01-01")).toBe("2026-W53");
    expect(isoWeekLabel("2024-12-30")).toBe("2025-W01");
  });

  it("makes UTC midnight dates for date-only columns", () => {
    expect(dateOnly("2026-10-12").toISOString()).toBe("2026-10-12T00:00:00.000Z");
  });
});

describe("lastFullWeekStart", () => {
  it("is the Monday a week before the current week's Monday", () => {
    // Wednesday 14 October 2026
    expect(lastFullWeekStart(new Date("2026-10-14T10:00:00Z"))).toBe("2026-10-05");
    // Sunday evening is still the current week
    expect(lastFullWeekStart(new Date("2026-10-18T21:30:00Z"))).toBe("2026-10-05");
    // 22:30Z on Sunday is 00:30 Monday in Oslo, a new week
    expect(lastFullWeekStart(new Date("2026-10-18T22:30:00Z"))).toBe("2026-10-12");
  });
});

describe("osloStartOfDay", () => {
  it("is 22:00 UTC the day before in summer", () => {
    expect(osloStartOfDay("2026-07-01").toISOString()).toBe("2026-06-30T22:00:00.000Z");
  });

  it("is 23:00 UTC the day before in winter", () => {
    expect(osloStartOfDay("2026-01-15").toISOString()).toBe("2026-01-14T23:00:00.000Z");
  });

  it("handles days when the clocks change", () => {
    // Spring forward 29 March 2026, fall back 25 October 2026
    expect(osloStartOfDay("2026-03-29").toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(osloStartOfDay("2026-03-30").toISOString()).toBe("2026-03-29T22:00:00.000Z");
    expect(osloStartOfDay("2026-10-25").toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(osloStartOfDay("2026-10-26").toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });
});

describe("digestWeekToSend", () => {
  it("is null before Sunday 18:00", () => {
    expect(digestWeekToSend(new Date("2026-10-18T15:59:00Z"))).toBeNull(); // 17:59 Oslo
    expect(digestWeekToSend(new Date("2026-10-14T16:00:00Z"))).toBeNull();
  });

  it("sends the ending week from Sunday 18:00 Oslo", () => {
    expect(digestWeekToSend(new Date("2026-10-18T16:00:00Z"))).toBe("2026-10-12");
    expect(digestWeekToSend(new Date("2026-10-18T21:30:00Z"))).toBe("2026-10-12");
  });

  it("catches up on Monday morning until 12:00 Oslo", () => {
    expect(digestWeekToSend(new Date("2026-10-18T22:30:00Z"))).toBe("2026-10-12");
    expect(digestWeekToSend(new Date("2026-10-19T09:59:00Z"))).toBe("2026-10-12");
    expect(digestWeekToSend(new Date("2026-10-19T10:00:00Z"))).toBeNull();
  });

  it("uses winter time after the clocks change", () => {
    // Sunday 1 November 2026: 18:00 Oslo is 17:00Z
    expect(digestWeekToSend(new Date("2026-11-01T16:30:00Z"))).toBeNull();
    expect(digestWeekToSend(new Date("2026-11-01T17:00:00Z"))).toBe("2026-10-26");
  });
});
