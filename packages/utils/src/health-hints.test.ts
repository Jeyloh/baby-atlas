import { describe, it, expect } from "vitest";
import { evaluateHealthHints, minWetDiapersForAge, type HealthHintInput } from "./health-hints";

const NOW = new Date("2026-01-15T11:00:00Z"); // 12:00 in Oslo
const hours = (n: number) => n * 3_600_000;
const ago = (h: number) => new Date(NOW.getTime() - hours(h));

const BIRTH_1_MONTH = new Date("2025-12-10T00:00:00Z"); // 36 days old
const BIRTH_NEWBORN_DAY_10 = new Date("2026-01-05T00:00:00Z");
const BIRTH_4_MONTHS = new Date("2025-09-10T00:00:00Z");
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
const reading = (id: string, hoursAgo: number, celsius: number) => ({ id, time: ago(hoursAgo), celsius });

describe("fever hints", () => {
  it("flags 38.0 C under 3 months as urgent", () => {
    const hints = evaluateHealthHints(input({ temperatures: [reading("t1", 1, 38.0)] }));
    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({
      kind: "feverYoung",
      severity: "urgent",
      emergency: true,
      id: "feverYoung:t1",
      params: { temperature: 38 },
      source: "helsenorge",
    });
    expect(hints[0]!.url).toContain("helsenorge.no");
  });

  it("does not flag 37.9 C under 3 months", () => {
    expect(kinds(input({ temperatures: [reading("t1", 1, 37.9)] }))).toEqual([]);
  });

  it("stops showing 24 hours after the reading", () => {
    expect(kinds(input({ temperatures: [reading("t1", 24, 38.6)] }))).toEqual([]);
    expect(kinds(input({ temperatures: [reading("t1", 23.9, 38.6)] }))).toEqual(["feverYoung"]);
  });

  it("flags a temperature under 35 C under 3 months as urgent", () => {
    const hints = evaluateHealthHints(input({ temperatures: [reading("t1", 2, 34.6)] }));
    expect(hints.map((h) => h.kind)).toEqual(["lowTemperatureYoung"]);
    expect(hints[0]!.severity).toBe("urgent");
  });

  it("gives an info hint for 35.0 to 35.9 C under 3 months", () => {
    for (const celsius of [35.0, 35.5, 35.9]) {
      const hints = evaluateHealthHints(input({ temperatures: [reading("t1", 2, celsius)] }));
      expect(hints.map((h) => h.kind)).toEqual(["coolTemperatureYoung"]);
      expect(hints[0]).toMatchObject({ severity: "info", emergency: false });
    }
    expect(kinds(input({ temperatures: [reading("t1", 2, 36.0)] }))).toEqual([]);
  });

  it("shows only the urgent low hint when a reading is under 35 C", () => {
    const temperatures = [reading("a", 3, 34.8), reading("b", 2, 35.5)];
    expect(kinds(input({ temperatures }))).toEqual(["lowTemperatureYoung"]);
  });

  it("applies the strict rule through the day of the 3-month birthday", () => {
    const hot = [reading("t", 1, 38.4)];
    // 3 months old today (15 January)
    expect(kinds(input({ birthDate: new Date("2025-10-15T00:00:00Z"), temperatures: hot }))).toEqual(["feverYoung"]);
    // 3 months and a day
    expect(kinds(input({ birthDate: new Date("2025-10-14T00:00:00Z"), temperatures: hot }))).toEqual([]);
    // The day before the birthday
    expect(kinds(input({ birthDate: new Date("2025-10-16T00:00:00Z"), temperatures: hot }))).toEqual(["feverYoung"]);
  });

  it("gives an info hint at 39.0 C or more from 3 to 6 months", () => {
    const hints = evaluateHealthHints(
      input({ birthDate: BIRTH_4_MONTHS, temperatures: [reading("t1", 2, 39.0)] })
    );
    expect(hints.map((h) => h.kind)).toEqual(["feverInfant"]);
    expect(hints[0]).toMatchObject({ severity: "info", emergency: true, params: { temperature: 39 } });
    expect(kinds(input({ birthDate: BIRTH_4_MONTHS, temperatures: [reading("t1", 2, 38.9)] }))).toEqual([]);
  });

  it("does not use the 39 C rule from 6 months", () => {
    expect(kinds(input({ birthDate: BIRTH_6_MONTHS, temperatures: [reading("t1", 1, 39.4)] }))).toEqual([]);
  });

  it("shows only the very high fever hint at 40 C for a 4-month-old", () => {
    expect(kinds(input({ birthDate: BIRTH_4_MONTHS, temperatures: [reading("t1", 1, 40.2)] }))).toEqual([
      "feverVeryHigh",
    ]);
  });

  it("flags 40 C or more for older babies as info with the 113 button", () => {
    const hints = evaluateHealthHints(
      input({ birthDate: BIRTH_6_MONTHS, temperatures: [reading("t1", 2, 40.1)] })
    );
    expect(hints.map((h) => h.kind)).toEqual(["feverVeryHigh"]);
    expect(hints[0]).toMatchObject({ severity: "info", emergency: true });
    expect(hints[0]!.url).toContain("helsenorge.no/sykdom/barn/feber-hos-barn");
  });

  it("ignores ordinary fever for older babies", () => {
    expect(kinds(input({ birthDate: BIRTH_6_MONTHS, temperatures: [reading("t", 1, 39.2)] }))).toEqual([]);
  });

  describe("fever for days", () => {
    const older = { birthDate: BIRTH_6_MONTHS };

    it("flags fever readings on 3 separate Oslo days in the last 4 days", () => {
      // 12, 13 and 15 January in Oslo
      const temperatures = [reading("a", 80, 38.5), reading("b", 56, 38.9), reading("d", 3, 38.4)];
      const hints = evaluateHealthHints(input({ ...older, temperatures }));
      expect(hints.map((h) => h.kind)).toEqual(["feverLong"]);
      expect(hints[0]).toMatchObject({ id: "feverLong:d", params: { days: 3 }, emergency: false });
    });

    it("is not reset by lower readings in between", () => {
      const temperatures = [
        reading("a", 80, 38.5),
        reading("b", 70, 36.9),
        reading("c", 56, 38.9),
        reading("e", 40, 37.2),
        reading("d", 3, 38.4),
      ];
      expect(kinds(input({ ...older, temperatures }))).toEqual(["feverLong"]);
    });

    it("needs three separate days, not three readings", () => {
      const temperatures = [reading("a", 30, 38.5), reading("b", 28, 38.9), reading("c", 3, 38.4)];
      expect(kinds(input({ ...older, temperatures }))).toEqual([]);
    });

    it("needs a fever reading in the last 24 hours", () => {
      const temperatures = [reading("a", 90, 38.5), reading("b", 60, 38.9), reading("c", 30, 38.4)];
      expect(kinds(input({ ...older, temperatures }))).toEqual([]);
    });

    it("ignores fever readings older than 4 days", () => {
      const temperatures = [reading("a", 100, 38.5), reading("b", 56, 38.9), reading("c", 3, 38.4)];
      expect(kinds(input({ ...older, temperatures }))).toEqual([]);
    });
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
  it("expects 5 on days 5-6 and 6 from day 7", () => {
    expect(minWetDiapersForAge(4)).toBeNull();
    expect(minWetDiapersForAge(5)).toBe(5);
    expect(minWetDiapersForAge(6)).toBe(5);
    expect(minWetDiapersForAge(7)).toBe(6);
    expect(minWetDiapersForAge(27)).toBe(6);
    expect(minWetDiapersForAge(28)).toBeNull();
  });

  it("flags fewer than 6 wet diapers from day 7 and points to Ammehjelpen", () => {
    const hints = evaluateHealthHints(
      input({ birthDate: BIRTH_NEWBORN_DAY_10, diapers: diapers(4, 2) })
    );
    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({
      kind: "wetDiapers",
      params: { count: 4, min: 6 },
      id: "wetDiapers:2026-01-15",
      source: "ammehjelpen",
      url: "https://ammehjelpen.no/trotte-barn/",
    });
  });

  it("accepts 5 wet diapers on day 6 but not on day 7", () => {
    const day6 = new Date("2026-01-09T00:00:00Z");
    const day7 = new Date("2026-01-08T00:00:00Z");
    expect(kinds(input({ birthDate: day6, diapers: diapers(5, 1) }))).toEqual([]);
    expect(evaluateHealthHints(input({ birthDate: day6, diapers: diapers(4, 1) }))[0]).toMatchObject({
      kind: "wetDiapers",
      params: { count: 4, min: 5 },
    });
    expect(kinds(input({ birthDate: day7, diapers: diapers(5, 1) }))).toEqual(["wetDiapers"]);
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

  it("is quiet from day 28", () => {
    const birth = new Date("2025-12-18T00:00:00Z"); // day 28
    expect(kinds(input({ birthDate: birth, diapers: diapers(3, 2) }))).toEqual([]);
  });

  it("is quiet when few diapers are logged at all", () => {
    expect(kinds(input({ birthDate: BIRTH_NEWBORN_DAY_10, diapers: diapers(2, 1) }))).toEqual([]);
  });
});

/** Feeds every 2.5 hours, the newest `lastAgo` hours ago. */
function feeds(lastAgo: number, count = 6, step = 2.5, now = NOW) {
  return Array.from({ length: count }, (_, i) => ({
    startTime: new Date(now.getTime() - hours(lastAgo + i * step)),
  }));
}

const NIGHT = new Date("2026-01-15T02:00:00Z"); // 03:00 in Oslo

describe("feeding gap hint", () => {
  it("flags a gap over 4 hours that is much longer than the usual interval", () => {
    const hints = evaluateHealthHints(input({ birthDate: BIRTH_NEWBORN_DAY_10, feeds: feeds(4.6) }));
    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({
      kind: "feedingGap",
      params: { hours: 4 },
      source: "helsenorge",
      url: "https://www.helsenorge.no/barn/spedbarnsmat-og-amming/alt-om-spedbarnsmat/amming/nok-morsmelk/",
    });
    expect(hints[0]!.id).toBe(`feedingGap:${ago(4.6).getTime()}`);
  });

  it("is quiet for a gap that is long but not much longer than usual", () => {
    // Usual interval 3 h, gap 4.5 h: below 1.75 x 3 = 5.25 h
    expect(
      kinds(input({ birthDate: BIRTH_NEWBORN_DAY_10, feeds: feeds(4.5, 6, 3) }))
    ).toEqual([]);
  });

  it("is quiet for a gap under 4 hours", () => {
    expect(kinds(input({ birthDate: BIRTH_NEWBORN_DAY_10, feeds: feeds(3.5, 6, 1.5) }))).toEqual([]);
  });

  it("is quiet while a feed is running", () => {
    expect(
      kinds(input({ birthDate: BIRTH_NEWBORN_DAY_10, feeds: feeds(6), feedingActive: true }))
    ).toEqual([]);
  });

  it("is quiet for babies over 2 months", () => {
    const birth = new Date("2025-10-01T00:00:00Z");
    expect(kinds(input({ birthDate: birth, feeds: feeds(4.6) }))).toEqual([]);
  });

  it("needs at least four feeds for the rhythm rule", () => {
    expect(kinds(input({ birthDate: BIRTH_NEWBORN_DAY_10, feeds: feeds(4.6, 3) }))).toEqual([]);
  });

  it("measures from the end of the latest feed when known", () => {
    const list = feeds(4.6).map((f, i) => (i === 0 ? { ...f, endTime: ago(3.8) } : f));
    expect(kinds(input({ birthDate: BIRTH_NEWBORN_DAY_10, feeds: list }))).toEqual([]);
  });

  describe("under 4 weeks", () => {
    it("shows at night", () => {
      expect(
        kinds(input({ birthDate: BIRTH_NEWBORN_DAY_10, now: NIGHT, feeds: feeds(4.6, 6, 2.5, NIGHT) }))
      ).toEqual(["feedingGap"]);
    });

    it("shows after more than 5 hours even without a feeding rhythm", () => {
      expect(kinds(input({ birthDate: BIRTH_NEWBORN_DAY_10, feeds: feeds(5.2, 2) }))).toEqual(["feedingGap"]);
      expect(
        kinds(input({ birthDate: BIRTH_NEWBORN_DAY_10, now: NIGHT, feeds: feeds(5.2, 1, 2.5, NIGHT) }))
      ).toEqual(["feedingGap"]);
    });

    it("stays quiet at 5 hours or less without a feeding rhythm", () => {
      expect(kinds(input({ birthDate: BIRTH_NEWBORN_DAY_10, feeds: feeds(4.9, 2) }))).toEqual([]);
    });
  });

  describe("from 4 weeks", () => {
    it("is quiet at night", () => {
      expect(kinds(input({ birthDate: BIRTH_1_MONTH, now: NIGHT, feeds: feeds(4.6, 6, 2.5, NIGHT) }))).toEqual([]);
    });

    it("needs the rhythm rule also after 5 hours", () => {
      expect(kinds(input({ birthDate: BIRTH_1_MONTH, feeds: feeds(5.2, 2) }))).toEqual([]);
      expect(kinds(input({ birthDate: BIRTH_1_MONTH, feeds: feeds(4.6) }))).toEqual(["feedingGap"]);
    });
  });
});

describe("ordering", () => {
  it("puts urgent hints first", () => {
    const hints = evaluateHealthHints(
      input({
        birthDate: BIRTH_NEWBORN_DAY_10,
        diapers: diapers(3, 2),
        temperatures: [reading("t", 1, 38.3)],
      })
    );
    expect(hints.map((h) => h.kind)).toEqual(["feverYoung", "wetDiapers"]);
  });
});
