import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { prismaMock } from "../test/setup";
import {
  createTestContext,
  createTestMembership,
  createTestChild,
  TEST_IDS,
} from "../test/helpers";
import { createCallerFactory } from "../trpc";
import { handoverRouter } from "./handover";

const createCaller = createCallerFactory(handoverRouter);
const childId = TEST_IDS.childId;
const NOW = new Date("2025-03-10T12:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000);

function mockEmptyRecords() {
  prismaMock.feedingRecord.findMany.mockResolvedValue([] as never);
  prismaMock.sleepRecord.findMany.mockResolvedValue([] as never);
  prismaMock.diaperRecord.findMany.mockResolvedValue([] as never);
  prismaMock.medicineRecord.findMany.mockResolvedValue([] as never);
  prismaMock.temperatureRecord.findMany.mockResolvedValue([] as never);
  prismaMock.pumpingRecord.findMany.mockResolvedValue([] as never);
  prismaMock.activityRecord.findMany.mockResolvedValue([] as never);
}

describe("handoverRouter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    prismaMock.child.findUnique.mockResolvedValue(createTestChild() as never);
    prismaMock.householdMember.findUnique.mockResolvedValue(
      createTestMembership({ role: "CAREGIVER" }) as never
    );
    mockEmptyRecords();
  });
  afterEach(() => vi.useRealTimers());

  describe("summary", () => {
    it("returns null with no earlier visit", async () => {
      prismaMock.childVisit.findUnique.mockResolvedValue(null);
      expect(await createCaller(createTestContext()).summary({ childId })).toBeNull();
      expect(prismaMock.feedingRecord.findMany).not.toHaveBeenCalled();
    });

    it("returns null when the gap is under two hours", async () => {
      prismaMock.childVisit.findUnique.mockResolvedValue({
        userId: TEST_IDS.userId,
        childId,
        lastSeenAt: hoursAgo(1.9),
      } as never);
      expect(await createCaller(createTestContext()).summary({ childId })).toBeNull();
    });

    it("looks up only the caller's own visit", async () => {
      prismaMock.childVisit.findUnique.mockResolvedValue(null);
      await createCaller(createTestContext()).summary({ childId });
      expect(prismaMock.childVisit.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_childId: { userId: TEST_IDS.userId, childId } },
        })
      );
    });

    it("summarises the period since the last visit", async () => {
      prismaMock.childVisit.findUnique.mockResolvedValue({
        userId: TEST_IDS.userId,
        childId,
        lastSeenAt: hoursAgo(5),
      } as never);
      prismaMock.feedingRecord.findMany
        .mockResolvedValueOnce([
          { feedingType: "BOTTLE", startTime: hoursAgo(1), side: null, amountMl: 120 },
          { feedingType: "BREAST", startTime: hoursAgo(3), side: "LEFT", amountMl: null },
        ] as never)
        .mockResolvedValueOnce([] as never);
      prismaMock.sleepRecord.findMany.mockResolvedValue([
        { startTime: hoursAgo(1), endTime: null, sleepType: "NAP" },
        { startTime: hoursAgo(4), endTime: hoursAgo(3), sleepType: "NAP" },
        // started before the window: only the part inside it counts
        { startTime: hoursAgo(6), endTime: hoursAgo(4), sleepType: "NIGHT" },
      ] as never);
      prismaMock.diaperRecord.findMany.mockResolvedValue([
        { diaperType: "WET", time: hoursAgo(1) },
        { diaperType: "BOTH", time: hoursAgo(2) },
        { diaperType: "DIRTY", time: hoursAgo(3) },
      ] as never);
      prismaMock.medicineRecord.findMany.mockResolvedValue([
        { time: hoursAgo(2), dosageGiven: "5 ml", medicine: { name: "Paracet" } },
      ] as never);
      prismaMock.temperatureRecord.findMany.mockResolvedValue([
        { time: hoursAgo(2), temperatureCelsius: 37.8 },
      ] as never);

      const result = await createCaller(createTestContext()).summary({ childId });

      expect(result?.feeds.count).toBe(2);
      expect(result?.feeds.latest).toMatchObject({ type: "BOTTLE", amountMl: 120 });
      // 1 h (ongoing) + 1 h + 1 h clipped to the window (5 h ago to 4 h ago)
      expect(result?.sleep.totalMinutes).toBe(180);
      expect(result?.sleep.sleepingNow).toBe(true);
      expect(result?.diapers).toMatchObject({ wet: 2, dirty: 2 });
      expect(result?.medicine.latest).toMatchObject({ name: "Paracet", dosageGiven: "5 ml" });
      expect(result?.temperature.latest?.celsius).toBe(37.8);
      expect(result?.running).toEqual([{ type: "sleepNap", startTime: hoursAgo(1) }]);
    });

    it("never looks back further than 24 hours", async () => {
      prismaMock.childVisit.findUnique.mockResolvedValue({
        userId: TEST_IDS.userId,
        childId,
        lastSeenAt: hoursAgo(24 * 10),
      } as never);

      const result = await createCaller(createTestContext()).summary({ childId });

      expect(result?.windowStart).toEqual(hoursAgo(24));
      expect(prismaMock.feedingRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { childId, startTime: { gte: hoursAgo(24), lte: NOW } },
        })
      );
    });

    it("denies a user outside the household", async () => {
      prismaMock.householdMember.findUnique.mockResolvedValue(null);
      await expect(
        createCaller(createTestContext()).summary({ childId })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(prismaMock.childVisit.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("markSeen", () => {
    it("upserts the caller's visit", async () => {
      prismaMock.childVisit.upsert.mockResolvedValue({} as never);
      await createCaller(createTestContext()).markSeen({ childId });
      expect(prismaMock.childVisit.upsert).toHaveBeenCalledWith({
        where: { userId_childId: { userId: TEST_IDS.userId, childId } },
        create: { userId: TEST_IDS.userId, childId, lastSeenAt: NOW },
        update: { lastSeenAt: NOW },
      });
    });

    it("denies a user outside the household", async () => {
      prismaMock.householdMember.findUnique.mockResolvedValue(null);
      await expect(
        createCaller(createTestContext()).markSeen({ childId })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(prismaMock.childVisit.upsert).not.toHaveBeenCalled();
    });

    it("denies an unknown child", async () => {
      prismaMock.child.findUnique.mockResolvedValue(null);
      await expect(
        createCaller(createTestContext()).markSeen({ childId })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });
});
