import { describe, it, expect, vi } from "vitest";
import type { PrismaClient } from "@baby-atlas/db";
import { evaluate } from "./feed-due";

const NOW = new Date("2026-01-15T11:00:00Z"); // 12:00 in Oslo
const min = (n: number) => n * 60_000;
const ago = (minutes: number) => new Date(NOW.getTime() - min(minutes));

interface Fixture {
  children?: { id: string; name: string; birthDate: Date }[];
  feeds?: { id: string; childId: string; feedingType: string; startTime: Date; endTime: Date | null }[];
  runningSleeps?: { childId: string }[];
}

function fakePrisma(fixture: Fixture) {
  return {
    child: {
      findMany: vi.fn(
        async () =>
          fixture.children ?? [{ id: "c1", name: "Ola", birthDate: new Date("2025-10-10T00:00:00Z") }]
      ),
    },
    feedingRecord: { findMany: vi.fn(async () => fixture.feeds ?? []) },
    sleepRecord: { findMany: vi.fn(async () => fixture.runningSleeps ?? []) },
  } as unknown as PrismaClient;
}

/** Feeds every 150 minutes, the newest `lastAgo` minutes before NOW. */
function feedsEvery150(lastAgo: number, childId = "c1") {
  return Array.from({ length: 6 }, (_, i) => ({
    id: `f${i}`,
    childId,
    feedingType: "BOTTLE",
    startTime: ago(lastAgo + i * 150),
    endTime: null,
  }));
}

describe("FEED_DUE evaluator", () => {
  it("asks for a notice about 10 minutes before the predicted feed", async () => {
    // Predicted at last + 150 min = NOW + 5 min
    const result = await evaluate({ prisma: fakePrisma({ feeds: feedsEvery150(145) }), now: NOW });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: "FEED_DUE",
      childId: "c1",
      dedupeKey: "feed-due:c1:f0",
      url: "/dashboard/c1",
      titleKey: "push.feedDue.title",
      bodyKey: "push.feedDue.body",
      params: { name: "Ola", time: "12:05" },
    });
  });

  it("waits while the predicted time is more than 10 minutes away", async () => {
    const result = await evaluate({ prisma: fakePrisma({ feeds: feedsEvery150(120) }), now: NOW });
    expect(result).toEqual([]);
  });

  it("drops the notice when the prediction window has passed", async () => {
    // Predicted at NOW - 30 min
    const result = await evaluate({ prisma: fakePrisma({ feeds: feedsEvery150(180) }), now: NOW });
    expect(result).toEqual([]);
  });

  it("is still relevant a few minutes after the predicted time", async () => {
    const result = await evaluate({ prisma: fakePrisma({ feeds: feedsEvery150(160) }), now: NOW });
    expect(result).toHaveLength(1);
  });

  it("skips a child with a running sleep", async () => {
    const result = await evaluate({
      prisma: fakePrisma({ feeds: feedsEvery150(145), runningSleeps: [{ childId: "c1" }] }),
      now: NOW,
    });
    expect(result).toEqual([]);
  });

  it("skips a child with a running breastfeeding timer", async () => {
    const feeds = [
      ...feedsEvery150(145),
      { id: "running", childId: "c1", feedingType: "BREAST", startTime: ago(2), endTime: null },
    ];
    const result = await evaluate({ prisma: fakePrisma({ feeds }), now: NOW });
    expect(result).toEqual([]);
  });

  it("needs at least four feeds", async () => {
    const result = await evaluate({
      prisma: fakePrisma({ feeds: feedsEvery150(145).slice(0, 3) }),
      now: NOW,
    });
    expect(result).toEqual([]);
  });

  it("skips children of a year or older", async () => {
    const prisma = fakePrisma({
      children: [{ id: "c1", name: "Ola", birthDate: new Date("2025-01-01T00:00:00Z") }],
      feeds: feedsEvery150(145),
    });
    expect(await evaluate({ prisma, now: NOW })).toEqual([]);
    expect(prisma.feedingRecord.findMany).not.toHaveBeenCalled();
  });

  it("does not read any records when nobody has switched it on", async () => {
    const prisma = fakePrisma({ children: [] });
    expect(await evaluate({ prisma, now: NOW })).toEqual([]);
    expect(prisma.feedingRecord.findMany).not.toHaveBeenCalled();
    expect(prisma.sleepRecord.findMany).not.toHaveBeenCalled();
  });

  it("reads feeds for all children in one query, bounded in time", async () => {
    const prisma = fakePrisma({
      children: [
        { id: "c1", name: "Ola", birthDate: new Date("2025-10-10T00:00:00Z") },
        { id: "c2", name: "Mia", birthDate: new Date("2025-10-10T00:00:00Z") },
      ],
      feeds: [...feedsEvery150(145, "c1"), ...feedsEvery150(500, "c2")],
    });
    const result = await evaluate({ prisma, now: NOW });

    expect(prisma.feedingRecord.findMany).toHaveBeenCalledTimes(1);
    const where = (prisma.feedingRecord.findMany as ReturnType<typeof vi.fn>).mock.calls[0]![0].where;
    expect(where.childId).toEqual({ in: ["c1", "c2"] });
    expect(where.startTime.gte).toEqual(new Date(NOW.getTime() - 48 * 60 * 60_000));
    expect(result.map((c) => c.childId)).toEqual(["c1"]);
  });
});
