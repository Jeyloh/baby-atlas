import { describe, it, expect } from "vitest";
import { compareValues, parseWeekParam } from "./digest-utils";

describe("compareValues", () => {
  it("is none when a week has no number", () => {
    expect(compareValues(null, 5).direction).toBe("none");
    expect(compareValues(5, null).direction).toBe("none");
  });

  it("reports the direction and size of the change", () => {
    expect(compareValues(8, 6)).toEqual({ direction: "up", amount: 2 });
    expect(compareValues(6, 8.5)).toEqual({ direction: "down", amount: 2.5 });
  });

  it("treats a tiny difference as the same", () => {
    expect(compareValues(6.02, 6).direction).toBe("same");
    expect(compareValues(6, 6).direction).toBe("same");
  });

  it("uses the given tolerance", () => {
    expect(compareValues(305, 300, 10).direction).toBe("same");
    expect(compareValues(320, 300, 10).direction).toBe("up");
  });
});

describe("parseWeekParam", () => {
  it("accepts a date and rejects anything else", () => {
    expect(parseWeekParam("2026-10-12")).toBe("2026-10-12");
    expect(parseWeekParam(["2026-10-12", "x"])).toBe("2026-10-12");
    expect(parseWeekParam("last week")).toBeUndefined();
    expect(parseWeekParam(undefined)).toBeUndefined();
  });
});
