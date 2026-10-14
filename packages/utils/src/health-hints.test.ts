import { describe, it, expect } from "vitest";
import { evaluateHealthHints, type HealthHintInput } from "./health-hints";

const NOW = new Date("2026-01-15T11:00:00Z"); // 12:00 in Oslo
const hours = (n: number) => n * 3_600_000;
const ago = (h: number) => new Date(NOW.getTime() - hours(h));

const BIRTH_1_MONTH = new Date("2025-12-10T00:00:00Z"); // 36 days old
const BIRTH_NEWBORN_DAY_10 = new Date("2026-01-05T00:00:00Z");
const BIRTH_6_MONTHS = new Date("2025-07-01T00:00:00Z");

function input(overrides: Partial<HealthHintInput>): HealthHintInput {
  return {
    birthDate: BIRTH_1_MONTH,
    now: NOW,
    temperatures: [],
    diapers: [],
    feeds: [],
    ...overrides,
  };
}

const kinds = (i: HealthHintInput) => evaluateHealthHints(i).map((h) => h.kind);

describe("fever hints", () => {
  it("flags 38.0 C under 3 months as urgent", () => {
    const hints = evaluateHealthHints(
      input({ temperatures: [{ id: "t1", time: ago(1), celsius: 38.0 }] })
    );
    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({
      kind: "feverYoung",
      severity: "urgent",
      id: "feverYoung:t1",
      params: { temperature: 38 },
    });
    expect(hints[0]!.url).toContain("helsenorge.no");
  });

  it("does not flag 37.9 C under 3 months", () => {
    expect(kinds(input({ temperatures: [{ id: "t1", time: ago(1), celsius: 37.9 }] }))).toEqual([]);
  });

  it("stops showing 24 hours after the reading", () => {
    const base = { temperatures: [{ id: "t1", time: ago(24), celsius: 38.6 }] };
    expect(kinds(input(base))).toEqual([]);
    expect(kinds(input({ temperatures: [{ id: "t1", time: ago(23.9), celsius: 38.6 }] }))).toEqual([
      "feverYoung",
    ]);
  });

  it("flags a low temperature under 3 months", () => {
    expect(kinds(input({ temperatures: [{ id: "t1", time: ago(2), celsius: 34.6 }] }))).toEqual([
      "lowTemperatureYoung",
    ]);
  });

  it("uses the strict rule up to the day before 3 months", () => {
    const birth = new Date("2025-10-16T00:00:00Z"); // 3 months on 16 January
    expect(kinds(input({ birthDate: birth, temperatures: [{ id: "t", time: ago(1), celsius: 38.4 }] }))).toEqual([
      "feverYoung",
    ]);
    const birth2 = new Date("2025-10-15T00:00:00Z"); // exactly 3 months today
    expect(kinds(input({ birthDate: birth2, temperatures: [{ id: "t", time: ago(1), celsius: 38.4 }] }))).toEqual([]);
  });

  it("flags 40 C or more for older babies as info", () => {
    const hints = evaluateHealthHints(
      input({ birthDate: BIRTH_6_MONTHS, temperatures: [{ id: "t1", time: ago(2), celsius: 40.1 }] })
    );
    expect(hints.map((h) => h.kind)).toEqual(["feverVeryHigh"]);
    expect(hints[0]!.severity).toBe("info");
  });

  it("flags fever lasting 3 days or more for older babies", () => {
    const temperatures = [
      { id: "a", time: ago(80), celsius: 38.5 },
      { id: "b", time: ago(60), celsius: 38.9 },
      { id: "c", time: ago(30), celsius: 38.2 },
      { id: "d", time: ago(3), celsius: 38.4 },
    ];
    const hints = evaluateHealthHints(input({ birthDate: BIRTH_6_MONTHS, temperatures }));
    expect(hints.map((h) => h.kind)).toEqual(["feverLong"]);
    expect(hints[0]!.params.days).toBe(3);
  });

  it("does not flag fever lasting days when a normal reading breaks the run", () => {
    const temperatures = [
      { id: "a", time: ago(80), celsius: 38.5 },
      { id: "b", time: ago(60), celsius: 36.9 },
      { id: "d", time: ago(3), celsius: 38.4 },
    ];
    expect(kinds(input({ birthDate: BIRTH_6_MONTHS, temperatures }))).toEqual([]);
  });

  it("ignores ordinary fever for older babies", () => {
    expect(
      kinds(input({ birthDate: BIRTH_6_MONTHS, temperatures: [{ id: "t", time: ago(1), celsius: 39.2 }] }))
    ).toEqual([]);
  });
});

function diapers(wet: number, dirty: number, withinHours = 20) {
  return [
    ...Array.from({ length: wet }, (_, i) => ({
      time: ago((withinHours * (i + 1)) / (wet + 1)),
      diaperType: "WET" as const,
    })),
    ...Array.from({ length: dirty }, (_, i) => ({
      time: ago((withinHours * (i + 1)) / (dirty + 1) + 0.1),
      diaperType: "DIRTY" as const,
    })),
  ];
}

