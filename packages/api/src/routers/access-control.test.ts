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
import { childRouter } from "./child";
import { medicineRouter } from "./medicine";
import { temperatureRouter } from "./temperature";

// Regression tests: procedures addressed by a record id used to skip the
// household membership check entirely.
describe("record access control", () => {
  const otherChildId = "clq1234567890abcdefghij99";

  beforeEach(() => {
    prismaMock.child.findUnique.mockResolvedValue(
      createTestChild({ id: otherChildId, householdId: "clq1234567890abcdefghij98" }) as never
    );
    // The caller is not a member of the other household
    prismaMock.householdMember.findUnique.mockResolvedValue(null);
  });

  it("rejects deleting another household's sleep record", async () => {
    prismaMock.sleepRecord.findUnique.mockResolvedValue({ childId: otherChildId } as never);
    const caller = createCallerFactory(sleepRouter)(createTestContext());

    await expect(caller.delete({ id: TEST_IDS.sleepId })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(prismaMock.sleepRecord.delete).not.toHaveBeenCalled();
  });

  it("rejects updating another household's temperature record", async () => {
    prismaMock.temperatureRecord.findUnique.mockResolvedValue({ childId: otherChildId } as never);
    const caller = createCallerFactory(temperatureRouter)(createTestContext());

    await expect(
      caller.update({ id: TEST_IDS.temperatureId, temperatureCelsius: 37 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(prismaMock.temperatureRecord.update).not.toHaveBeenCalled();
  });

  it("rejects logging a dose for another household's medicine", async () => {
    prismaMock.medicine.findUnique.mockResolvedValue({ childId: otherChildId } as never);
    const caller = createCallerFactory(medicineRouter)(createTestContext());

    await expect(
      caller.logRecord({ medicineId: TEST_IDS.medicineId })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(prismaMock.medicineRecord.create).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for a record id that does not exist", async () => {
    prismaMock.sleepRecord.findUnique.mockResolvedValue(null);
    const caller = createCallerFactory(sleepRouter)(createTestContext());

    await expect(caller.delete({ id: TEST_IDS.sleepId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("rejects own householdId combined with another family's childId", async () => {
    // Member of own household, but childId belongs to another household
    prismaMock.householdMember.findUnique.mockResolvedValue(
      createTestMembership({ role: "OWNER" }) as never
    );
    const caller = createCallerFactory(sleepRouter)(createTestContext());

    await expect(
      caller.list({ childId: otherChildId, householdId: TEST_IDS.householdId } as never)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prismaMock.sleepRecord.findMany).not.toHaveBeenCalled();
  });

  it("rejects own childId combined with another family's child as id", async () => {
    prismaMock.householdMember.findUnique.mockResolvedValue(
      createTestMembership({ role: "OWNER" }) as never
    );
    prismaMock.child.findUnique.mockImplementation((async (args: { where: { id: string } }) =>
      args.where.id === TEST_IDS.childId
        ? createTestChild()
        : createTestChild({ id: otherChildId, householdId: "clq1234567890abcdefghij98" })) as never);
    const caller = createCallerFactory(childRouter)(createTestContext());

    await expect(
      caller.get({ id: otherChildId, childId: TEST_IDS.childId } as never)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("fails closed when householdProcedure cannot resolve a household", async () => {
    prismaMock.child.findUnique.mockResolvedValue(null);
    const caller = createCallerFactory(sleepRouter)(createTestContext());

    await expect(caller.list({ childId: otherChildId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
