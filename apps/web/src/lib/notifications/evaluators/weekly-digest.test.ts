import { describe, it, expect, vi } from "vitest";
import type { PrismaClient } from "@baby-atlas/db";
import { evaluate } from "./weekly-digest";

// Sunday 18 October 2026, 20:00 in Oslo (CEST)
const SUNDAY_EVENING = new Date("2026-10-18T18:00:00Z");

function createPrisma(options: {
  children?: { id: string; name: string }[];
  sleepChildIds?: string[];
  feedingChildIds?: string[];
}) {
  const rows = (ids: string[] = []) => vi.fn(async () => ids.map((childId) => ({ childId })));
  return {
    child: {
      findMany: vi.fn(async () => options.children ?? [{ id: "child-1", name: "Mia" }]),
    },
    sleepRecord: { findMany: rows(options.sleepChildIds) },
    feedingRecord: { findMany: rows(options.feedingChildIds) },
    diaperRecord: { findMany: rows() },
    pumpingRecord: { findMany: rows() },
  };
}

const run = (prisma: ReturnType<typeof createPrisma>, now: Date) =>
  evaluate({ prisma: prisma as unknown as PrismaClient, now });

describe("weekly digest evaluator", () => {
  it("does nothing outside Sunday evening and Monday morning", async () => {
    const prisma = createPrisma({ sleepChildIds: ["child-1"] });

    expect(await run(prisma, new Date("2026-10-14T10:00:00Z"))).toEqual([]);
    expect(await run(prisma, new Date("2026-10-18T15:59:00Z"))).toEqual([]);
    expect(await run(prisma, new Date("2026-10-19T10:00:00Z"))).toEqual([]);
    expect(prisma.child.findMany).not.toHaveBeenCalled();
  });

  it("returns one candidate per child with records, pointing at the digest page", async () => {
    const prisma = createPrisma({
      children: [
        { id: "child-1", name: "Mia" },
        { id: "child-2", name: "Ola" },
      ],
      sleepChildIds: ["child-1"],
    });

    const candidates = await run(prisma, SUNDAY_EVENING);

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
    expect(await run(prisma, SUNDAY_EVENING)).toEqual([]);
  });

  it("keeps the same dedupe key on Monday morning, so the week is sent once", async () => {
    const prisma = createPrisma({ feedingChildIds: ["child-1"] });

    const sunday = await run(prisma, SUNDAY_EVENING);
    // Monday 19 October, 08:00 Oslo
    const monday = await run(prisma, new Date("2026-10-19T06:00:00Z"));

    expect(monday).toHaveLength(1);
    expect(monday[0]!.dedupeKey).toBe(sunday[0]!.dedupeKey);
  });

  it("looks only at the Monday to Sunday week in Oslo time", async () => {
    const prisma = createPrisma({ sleepChildIds: ["child-1"] });
    await run(prisma, SUNDAY_EVENING);

    expect(prisma.sleepRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          childId: { in: ["child-1"] },
          startTime: {
            gte: new Date("2026-10-11T22:00:00.000Z"),
            lt: new Date("2026-10-18T22:00:00.000Z"),
          },
        },
      })
    );
  });

  it("returns nothing and runs no record queries without notifiable children", async () => {
    const prisma = createPrisma({ children: [] });

    expect(await run(prisma, SUNDAY_EVENING)).toEqual([]);
    expect(prisma.sleepRecord.findMany).not.toHaveBeenCalled();
  });
});
