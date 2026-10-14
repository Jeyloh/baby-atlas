import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prismaMock } from "../test/setup";
import {
  createTestContext,
  createTestMembership,
  createTestChild,
  createUnauthenticatedContext,
  TEST_IDS,
} from "../test/helpers";
import { createCallerFactory } from "../trpc";
import { digestRouter, growthChange, summarizePeriod } from "./digest";

const createCaller = createCallerFactory(digestRouter);

const WEEK = [
  "2026-10-12",
  "2026-10-13",
  "2026-10-14",
  "2026-10-15",
  "2026-10-16",
  "2026-10-17",
  "2026-10-18",
];

describe("summarizePeriod", () => {
  it("returns null averages and zero counts without data", () => {
    const result = summarizePeriod({
      dayKeys: WEEK,
      sleep: [],
      feedings: [],
      diapers: [],
      pumping: [],
    });

    expect(result.days).toBe(7);
    expect(result.totalRecords).toBe(0);
    expect(result.sleep.totalMinutesPerDay).toBeNull();
    expect(result.feeds.perDay).toBeNull();
    expect(result.diapers.wetPerDay).toBeNull();
    expect(result.pumping.mlPerDay).toBeNull();
  });

  it("splits sleep into night and naps and averages over days with sleep", () => {
    const result = summarizePeriod({
      dayKeys: WEEK,
      sleep: [
        // Monday: a nap of 90 min and a night of 480 min
        {
          startTime: new Date("2026-10-12T09:00:00Z"),
          endTime: new Date("2026-10-12T10:30:00Z"),
          sleepType: "NAP",
        },
        {
          startTime: new Date("2026-10-12T18:00:00Z"),
          endTime: new Date("2026-10-13T02:00:00Z"),
          sleepType: "NIGHT",
        },
        // Tuesday: one nap of 60 min
        {
          startTime: new Date("2026-10-13T09:00:00Z"),
          endTime: new Date("2026-10-13T10:00:00Z"),
          sleepType: "NAP",
        },
        // Running timer counts as a record but adds no minutes
        { startTime: new Date("2026-10-14T09:00:00Z"), endTime: null, sleepType: "NAP" },
        // Outside the week
        {
          startTime: new Date("2026-10-20T09:00:00Z"),
          endTime: new Date("2026-10-20T10:00:00Z"),
          sleepType: "NAP",
        },
      ],
      feedings: [],
      diapers: [],
      pumping: [],
    });

    expect(result.sleep.loggedDays).toBe(2);
    expect(result.sleep.napMinutesPerDay).toBe(75);
    expect(result.sleep.nightMinutesPerDay).toBe(240);
    expect(result.sleep.totalMinutesPerDay).toBe(315);
    expect(result.sleep.napsPerDay).toBe(1);
    expect(result.totalRecords).toBe(4);
  });

  it("counts feeds, bottle ml, diapers and pumping per logged day", () => {
    const result = summarizePeriod({
      dayKeys: WEEK,
      sleep: [],
      feedings: [
        { startTime: new Date("2026-10-12T07:00:00Z"), feedingType: "BOTTLE", amountMl: 100 },
        { startTime: new Date("2026-10-12T11:00:00Z"), feedingType: "BOTTLE", amountMl: 140 },
        { startTime: new Date("2026-10-12T15:00:00Z"), feedingType: "BREAST", amountMl: null },
        { startTime: new Date("2026-10-13T07:00:00Z"), feedingType: "SOLIDS", amountMl: null },
      ],
      diapers: [
        { time: new Date("2026-10-12T07:00:00Z"), diaperType: "WET" },
        { time: new Date("2026-10-12T09:00:00Z"), diaperType: "BOTH" },
        { time: new Date("2026-10-13T09:00:00Z"), diaperType: "DIRTY" },
        { time: new Date("2026-10-13T12:00:00Z"), diaperType: "DRY" },
      ],
      pumping: [
        { startTime: new Date("2026-10-12T07:00:00Z"), amountMl: 80 },
        { startTime: new Date("2026-10-12T17:00:00Z"), amountMl: 60 },
        { startTime: new Date("2026-10-14T07:00:00Z"), amountMl: null },
      ],
    });

    expect(result.feeds.total).toBe(4);
    expect(result.feeds.perDay).toBe(2);
    expect(result.feeds.bottleMlPerDay).toBe(240);
    expect(result.diapers.wetPerDay).toBe(1);
    expect(result.diapers.dirtyPerDay).toBe(1);
    expect(result.pumping.mlPerDay).toBe(140);
    expect(result.pumping.loggedDays).toBe(1);
  });

  it("uses the Oslo day, not the UTC day", () => {
    // 22:30 UTC on Sunday 11 October is 00:30 on Monday 12 October in Oslo
    const result = summarizePeriod({
      dayKeys: WEEK,
      sleep: [],
      feedings: [
        { startTime: new Date("2026-10-11T22:30:00Z"), feedingType: "BREAST", amountMl: null },
      ],
      diapers: [],
      pumping: [],
    });

    expect(result.feeds.total).toBe(1);
  });
});