describe("wet diaper hint", () => {
  it("flags fewer than 6 wet diapers after day 5", () => {
    const hints = evaluateHealthHints(
      input({ birthDate: BIRTH_NEWBORN_DAY_10, diapers: diapers(4, 2) })
    );
    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({ kind: "wetDiapers", params: { count: 4, min: 6 }, id: "wetDiapers:2026-01-15" });
  });

  it("counts BOTH as wet", () => {
    const list = [
      ...diapers(4, 0),
      { time: ago(1), diaperType: "BOTH" as const },
      { time: ago(2), diaperType: "BOTH" as const },
    ];
    expect(kinds(input({ birthDate: BIRTH_NEWBORN_DAY_10, diapers: list }))).toEqual([]);
  });

  it("is quiet when 6 or more are wet", () => {
    expect(kinds(input({ birthDate: BIRTH_NEWBORN_DAY_10, diapers: diapers(6, 1) }))).toEqual([]);
  });

  it("is quiet before day 5", () => {
    const birth = new Date("2026-01-12T00:00:00Z"); // day 3
    expect(kinds(input({ birthDate: birth, diapers: diapers(2, 3) }))).toEqual([]);
  });

  it("is quiet for older babies", () => {
    expect(kinds(input({ birthDate: BIRTH_1_MONTH, diapers: diapers(3, 2) }))).toEqual([]);
  });

  it("is quiet when few diapers are logged at all", () => {
    expect(kinds(input({ birthDate: BIRTH_NEWBORN_DAY_10, diapers: diapers(2, 1) }))).toEqual([]);
  });
});

/** Feeds every 2.5 hours, the newest `lastAgo` hours ago. */
function feeds(lastAgo: number, count = 6) {
  return Array.from({ length: count }, (_, i) => ({ startTime: ago(lastAgo + i * 2.5) }));
}

describe("feeding gap hint", () => {
  it("flags a gap over 4 hours that is much longer than the usual interval", () => {
    const hints = evaluateHealthHints(input({ birthDate: BIRTH_NEWBORN_DAY_10, feeds: feeds(4.6) }));
    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({ kind: "feedingGap", params: { hours: 4 } });
    expect(hints[0]!.id).toBe(`feedingGap:${ago(4.6).getTime()}`);
  });

  it("is quiet for a gap that is long but not much longer than usual", () => {
    // Usual interval 3 h, gap 4.5 h: below 1.75 x 3 = 5.25 h
    const list = Array.from({ length: 6 }, (_, i) => ({ startTime: ago(4.5 + i * 3) }));
    expect(kinds(input({ birthDate: BIRTH_NEWBORN_DAY_10, feeds: list }))).toEqual([]);
  });

  it("is quiet for a gap under 4 hours", () => {
    const list = Array.from({ length: 6 }, (_, i) => ({ startTime: ago(3.5 + i * 1.5) }));
    expect(kinds(input({ birthDate: BIRTH_NEWBORN_DAY_10, feeds: list }))).toEqual([]);
  });

  it("is quiet while a feed is running", () => {
    expect(
      kinds(input({ birthDate: BIRTH_NEWBORN_DAY_10, feeds: feeds(4.6), feedingActive: true }))
    ).toEqual([]);
  });

  it("is quiet at night", () => {
    const night = new Date("2026-01-15T02:00:00Z"); // 03:00 Oslo
    const list = Array.from({ length: 6 }, (_, i) => ({
      startTime: new Date(night.getTime() - hours(4.6 + i * 2.5)),
    }));
    expect(
      evaluateHealthHints(input({ birthDate: BIRTH_NEWBORN_DAY_10, now: night, feeds: list }))
    ).toEqual([]);
  });

  it("is quiet for babies over 2 months", () => {
    const birth = new Date("2025-10-01T00:00:00Z");
    expect(kinds(input({ birthDate: birth, feeds: feeds(4.6) }))).toEqual([]);
  });

  it("needs at least four feeds", () => {
    expect(kinds(input({ birthDate: BIRTH_NEWBORN_DAY_10, feeds: feeds(4.6, 3) }))).toEqual([]);
  });

  it("measures from the end of the latest feed when known", () => {
    const list = feeds(4.6).map((f, i) => (i === 0 ? { ...f, endTime: ago(3.8) } : f));
    expect(kinds(input({ birthDate: BIRTH_NEWBORN_DAY_10, feeds: list }))).toEqual([]);
  });
});

describe("ordering", () => {
  it("puts urgent hints first", () => {
    const hints = evaluateHealthHints(
      input({
        birthDate: BIRTH_NEWBORN_DAY_10,
        diapers: diapers(3, 2),
        temperatures: [{ id: "t", time: ago(1), celsius: 38.3 }],
      })
    );
    expect(hints.map((h) => h.kind)).toEqual(["feverYoung", "wetDiapers"]);
  });
});
