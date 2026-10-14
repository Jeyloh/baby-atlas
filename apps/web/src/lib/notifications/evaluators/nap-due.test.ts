import { describe, it, expect, vi } from "vitest";
import type { PrismaClient } from "@baby-atlas/db";
import { evaluate } from "./nap-due";

const NOW = new Date("2026-01-15T11:00:00Z"); // 12:00 in Oslo
const min = (n: number) => n * 60_000;
const ago = (minutes: number) => new Date(NOW.getTime() - min(minutes));

type SleepRow = {
  id: string;
  childId: string;
  sleepType: "NAP" | "NIGHT";
  startTime: Date;
  endTime: Date | null;
};

interface Fixture {
  children?: { id: string; name: string; birthDate: Date }[];
  sleeps?: SleepRow[];
  runningFeeds?: { childId: string }[];
}

// 5 months old: wake window 120 minutes
const FIVE_MONTHS = new Date("2025-08-15T00:00:00Z");

function fakePrisma(fixture: Fixture) {
  return {
    child: {
      findMany: vi.fn(
        async () => fixture.children ?? [{ id: "c1", name: "Ola", birthDate: FIVE_MONTHS }]
      ),
    },
    sleepRecord: { findMany: vi.fn(async () => fixture.sleeps ?? []) },
    feedingRecord: { findMany: vi.fn(async () => fixture.runningFeeds ?? []) },
  } as unknown as PrismaClient;
}

/** One finished nap that ended `wokeAgo` minutes ago. */
function napEndedAgo(wokeAgo: number, childId = "c1"): SleepRow[] {
  return [{ id: "s1", childId, sleepType: "NAP", startTime: ago(wokeAgo + 45), endTime: ago(wokeAgo) }];
}

describe("NAP_DUE evaluator", () => {
  it("asks for a notice about 10 minutes before the predicted nap", async () => {
    // Woke 115 min ago, window 120 min: predicted at NOW + 5 min
    const result = await evaluate({ prisma: fakePrisma({ sleeps: napEndedAgo(115) }), now: NOW });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: "NAP_DUE",
      childId: "c1",
      dedupeKey: "nap-due:c1:s1",
      replaceKey: "nap-due:c1",
      url: "/dashboard/c1",
      titleKey: "push.napDue.title",
      bodyKey: "push.napDue.body",
      params: { name: "Ola", time: "12:05" },
    });
  });

  it("waits while the predicted time is far away", async () => {
    expect(await evaluate({ prisma: fakePrisma({ sleeps: napEndedAgo(60) }), now: NOW })).toEqual([]);
  });

  it("drops the notice when the prediction window has passed", async () => {
    expect(await evaluate({ prisma: fakePrisma({ sleeps: napEndedAgo(170) }), now: NOW })).toEqual([]);
  });

  it("skips a child that is asleep", async () => {
    const sleeps = [
      ...napEndedAgo(115),
      { id: "s2", childId: "c1", sleepType: "NAP" as const, startTime: ago(3), endTime: null },
    ];
    expect(await evaluate({ prisma: fakePrisma({ sleeps }), now: NOW })).toEqual([]);
  });

  it("skips a child that is breastfeeding right now", async () => {
    const prisma = fakePrisma({ sleeps: napEndedAgo(115), runningFeeds: [{ childId: "c1" }] });
    expect(await evaluate({ prisma, now: NOW })).toEqual([]);
  });

  it("skips children of 3 years or older", async () => {
    const prisma = fakePrisma({
      children: [{ id: "c1", name: "Ola", birthDate: new Date("2022-06-01T00:00:00Z") }],
      sleeps: napEndedAgo(115),
    });
    expect(await evaluate({ prisma, now: NOW })).toEqual([]);
  });

  it("does nothing for a child without a recorded sleep", async () => {
    expect(await evaluate({ prisma: fakePrisma({ sleeps: [] }), now: NOW })).toEqual([]);
  });

  it("does not read any records when nobody has switched it on", async () => {
    const prisma = fakePrisma({ children: [] });
    expect(await evaluate({ prisma, now: NOW })).toEqual([]);
    expect(prisma.sleepRecord.findMany).not.toHaveBeenCalled();
  });

  it("keys the notice to the last sleep so a new sleep gives a new notice", async () => {
    const sleeps: SleepRow[] = [
      { id: "old", childId: "c1", sleepType: "NAP", startTime: ago(400), endTime: ago(360) },
      { id: "latest", childId: "c1", sleepType: "NAP", startTime: ago(160), endTime: ago(115) },
    ];
    const result = await evaluate({ prisma: fakePrisma({ sleeps }), now: NOW });
    expect(result[0]?.dedupeKey).toBe("nap-due:c1:latest");
  });
});
