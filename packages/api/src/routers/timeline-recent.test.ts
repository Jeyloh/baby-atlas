import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../test/setup";
import { createTestContext, createTestMembership, createTestChild, TEST_IDS } from "../test/helpers";
import { createCallerFactory } from "../trpc";
import { timelineRouter } from "./timeline";

const createCaller = createCallerFactory(timelineRouter);

describe("timelineRouter.getRecentActivity", () => {
  const childId = TEST_IDS.childId;

  beforeEach(() => {
    prismaMock.child.findUnique.mockResolvedValue(createTestChild() as never);
    prismaMock.householdMember.findUnique.mockResolvedValue(
      createTestMembership({ role: "VIEWER" }) as never
    );
    prismaMock.feedingRecord.findMany.mockResolvedValue([]);
    prismaMock.sleepRecord.findMany.mockResolvedValue([]);
    prismaMock.diaperRecord.findMany.mockResolvedValue([]);
    prismaMock.temperatureRecord.findMany.mockResolvedValue([]);
  });

  it("returns recent feeds, sleeps, diapers and temperatures for a child", async () => {
    const feed = { id: "f1", feedingType: "BOTTLE", startTime: new Date(), endTime: null };
    prismaMock.feedingRecord.findMany.mockResolvedValue([feed] as never);

    const result = await createCaller(createTestContext()).getRecentActivity({ childId });

    expect(result.feeds).toEqual([feed]);
    expect(result.sleeps).toEqual([]);
  });

  it("only reads breast and bottle feeds for this child inside a time window", async () => {
    await createCaller(createTestContext()).getRecentActivity({ childId });

    const args = prismaMock.feedingRecord.findMany.mock.calls[0]![0]!;
    expect(args.where).toMatchObject({
      childId,
      feedingType: { in: ["BREAST", "BOTTLE"] },
    });
    expect(args.where?.startTime).toHaveProperty("gte");
    expect(args.take).toBeGreaterThan(0);
  });

  it("rejects a user who is not a member of the household", async () => {
    prismaMock.householdMember.findUnique.mockResolvedValue(null);

    await expect(
      createCaller(createTestContext()).getRecentActivity({ childId })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(prismaMock.feedingRecord.findMany).not.toHaveBeenCalled();
    expect(prismaMock.temperatureRecord.findMany).not.toHaveBeenCalled();
  });
});
