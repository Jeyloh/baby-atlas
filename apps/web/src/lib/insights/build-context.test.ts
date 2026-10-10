import { describe, it, expect } from "vitest";
import {
  ageInMonths,
  buildInsightsContext,
  lastDayKeys,
  summarizeDiapers,
  summarizeFeedings,
  summarizeMedicines,
  summarizePotty,
  summarizeSleep,
  summarizeTemperatures,
  summarizeWords,
  type InsightsData,
} from "./build-context";
import { buildSystemPrompt, INSIGHTS_SYSTEM_PROMPT } from "./system-prompt";

const NOW = new Date("2024-03-15T12:00:00Z");
const KEYS = lastDayKeys(3, NOW);

function emptyData(overrides: Partial<InsightsData> = {}): InsightsData {
  return {
    now: NOW,
    birthDate: new Date("2023-09-10"),
    sleep: [],
    feedings: [],
    diapers: [],
    temperatures: [],
    growth: [],
    potty: [],
    words: [],
    medicines: [],
    ...overrides,
  };
}

describe("ageInMonths", () => {
  it("counts full months", () => {
    expect(ageInMonths(new Date("2023-09-10"), NOW)).toBe(6);
  });

  it("does not count a month that is not complete", () => {
    expect(ageInMonths(new Date("2023-09-20"), NOW)).toBe(5);
  });

  it("never returns a negative age", () => {
    expect(ageInMonths(new Date("2025-01-01"), NOW)).toBe(0);
  });
});

describe("lastDayKeys", () => {
  it("returns consecutive days ending today", () => {
    expect(KEYS).toEqual(["2024-03-13", "2024-03-14", "2024-03-15"]);
  });
});

describe("summarizeSleep", () => {
  it("separates naps and night sleep per day", () => {
    const lines = summarizeSleep(
      [
        {
          startTime: new Date("2024-03-14T09:00:00Z"),
          endTime: new Date("2024-03-14T10:30:00Z"),
          sleepType: "NAP",
        },
        {
          startTime: new Date("2024-03-14T19:00:00Z"),
          endTime: new Date("2024-03-15T03:00:00Z"),
          sleepType: "NIGHT",
        },
      ],
      KEYS
    );
    expect(lines).toContain("2024-03-14: naps=1 (1t30), night=8t00");
  });

  it("returns nothing without records", () => {
    expect(summarizeSleep([], KEYS)).toEqual([]);
  });
});

describe("summarizeFeedings", () => {
  it("counts types, bottle ml and average interval", () => {
    const lines = summarizeFeedings(
      [
        {
          startTime: new Date("2024-03-14T08:00:00Z"),
          feedingType: "BOTTLE",
          amountMl: 120,
        },
        {
          startTime: new Date("2024-03-14T11:00:00Z"),
          feedingType: "BOTTLE",
          amountMl: 180,
        },
        {
          startTime: new Date("2024-03-14T14:00:00Z"),
          feedingType: "BREAST",
          amountMl: null,
        },
      ],
      KEYS
    );
    expect(lines[1]).toBe(
      "2024-03-14: breast=1, bottle=2 (300 ml total), solids=0, avg interval=3t00"
    );
  });
});

describe("summarizeDiapers", () => {
  it("counts BOTH as wet and dirty", () => {
    const lines = summarizeDiapers(
      [
        { time: new Date("2024-03-14T08:00:00Z"), diaperType: "WET" },
        { time: new Date("2024-03-14T09:00:00Z"), diaperType: "BOTH" },
        { time: new Date("2024-03-14T10:00:00Z"), diaperType: "DRY" },
      ],
      KEYS
    );
    expect(lines).toContain("2024-03-14: wet=2, dirty=1, dry=1");
  });
});

describe("summarizeTemperatures", () => {
  it("flags fever readings", () => {
    const lines = summarizeTemperatures([
      { time: new Date("2024-03-13T08:00:00Z"), temperatureCelsius: 38.6 },
      { time: new Date("2024-03-14T08:00:00Z"), temperatureCelsius: 38.2 },
      { time: new Date("2024-03-15T08:00:00Z"), temperatureCelsius: 37.1 },
    ]);
    expect(lines[0]).toContain("max 38.6 C");
    expect(lines[0]).toContain("fever readings (>= 38 C): 2");
    expect(lines.at(-1)).toBe("  Fever on 2 separate day(s)");
  });

  it("returns nothing without readings", () => {
    expect(summarizeTemperatures([])).toEqual([]);
  });
});

describe("summarizePotty, words and medicines", () => {
  it("counts potty signals, most common first", () => {
    const lines = summarizePotty([
      { time: NOW, signals: ["DRY_TWO_HOURS", "INTEREST_IN_TOILET"] },
      { time: NOW, signals: ["DRY_TWO_HOURS"] },
    ]);
    expect(lines[0]).toBe(
      "Potty readiness: 2 log(s). Signals: DRY_TWO_HOURS=2, INTEREST_IN_TOILET=1"
    );
  });

  it("lists new words in date order", () => {
    const lines = summarizeWords([
      { word: "bil", firstSaidAt: new Date("2024-03-14") },
      { word: "mamma", firstSaidAt: new Date("2024-03-10") },
    ]);
    expect(lines[0]).toBe("New words: mamma (2024-03-10), bil (2024-03-14)");
  });

  it("ignores skipped medicine doses", () => {
    const lines = summarizeMedicines([
      { time: NOW, name: "Paracet", skipped: false },
      { time: NOW, name: "Paracet", skipped: false },
      { time: NOW, name: "Vitamin D", skipped: true },
    ]);
    expect(lines).toEqual(["Medicine given: Paracet x2"]);
  });
});

describe("buildInsightsContext", () => {
  it("states that nothing was logged", () => {
    const text = buildInsightsContext(emptyData());
    expect(text).toContain("Child age: 6 months");
    expect(text).toContain("No records were logged in this period.");
  });

  it("includes only sections that have data", () => {
    const text = buildInsightsContext(
      emptyData({
        diapers: [{ time: new Date("2024-03-14T08:00:00Z"), diaperType: "WET" }],
      })
    );
    expect(text).toContain("Diapers per day");
    expect(text).not.toContain("Sleep per day");
    expect(text).not.toContain("Feeds per day");
  });

  it("does not include raw record ids or notes", () => {
    const text = buildInsightsContext(
      emptyData({
        sleep: [
          {
            startTime: new Date("2024-03-14T09:00:00Z"),
            endTime: new Date("2024-03-14T10:00:00Z"),
            sleepType: "NAP",
          },
        ],
      })
    );
    expect(text.split("\n").length).toBeLessThan(12);
  });
});

describe("buildSystemPrompt", () => {
  it("uses the Bokmål prompt by default", () => {
    expect(buildSystemPrompt("nb")).toBe(INSIGHTS_SYSTEM_PROMPT);
  });

  it("appends one English line for the en locale", () => {
    const prompt = buildSystemPrompt("en");
    expect(prompt.startsWith(INSIGHTS_SYSTEM_PROMPT)).toBe(true);
    expect(prompt).toContain("Respond in English");
  });

  it("keeps extra instructions after the base prompt", () => {
    expect(buildSystemPrompt("nb", "EXTRA")).toBe(`${INSIGHTS_SYSTEM_PROMPT}\n\nEXTRA`);
  });
});
