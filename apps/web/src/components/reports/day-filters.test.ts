import { describe, it, expect } from "vitest";
import { summarizeDay, filterDay, type DayRecords } from "./day-filters";

const at = (h: number, m = 0) => new Date(2026, 9, 10, h, m);

const day: DayRecords = {
  sleepRecords: [
    { id: "s1", startTime: at(9), endTime: at(10, 30), sleepType: "NAP" },
    { id: "s2", startTime: at(13), endTime: null, sleepType: "NAP" },
  ],
  feedingRecords: [
    { id: "f1", startTime: at(8), endTime: at(8, 20), feedingType: "BREAST" },
    { id: "f2", startTime: at(11), endTime: null, feedingType: "BOTTLE", amountMl: 120 },
    { id: "f3", startTime: at(12), endTime: null, feedingType: "BOTTLE", amountMl: 90 },
    { id: "f4", startTime: at(12, 30), endTime: null, feedingType: "SOLIDS" },
  ],
  diaperRecords: [{ id: "d1", time: at(7), diaperType: "WET" }],
  pumpingRecords: [],
  medicineRecords: [],
  growthRecords: [],
  temperatureRecords: [{ id: "t1", time: at(14), temperatureCelsius: 37.2 }],
  activityRecords: [],
};

describe("summarizeDay", () => {
  it("sums durations, amounts and counts per activity", () => {
    const byFilter = Object.fromEntries(summarizeDay(day).map((i) => [i.filter, i.summary]));
    expect(byFilter.sleep).toEqual({ kind: "minutes", value: 90 });
    expect(byFilter.nursing).toEqual({ kind: "minutes", value: 20 });
    expect(byFilter.bottle).toEqual({ kind: "ml", value: 210 });
    expect(byFilter.solids).toEqual({ kind: "count", value: 1 });
    expect(byFilter.diaper).toEqual({ kind: "count", value: 1 });
  });

  it("always shows the core activities and adds others only when logged", () => {
    expect(summarizeDay(day).map((i) => i.filter)).toEqual([
      "sleep", "nursing", "bottle", "solids", "diaper", "temperature",
    ]);
  });
});

describe("filterDay", () => {
  it("shows everything when nothing is selected", () => {
    expect(filterDay(day, new Set())).toBe(day);
  });

  it("keeps only the selected types, splitting feedings by kind", () => {
    const filtered = filterDay(day, new Set(["bottle", "diaper"]));
    expect(filtered.feedingRecords.map((r) => r.id)).toEqual(["f2", "f3"]);
    expect(filtered.diaperRecords).toHaveLength(1);
    expect(filtered.sleepRecords).toHaveLength(0);
    expect(filtered.temperatureRecords).toHaveLength(0);
  });
});
