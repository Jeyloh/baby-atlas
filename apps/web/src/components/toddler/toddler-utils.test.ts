import { describe, expect, it } from "vitest";
import { cumulativeVocabulary, countByCategory, filterByCategory } from "./speech-utils";
import { ageInMonths, readinessLevel, summarizeReadiness } from "./potty-utils";
import { buildVaccineTimeline } from "./vaccine-utils";
import { todayInputValue } from "./date-input";

const d = (iso: string) => new Date(iso);

describe("cumulativeVocabulary", () => {
  it("returns an empty series without words", () => {
    expect(cumulativeVocabulary([])).toEqual([]);
  });

  it("accumulates per day in date order", () => {
    const series = cumulativeVocabulary([
      { firstSaidAt: d("2026-03-10") },
      { firstSaidAt: d("2026-03-01") },
      { firstSaidAt: d("2026-03-10") },
      { firstSaidAt: d("2026-04-02") },
    ]);
    expect(series).toEqual([
      { date: "2026-03-01", count: 1 },
      { date: "2026-03-10", count: 3 },
      { date: "2026-04-02", count: 4 },
    ]);
  });
});

describe("speech helpers", () => {
  const words = [
    { id: "1", word: "mamma", category: "WORD" as const, firstSaidAt: d("2026-01-01"), createdAt: d("2026-01-01") },
    { id: "2", word: "brum", category: "SOUND" as const, firstSaidAt: d("2026-01-02"), createdAt: d("2026-01-02") },
  ];
  it("filters and counts by category", () => {
    expect(filterByCategory(words, "SOUND")).toHaveLength(1);
    expect(filterByCategory(words, "ALL")).toHaveLength(2);
    expect(countByCategory(words)).toEqual({ WORD: 1, SOUND: 1, SIGN: 0 });
  });
});

describe("summarizeReadiness", () => {
  const now = d("2026-06-15T12:00:00Z");

  it("counts signals seen in the last 14 days", () => {
    const summary = summarizeReadiness(
      [
        { time: d("2026-06-14T08:00:00Z"), signals: ["DRY_TWO_HOURS", "INTEREST_IN_TOILET"] },
        { time: d("2026-06-10T08:00:00Z"), signals: ["DRY_TWO_HOURS"] },
        { time: d("2026-05-20T08:00:00Z"), signals: ["ANNOUNCES_NEED"] },
      ],
      now
    );
    expect(summary.seenCount).toBe(2);
    expect(summary.totalCount).toBe(6);
    const bySignal = Object.fromEntries(summary.signals.map((s) => [s.signal, s.count]));
    expect(bySignal.DRY_TWO_HOURS).toBe(2);
    expect(bySignal.INTEREST_IN_TOILET).toBe(1);
    expect(bySignal.ANNOUNCES_NEED).toBe(0);
  });

  it("ignores logs in the future", () => {
    const summary = summarizeReadiness(
      [{ time: d("2026-07-01T00:00:00Z"), signals: ["HIDES_TO_POOP"] }],
      now
    );
    expect(summary.seenCount).toBe(0);
  });

  it("maps seen counts to levels", () => {
    expect(readinessLevel(0)).toBe("none");
    expect(readinessLevel(2)).toBe("few");
    expect(readinessLevel(4)).toBe("some");
    expect(readinessLevel(6)).toBe("many");
  });
});

describe("ageInMonths", () => {
  it("counts whole months", () => {
    expect(ageInMonths(d("2025-01-15"), d("2026-07-14"))).toBe(17);
    expect(ageInMonths(d("2025-01-15"), d("2026-07-15"))).toBe(18);
  });
});

describe("buildVaccineTimeline", () => {
  const birth = d("2026-01-01");

  it("groups doses by due age", () => {
    const groups = buildVaccineTimeline(birth, [], d("2026-01-02"));
    expect(groups.map((g) => g.id)).toEqual(["w6", "m3", "m5", "m12", "m15"]);
    expect(groups.find((g) => g.id === "m3")?.doses).toHaveLength(3);
  });

  it("marks recorded doses as given", () => {
    const groups = buildVaccineTimeline(
      birth,
      [{ vaccineKey: "rotavirus-1", givenAt: d("2026-02-12") }],
      d("2026-06-01")
    );
    const first = groups[0]!.doses[0]!;
    expect(first.status).toBe("given");
    expect(first.givenAt).toEqual(d("2026-02-12"));
    expect(groups[0]!.doses[0]!.dueDate).toEqual(d("2026-02-12"));
  });

  it("flags missed doses as overdue", () => {
    const groups = buildVaccineTimeline(birth, [], d("2026-06-01"));
    expect(groups[0]!.doses[0]!.status).toBe("overdue");
  });
});

describe("todayInputValue", () => {
  it("uses the Oslo calendar day", () => {
    expect(todayInputValue(d("2026-06-15T22:30:00Z"))).toBe("2026-06-16");
  });
});
