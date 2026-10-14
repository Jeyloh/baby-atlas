import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../test/setup";
import {
  createTestContext,
  createTestChild,
  createTestMembership,
  TEST_IDS,
} from "../test/helpers";
import { createCallerFactory } from "../trpc";
import { sleepRouter } from "./sleep";
import { feedingRouter } from "./feeding";
import { pumpingRouter } from "./pumping";
import { activityRouter } from "./activity";

// Ending an already ended timer (for example from a stale device) must not
// overwrite the stored end time.
describe("ending timers", () => {
  const notFound = Object.assign(new Error("Record to update not found."), { code: "P2025" });

  beforeEach(() => {
    prismaMock.child.findUnique.mockResolvedValue(createTestChild() as never);
    prismaMock.householdMember.findUnique.mockResolvedValue(
      createTestMembership({ role: "CAREGIVER" }) as never
    );
  });

  it("only updates sleep that is still running", async () => {
    prismaMock.sleepRecord.update.mockResolvedValue({ id: TEST_IDS.sleepId } as never);
    await createCallerFactory(sleepRouter)(createTestContext()).end({ id: TEST_IDS.sleepId });

    expect(prismaMock.sleepRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TEST_IDS.sleepId, endTime: null } })
    );
  });

  it("returns CONFLICT when the sleep was already ended", async () => {
    prismaMock.sleepRecord.update.mockRejectedValue(notFound);
    await expect(
      createCallerFactory(sleepRouter)(createTestContext()).end({ id: TEST_IDS.sleepId })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("returns CONFLICT when the feed was already ended", async () => {
    prismaMock.feedingRecord.update.mockRejectedValue(notFound);
    await expect(
      createCallerFactory(feedingRouter)(createTestContext()).endBreastfeeding({ id: TEST_IDS.feedingId })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

// The stored start comes from the default record in test/setup.ts: 2024-01-15 10:00 UTC
describe("end time checks", () => {
  const before = new Date("2024-01-15T09:00:00Z");
  const after = new Date("2024-01-15T11:00:00Z");
  const ends = [
    ["sleep", () => createCallerFactory(sleepRouter)(createTestContext()), "sleepId", "sleepRecord"],
    ["feeding", () => createCallerFactory(feedingRouter)(createTestContext()), "feedingId", "feedingRecord"],
    ["pumping", () => createCallerFactory(pumpingRouter)(createTestContext()), "pumpingId", "pumpingRecord"],
    ["activity", () => createCallerFactory(activityRouter)(createTestContext()), "activityId", "activityRecord"],
  ] as const;

  beforeEach(() => {
    prismaMock.child.findUnique.mockResolvedValue(createTestChild() as never);
    prismaMock.householdMember.findUnique.mockResolvedValue(
      createTestMembership({ role: "CAREGIVER" }) as never
    );
  });

  for (const [name, caller, idKey, model] of ends) {
    const end = (input: { endTime?: Date }) => {
      const c = caller() as unknown as Record<string, (i: unknown) => Promise<unknown>>;
      const id = TEST_IDS[idKey];
      return name === "feeding" ? c.endBreastfeeding!({ id, ...input }) : c.end!({ id, ...input });
    };
    const update = (input: { startTime?: Date; endTime?: Date | null }) => {
      const c = caller() as unknown as Record<string, (i: unknown) => Promise<unknown>>;
      return c.update!({ id: TEST_IDS[idKey], ...input });
    };
    const table = prismaMock[model] as unknown as {
      update: { mockResolvedValue: (v: unknown) => void; mock: { calls: unknown[][] } };
    };

    it(`${name}: rejects an end before the start`, async () => {
      await expect(end({ endTime: before })).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(table.update.mock.calls).toHaveLength(0);
    });

    it(`${name}: cuts a future end back to now`, async () => {
      table.update.mockResolvedValue({});
      const future = new Date(Date.now() + 3 * 3_600_000);
      await end({ endTime: future });
      const data = (table.update.mock.calls[0]![0] as { data: { endTime: Date } }).data;
      expect(data.endTime.getTime()).toBeLessThanOrEqual(Date.now());
      expect(data.endTime.getTime()).toBeGreaterThan(future.getTime() - 3 * 3_600_000 - 5_000);
    });

    it(`${name}: update rejects an end before the stored start`, async () => {
      await expect(update({ endTime: before })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it(`${name}: update rejects a start after the new end`, async () => {
      await expect(update({ startTime: after, endTime: new Date("2024-01-15T10:30:00Z") })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(table.update.mock.calls).toHaveLength(0);
    });
  }

  it("pumping.log stores a finished event when no end is given", async () => {
    prismaMock.pumpingRecord.create.mockResolvedValue({} as never);
    await createCallerFactory(pumpingRouter)(createTestContext()).log({
      childId: TEST_IDS.childId,
      startTime: before,
    });
    expect(prismaMock.pumpingRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ startTime: before, endTime: before }),
    });
  });

  it("activity.log stores a finished event when no end is given", async () => {
    prismaMock.activityRecord.create.mockResolvedValue({} as never);
    await createCallerFactory(activityRouter)(createTestContext()).log({
      childId: TEST_IDS.childId,
      activityType: "TUMMY_TIME",
      startTime: before,
    });
    expect(prismaMock.activityRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ startTime: before, endTime: before }),
    });
  });
});
