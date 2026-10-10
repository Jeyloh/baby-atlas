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
import { isPremiumAccount } from "../premium";
import { statsRouter, computeTrends } from "./stats";

const createCaller = createCallerFactory(statsRouter);

const NOW = new Date("2024-03-15T12:00:00Z");

describe("computeTrends", () => {
  it("returns empty averages when there is no data", () => {
    const result = computeTrends({
      now: NOW,
      days: 14,
      sleep: [],
      feedings: [],
      diapers: [],
    });

    expect(result.days).toHaveLength(14);
    expect(result.days.at(-1)?.date).toBe("2024-03-15");
    expect(result.averages.sleepMinutesPerDay).toBeNull();
    expect(result.averages.mlPerBottle).toBeNull();
  });

  it("aggregates sleep, feeds and diapers per day", () => {
    const result = computeTrends({
      now: NOW,
      days: 14,
      sleep: [
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
        {
          startTime: new Date("2024-03-15T09:00:00Z"),
          endTime: null,
          sleepType: "NAP",
        },
      ],
      feedings: [
        {
          startTime: new Date("2024-03-14T08:00:00Z"),
          feedingType: "BOTTLE",
          amountMl: 120,
        },
        {
          startTime: new Date("2024-03-14T12:00:00Z"),
          feedingType: "BOTTLE",
          amountMl: 180,
        },
        {
          startTime: new Date("2024-03-15T08:00:00Z"),
          feedingType: "BREAST",
          amountMl: null,
        },
      ],
      diapers: [
        { time: new Date("2024-03-14T08:00:00Z"), diaperType: "WET" },
        { time: new Date("2024-03-14T09:00:00Z"), diaperType: "BOTH" },
        { time: new Date("2024-03-14T10:00:00Z"), diaperType: "DIRTY" },
        { time: new Date("2024-03-14T11:00:00Z"), diaperType: "DRY" },
      ],
    });

    const day = result.days.find((d) => d.date === "2024-03-14");
    expect(day).toMatchObject({
      sleepMinutes: 90 + 480,
      naps: 1,
      feeds: 2,
      wetDiapers: 2,
      dirtyDiapers: 2,
    });
    expect(result.averages.sleepMinutesPerDay).toBe(570);
    expect(result.averages.napsPerDay).toBe(1);
    expect(result.averages.feedsPerDay).toBe(1.5);
    expect(result.averages.mlPerBottle).toBe(150);
    expect(result.averages.wetDiapersPerDay).toBe(2);
    expect(result.averages.dirtyDiapersPerDay).toBe(2);
  });

  it("buckets days in Oslo time", () => {
    const result = computeTrends({
      now: NOW,
      days: 3,
      sleep: [],
      feedings: [
        {
          startTime: new Date("2024-03-14T23:30:00Z"),
          feedingType: "BREAST",
          amountMl: null,
        },
      ],
      diapers: [],
    });

    expect(result.days.find((d) => d.date === "2024-03-15")?.feeds).toBe(1);
  });
});

describe("isPremiumAccount", () => {
  it("is premium when the flag is set", () => {
    expect(isPremiumAccount({ isPremium: true, email: "a@b.no" }, "")).toBe(true);
  });

  it("is premium when the email is in PREMIUM_EMAILS, ignoring case and spaces", () => {
    expect(
      isPremiumAccount({ isPremium: false, email: "Test@Example.com" }, "x@y.no, test@example.com")
    ).toBe(true);
  });

  it("is not premium otherwise", () => {
    expect(isPremiumAccount({ isPremium: false, email: "a@b.no" }, "x@y.no")).toBe(false);
    expect(isPremiumAccount({ isPremium: false, email: null }, "x@y.no")).toBe(false);
    expect(isPremiumAccount({ isPremium: false, email: "a@b.no" }, undefined)).toBe(false);
  });
});

describe("statsRouter.trends", () => {
  const childId = TEST_IDS.childId;

  beforeEach(() => {
    vi.stubEnv("PREMIUM_EMAILS", "");
    prismaMock.child.findUnique.mockResolvedValue(createTestChild() as never);
    prismaMock.householdMember.findUnique.mockResolvedValue(
      createTestMembership({ role: "CAREGIVER" }) as never
    );
    prismaMock.sleepRecord.findMany.mockResolvedValue([]);
    prismaMock.feedingRecord.findMany.mockResolvedValue([]);
    prismaMock.diaperRecord.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects unauthenticated callers", async () => {
    const caller = createCaller(createUnauthenticatedContext());
    await expect(caller.trends({ childId })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects non-premium users", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      isPremium: false,
      email: "test@example.com",
    } as never);
    const caller = createCaller(createTestContext());

    await expect(caller.trends({ childId })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "premium_required",
    });
    expect(prismaMock.sleepRecord.findMany).not.toHaveBeenCalled();
  });

  it("returns trends for premium users", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      isPremium: true,
      email: "test@example.com",
    } as never);
    const caller = createCaller(createTestContext());

    const result = await caller.trends({ childId });

    expect(result.days).toHaveLength(14);
    expect(prismaMock.sleepRecord.findMany).toHaveBeenCalled();
  });

  it("allows emails listed in PREMIUM_EMAILS", async () => {
    vi.stubEnv("PREMIUM_EMAILS", "test@example.com");
    prismaMock.user.findUnique.mockResolvedValue({
      isPremium: false,
      email: "test@example.com",
    } as never);
    const caller = createCaller(createTestContext());

    await expect(caller.trends({ childId })).resolves.toBeDefined();
  });

  it("rejects users outside the child's household", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      isPremium: true,
      email: "test@example.com",
    } as never);
    prismaMock.householdMember.findUnique.mockResolvedValue(null);
    const caller = createCaller(createTestContext());

    await expect(caller.trends({ childId })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