describe("growthChange", () => {
  const point = (date: string, w: number | null, h: number | null, c: number | null) => ({
    date: new Date(date),
    weightKg: w,
    heightCm: h,
    headCircumferenceCm: c,
  });

  it("compares the latest value of each measurement with the one before", () => {
    const change = growthChange(
      [point("2026-10-15", 6.5, null, 41)],
      [point("2026-09-20", 6.1, 62, 40), point("2026-08-20", 5.4, 60, 39)]
    );

    expect(change.weightKg).toBeCloseTo(0.4, 3);
    // No height this week: nothing to compare
    expect(change.heightCm).toBeNull();
    expect(change.headCircumferenceCm).toBe(1);
  });

  it("is null without an earlier measurement", () => {
    expect(growthChange([point("2026-10-15", 6.5, 62, 41)], [])).toEqual({
      weightKg: null,
      heightCm: null,
      headCircumferenceCm: null,
    });
  });
});

describe("digestRouter", () => {
  const childId = TEST_IDS.childId;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-14T10:00:00Z"));
    prismaMock.child.findUnique.mockResolvedValue(createTestChild() as never);
    prismaMock.householdMember.findUnique.mockResolvedValue(
      createTestMembership({ role: "CAREGIVER" }) as never
    );
    prismaMock.sleepRecord.findMany.mockResolvedValue([]);
    prismaMock.feedingRecord.findMany.mockResolvedValue([]);
    prismaMock.diaperRecord.findMany.mockResolvedValue([]);
    prismaMock.pumpingRecord.findMany.mockResolvedValue([]);
    prismaMock.growthRecord.findMany.mockResolvedValue([]);
    prismaMock.speechWord.findMany.mockResolvedValue([]);
    prismaMock.journalEntry.findMany.mockResolvedValue([]);
    prismaMock.medicine.findMany.mockResolvedValue([]);
    prismaMock.temperatureRecord.findMany.mockResolvedValue([]);
    prismaMock.vaccinationRecord.findMany.mockResolvedValue([]);
    prismaMock.checkupRecord.findFirst.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("week", () => {
    it("rejects unauthenticated callers", async () => {
      const caller = createCaller(createUnauthenticatedContext());
      await expect(caller.week({ childId })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("rejects users outside the child's household", async () => {
      prismaMock.householdMember.findUnique.mockResolvedValue(null);
      const caller = createCaller(createTestContext());

      await expect(caller.week({ childId })).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(prismaMock.sleepRecord.findMany).not.toHaveBeenCalled();
    });

    it("rejects a malformed week start", async () => {
      const caller = createCaller(createTestContext());
      await expect(caller.week({ childId, weekStart: "14-10-2026" })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });

    it("does not require premium", async () => {
      const caller = createCaller(createTestContext());
      await expect(caller.week({ childId })).resolves.toBeDefined();
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it("defaults to the last full week and bounds the queries to two weeks", async () => {
      const caller = createCaller(createTestContext());
      const result = await caller.week({ childId });

      expect(result.weekStart).toBe("2026-10-05");
      expect(result.weekEnd).toBe("2026-10-11");
      expect(result.previousWeekStart).toBe("2026-09-28");
      expect(result.currentWeekStart).toBe("2026-10-12");
      expect(result.isoWeek).toBe("2026-W41");

      const where = prismaMock.sleepRecord.findMany.mock.calls[0]![0]!.where!;
      expect(where.childId).toBe(childId);
      // 28 Sep 00:00 Oslo (UTC+2) to 12 Oct 00:00 Oslo
      expect(where.startTime).toEqual({
        gte: new Date("2026-09-27T22:00:00.000Z"),
        lt: new Date("2026-10-11T22:00:00.000Z"),
      });
    });

    it("moves a given date to its Monday", async () => {
      const caller = createCaller(createTestContext());
      const result = await caller.week({ childId, weekStart: "2026-10-16" });
      expect(result.weekStart).toBe("2026-10-12");
    });

    it("compares this week with the previous one", async () => {
      prismaMock.feedingRecord.findMany.mockResolvedValue([
        // Previous week (28 Sep to 4 Oct): one feed
        { startTime: new Date("2026-09-30T08:00:00Z"), feedingType: "BREAST", amountMl: null },
        // This week (5 to 11 Oct): three feeds on one day
        { startTime: new Date("2026-10-06T08:00:00Z"), feedingType: "BOTTLE", amountMl: 120 },
        { startTime: new Date("2026-10-06T12:00:00Z"), feedingType: "BOTTLE", amountMl: 130 },
        { startTime: new Date("2026-10-06T16:00:00Z"), feedingType: "BREAST", amountMl: null },
      ] as never);
      prismaMock.speechWord.findMany.mockResolvedValue([
        { word: "mamma", firstSaidAt: new Date("2026-10-07T00:00:00Z") },
        { word: "ball", firstSaidAt: new Date("2026-09-30T00:00:00Z") },
      ] as never);
      prismaMock.journalEntry.findMany.mockResolvedValue([
        { date: new Date("2026-10-06T00:00:00Z") },
        { date: new Date("2026-10-08T00:00:00Z") },
        { date: new Date("2026-09-29T00:00:00Z") },
      ] as never);
      prismaMock.growthRecord.findMany
        .mockResolvedValueOnce([
          {
            date: new Date("2026-10-08T00:00:00Z"),
            weightKg: 7.2,
            heightCm: null,
            headCircumferenceCm: null,
          },
        ] as never)
        .mockResolvedValueOnce([
          {
            date: new Date("2026-09-01T00:00:00Z"),
            weightKg: 6.8,
            heightCm: 64,
            headCircumferenceCm: 42,
          },
        ] as never);

      const caller = createCaller(createTestContext());
      const result = await caller.week({ childId });

      expect(result.current.feeds.total).toBe(3);
      expect(result.current.feeds.perDay).toBe(3);
      expect(result.current.feeds.bottleMlPerDay).toBe(250);
      expect(result.previous.feeds.total).toBe(1);
      expect(result.current.newWords).toBe(1);
      expect(result.previous.newWords).toBe(1);
      expect(result.words).toEqual(["mamma"]);
      expect(result.current.journalEntries).toBe(2);
      expect(result.previous.journalEntries).toBe(1);
      expect(result.growth.entries).toEqual([
        { date: "2026-10-08", weightKg: 7.2, heightCm: null, headCircumferenceCm: null },
      ]);
      expect(result.growth.change.weightKg).toBeCloseTo(0.4, 3);
      expect(result.growth.change.heightCm).toBeNull();
    });
  });

  describe("report", () => {
    it("rejects users outside the child's household", async () => {
      prismaMock.householdMember.findUnique.mockResolvedValue(null);
      const caller = createCaller(createTestContext());

      await expect(caller.report({ childId })).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(prismaMock.medicine.findMany).not.toHaveBeenCalled();
      expect(prismaMock.journalEntry.findMany).not.toHaveBeenCalled();
    });

    it("defaults to the last 28 days including today", async () => {
      const caller = createCaller(createTestContext());
      const result = await caller.report({ childId });

      expect(result.range).toEqual({
        from: "2026-09-17",
        to: "2026-10-14",
        days: 28,
        period: "4w",
      });
      expect(result.lastCheckupDate).toBeNull();
    });

    it("starts at the last completed checkup when asked", async () => {
      prismaMock.checkupRecord.findFirst.mockResolvedValue({
        completedAt: new Date("2026-08-20T00:00:00Z"),
      } as never);
      const caller = createCaller(createTestContext());
      const result = await caller.report({ childId, period: "sinceCheckup" });

      expect(result.range.from).toBe("2026-08-20");
      expect(result.range.period).toBe("sinceCheckup");
      expect(result.lastCheckupDate).toBe("2026-08-20");
    });

    it("falls back to four weeks when there is no checkup", async () => {
      const caller = createCaller(createTestContext());
      const result = await caller.report({ childId, period: "sinceCheckup" });

      expect(result.range.period).toBe("4w");
      expect(result.range.days).toBe(28);
    });

    it("only asks for clinic and sickness journal entries", async () => {
      const caller = createCaller(createTestContext());
      await caller.report({ childId });

      expect(prismaMock.journalEntry.findMany.mock.calls[0]![0]!.where!.tags).toEqual({
        hasSome: ["CLINIC", "SICKNESS"],
      });
    });

    it("lists given doses, counts skipped ones and finds the highest temperature", async () => {
      prismaMock.medicine.findMany.mockResolvedValue([
        {
          id: TEST_IDS.medicineId,
          name: "Paracet",
          dosage: "2,5 ml",
          frequency: null,
          isActive: true,
          records: [
            { time: new Date("2026-10-10T08:00:00Z"), dosageGiven: "2,5 ml", skipped: false },
            { time: new Date("2026-10-10T14:00:00Z"), dosageGiven: null, skipped: true },
          ],
        },
        {
          id: "clq1234567890abcdefghij99",
          name: "Old drops",
          dosage: "1 dråpe",
          frequency: null,
          isActive: false,
          records: [],
        },
      ] as never);
      prismaMock.temperatureRecord.findMany.mockResolvedValue([
        { time: new Date("2026-10-10T07:00:00Z"), temperatureCelsius: 38.2 },
        { time: new Date("2026-10-10T13:00:00Z"), temperatureCelsius: 39.1 },
        { time: new Date("2026-10-11T07:00:00Z"), temperatureCelsius: 37.4 },
      ] as never);

      const caller = createCaller(createTestContext());
      const result = await caller.report({ childId });

      expect(result.medicines).toHaveLength(1);
      expect(result.medicines[0]!.given).toHaveLength(1);
      expect(result.medicines[0]!.skipped).toBe(1);
      expect(result.temperatures.readings).toHaveLength(3);
      expect(result.temperatures.highest?.celsius).toBe(39.1);
    });
  });
});
