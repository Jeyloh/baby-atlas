import { describe, it, expect, vi } from "vitest";
import type { PrismaClient } from "@baby-atlas/db";
import { evaluate } from "./weekly-digest";

// Monday 19 October 2026, 10:00 in Oslo (CEST): the digest covers 12 to 18 October
const MONDAY_MORNING = new Date("2026-10-19T08:00:00Z");

interface Options {
  children?: { id: string; name: string; members: string[] }[];
  sleepChildIds?: string[];
  feedingChildIds?: string[];
  logs?: { userId: string; dedupeKey: string }[];
}

function createPrisma(options: Options) {
  const groups = (ids: string[] = []) => vi.fn(async () => ids.map((childId) => ({ childId })));
  const children = options.children ?? [{ id: "child-1", name: "Mia", members: ["u1"] }];
  return {
    child: {
      findMany: vi.fn(async () =>
        children.map((c) => ({
          id: c.id,
          name: c.name,
          household: { members: c.members.map((userId) => ({ userId })) },
        }))
      ),
    },
    notificationLog: { findMany: vi.fn(async () => options.logs ?? []) },
    sleepRecord: { groupBy: groups(options.sleepChildIds) },
    feedingRecord: { groupBy: groups(options.feedingChildIds) },
    diaperRecord: { groupBy: groups() },
    pumpingRecord: { groupBy: groups() },
  };
}

const run = (prisma: ReturnType<typeof createPrisma>, now: Date) =>
  evaluate({ prisma: prisma as unknown as PrismaClient, now });

describe("weekly digest evaluator", () => {
  it("does nothing outside Monday 08:00 to 20:00 Oslo", async () => {
    const prisma = createPrisma({ sleepChildIds: ["child-1"] });

    expect(await run(prisma, new Date("2026-10-14T10:00:00Z"))).toEqual([]);
    // Sunday evening: the week is not over yet
    expect(await run(prisma, new Date("2026-10-18T18:00:00Z"))).toEqual([]);
    expect(await run(prisma, new Date("2026-10-19T05:59:00Z"))).toEqual([]);
    expect(await run(prisma, new Date("2026-10-19T18:00:00Z"))).toEqual([]);
    expect(prisma.child.findMany).not.toHaveBeenCalled();
  });

  it("returns one candidate per child with records, pointing at last week's digest", async () => {
    const prisma = createPrisma({
      children: [
        { id: "child-1", name: "Mia", members: ["u1"] },
        { id: "child-2", name: "Ola", members: ["u1"] },
      ],
      sleepChildIds: ["child-1"],
    });

    const candidates = await run(prisma, MONDAY_MORNING);

    expect(candidates).toEqual([
      {
        kind: "WEEKLY_DIGEST",
        childId: "child-1",
        dedupeKey: "digest:child-1:2026-W42",
        url: "/dashboard/child-1/digest?week=2026-10-12",
        titleKey: "push.weeklyDigest.title",
        bodyKey: "push.weeklyDigest.body",
        params: { name: "Mia", week: 42 },
      },
    ]);
  });

  it("skips children without any records that week", async () => {
    const prisma = createPrisma({});
    expect(await run(prisma, MONDAY_MORNING)).toEqual([]);
  });

  it("skips children whose digest already went to every recipient, before counting records", async () => {
    const prisma = createPrisma({
      children: [{ id: "child-1", name: "Mia", members: ["u1", "u2"] }],
      sleepChildIds: ["child-1"],
      logs: [
        { userId: "u1", dedupeKey: "digest:child-1:2026-W42" },
        { userId: "u2", dedupeKey: "digest:child-1:2026-W42" },
      ],
    });

    expect(await run(prisma, MONDAY_MORNING)).toEqual([]);
    expect(prisma.sleepRecord.groupBy).not.toHaveBeenCalled();
  });

  it("still returns a child when only some recipients have it", async () => {
    const prisma = createPrisma({
      children: [{ id: "child-1", name: "Mia", members: ["u1", "u2"] }],
      sleepChildIds: ["child-1"],
      logs: [{ userId: "u1", dedupeKey: "digest:child-1:2026-W42" }],
    });

    expect(await run(prisma, MONDAY_MORNING)).toHaveLength(1);
  });

  it("looks only at the Monday to Sunday week in Oslo time", async () => {
    const prisma = createPrisma({ sleepChildIds: ["child-1"] });
    await run(prisma, MONDAY_MORNING);

    expect(prisma.sleepRecord.groupBy).toHaveBeenCalledWith({
      by: ["childId"],
      where: {
        childId: { in: ["child-1"] },
        startTime: {
          gte: new Date("2026-10-11T22:00:00.000Z"),
          lt: new Date("2026-10-18T22:00:00.000Z"),
        },
      },
    });
  });

  it("returns nothing and runs no record queries without notifiable children", async () => {
    const prisma = createPrisma({ children: [] });

    expect(await run(prisma, MONDAY_MORNING)).toEqual([]);
    expect(prisma.sleepRecord.groupBy).not.toHaveBeenCalled();
  });
});
