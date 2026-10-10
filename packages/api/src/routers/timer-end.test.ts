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
