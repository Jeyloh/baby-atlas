import { describe, expect, it } from "vitest";
import { tipKeyForAge, tipPositionForAge } from "./tips";

const birth = new Date("2026-01-10T00:00:00.000Z");

describe("tipKeyForAge", () => {
  it("uses week 0 for the first seven days", () => {
    expect(tipKeyForAge(birth, new Date("2026-01-10T12:00:00Z"))).toBe("week.0");
    expect(tipKeyForAge(birth, new Date("2026-01-16T12:00:00Z"))).toBe("week.0");
    expect(tipKeyForAge(birth, new Date("2026-01-17T12:00:00Z"))).toBe("week.1");
  });

  it("is null before birth", () => {
    expect(tipKeyForAge(birth, new Date("2026-01-08T12:00:00Z"))).toBeNull();
  });

  it("switches week at midnight Oslo, not UTC (winter, UTC+1)", () => {
    expect(tipKeyForAge(birth, new Date("2026-01-16T22:59:00Z"))).toBe("week.0");
    expect(tipKeyForAge(birth, new Date("2026-01-16T23:00:00Z"))).toBe("week.1");
  });

  it("switches week at midnight Oslo in summer (UTC+2)", () => {
    const summer = new Date("2026-06-01T00:00:00.000Z");
    expect(tipKeyForAge(summer, new Date("2026-06-07T21:59:00Z"))).toBe("week.0");
    expect(tipKeyForAge(summer, new Date("2026-06-07T22:00:00Z"))).toBe("week.1");
  });

  it("keeps the week 52 tip until month 13 starts", () => {
    expect(tipKeyForAge(birth, new Date("2027-01-15T12:00:00Z"))).toBe("week.52");
    // day 371: the first day after week 52
    expect(tipPositionForAge(birth, new Date("2027-01-16T12:00:00Z"))).toEqual({
      key: "week.52",
      daysIntoTip: 7,
    });
    // the day before month 13
    expect(tipPositionForAge(birth, new Date("2027-02-09T12:00:00Z"))).toEqual({
      key: "week.52",
      daysIntoTip: 31,
    });
  });

  it("starts month 13 on the 13-month birthday and runs to month 36", () => {
    expect(tipKeyForAge(birth, new Date("2027-02-10T12:00:00Z"))).toBe("month.13");
    expect(tipKeyForAge(birth, new Date("2027-03-09T12:00:00Z"))).toBe("month.13");
    expect(tipKeyForAge(birth, new Date("2027-03-10T12:00:00Z"))).toBe("month.14");
    expect(tipKeyForAge(birth, new Date("2029-01-10T12:00:00Z"))).toBe("month.36");
    expect(tipKeyForAge(birth, new Date("2029-02-10T12:00:00Z"))).toBeNull();
  });

  it("clamps month starts for children born late in the month", () => {
    const late = new Date("2026-01-31T00:00:00.000Z");
    expect(tipKeyForAge(late, new Date("2027-02-27T12:00:00Z"))).toBe("week.52");
    expect(tipKeyForAge(late, new Date("2027-03-30T12:00:00Z"))).toBe("month.13");
    expect(tipKeyForAge(late, new Date("2027-03-31T12:00:00Z"))).toBe("month.14");
    expect(tipKeyForAge(late, new Date("2027-04-29T12:00:00Z"))).toBe("month.14");
    expect(tipKeyForAge(late, new Date("2027-04-30T12:00:00Z"))).toBe("month.15");
  });
});

describe("tipPositionForAge", () => {
  it("counts days into the week", () => {
    expect(tipPositionForAge(birth, new Date("2026-01-17T12:00:00Z"))).toEqual({
      key: "week.1",
      daysIntoTip: 0,
    });
    expect(tipPositionForAge(birth, new Date("2026-01-20T12:00:00Z"))?.daysIntoTip).toBe(3);
  });

  it("counts days into the month", () => {
    expect(tipPositionForAge(birth, new Date("2027-03-12T12:00:00Z"))).toEqual({
      key: "month.14",
      daysIntoTip: 2,
    });
  });
});
