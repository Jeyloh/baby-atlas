import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../test/setup";
import {
  createTestContext,
  createTestMembership,
  createTestChild,
  TEST_IDS,
} from "../test/helpers";
import { createCallerFactory } from "../trpc";
import { medicineRouter } from "./medicine";

const createCaller = createCallerFactory(medicineRouter);

function createTestMedicine(overrides?: Record<string, unknown>) {
  return {
    id: TEST_IDS.medicineId,
    childId: TEST_IDS.childId,
    name: "Vitamin D",
    dosage: "400 IU",
    frequency: "Once daily",
    notes: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createTestMedicineRecord(overrides?: Record<string, unknown>) {
  return {
    id: TEST_IDS.recordId,
    medicineId: TEST_IDS.medicineId,
    time: new Date("2024-01-15T08:00:00"),
    dosageGiven: null,
    skipped: false,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("medicineRouter", () => {
  const childId = TEST_IDS.childId;
  const medicineId = TEST_IDS.medicineId;
  const recordId = TEST_IDS.recordId;

  beforeEach(() => {
    prismaMock.child.findUnique.mockResolvedValue(createTestChild() as never);
    prismaMock.householdMember.findUnique.mockResolvedValue(
      createTestMembership({ role: "CAREGIVER" }) as never
    );
  });

  describe("list", () => {
    it("returns active medicines by default", async () => {
      const ctx = createTestContext();
      const caller = createCaller(ctx);

      prismaMock.medicine.findMany.mockResolvedValue([
        createTestMedicine(),
      ] as never);

      const result = await caller.list({ childId });

      expect(result).toHaveLength(1);
      expect(prismaMock.medicine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            childId,
            isActive: true,
          }),
        })
      );
    });

    it("returns all medicines when activeOnly is false", async () => {
      const ctx = createTestContext();
      const caller = createCaller(ctx);

      prismaMock.medicine.findMany.mockResolvedValue([
        createTestMedicine(),
        createTestMedicine({ id: "id2", isActive: false }),
      ] as never);

      const result = await caller.list({ childId, activeOnly: false });

      expect(prismaMock.medicine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            childId,
          }),
        })
      );
    });
  });

  describe("create", () => {
    it("creates a medicine", async () => {
      const ctx = createTestContext();
      const caller = createCaller(ctx);

      prismaMock.medicine.create.mockResolvedValue(
        createTestMedicine() as never
      );

      const result = await caller.create({
        childId,
        name: "Vitamin D",
        dosage: "400 IU",
        frequency: "Once daily",
      });

      expect(result.name).toBe("Vitamin D");
    });

    it("throws FORBIDDEN for VIEWER", async () => {
      const ctx = createTestContext();
      const caller = createCaller(ctx);

      prismaMock.householdMember.findUnique.mockResolvedValue(
        createTestMembership({ role: "VIEWER" }) as never
      );

      await expect(
        caller.create({ childId, name: "Test", dosage: "1ml" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("dose limits", () => {
    it("saves interval, max doses and reminder on create", async () => {
      const caller = createCaller(createTestContext());
      prismaMock.medicine.create.mockResolvedValue(createTestMedicine() as never);

      await caller.create({
        childId,
        name: "Paracet",
        dosage: "5 ml",
        minIntervalHours: 6,
        maxDosesPer24h: 4,
        remindNextDose: true,
      });

      expect(prismaMock.medicine.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          minIntervalHours: 6,
          maxDosesPer24h: 4,
          remindNextDose: true,
        }),
      });
    });

    it("defaults to no limits and no reminder on create", async () => {
      const caller = createCaller(createTestContext());
      prismaMock.medicine.create.mockResolvedValue(createTestMedicine() as never);

      await caller.create({ childId, name: "Vitamin D", dosage: "1 ml" });

      expect(prismaMock.medicine.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          minIntervalHours: null,
          maxDosesPer24h: null,
          remindNextDose: false,
        }),
      });
    });

    it("rejects values outside the allowed range", async () => {
      const caller = createCaller(createTestContext());
      const base = { childId, name: "X", dosage: "1 ml" };

      await expect(caller.create({ ...base, minIntervalHours: 0.4 })).rejects.toThrow();
      await expect(caller.create({ ...base, minIntervalHours: 49 })).rejects.toThrow();
      await expect(caller.create({ ...base, maxDosesPer24h: 0 })).rejects.toThrow();
      await expect(caller.create({ ...base, maxDosesPer24h: 25 })).rejects.toThrow();
      await expect(caller.create({ ...base, maxDosesPer24h: 2.5 })).rejects.toThrow();
      expect(prismaMock.medicine.create).not.toHaveBeenCalled();
    });

    it("clears a limit on update with null", async () => {
      const caller = createCaller(createTestContext());
      prismaMock.medicine.update.mockResolvedValue(createTestMedicine() as never);

      await caller.update({ id: medicineId, minIntervalHours: null, remindNextDose: false });

      expect(prismaMock.medicine.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ minIntervalHours: null, remindNextDose: false }),
        })
      );
    });

    it("returns active medicines with recent doses for dose status", async () => {
      const caller = createCaller(createTestContext());
      prismaMock.medicine.findMany.mockResolvedValue([createTestMedicine()] as never);

      const result = await caller.doseStatus({ childId });

      expect(result).toHaveLength(1);
      expect(prismaMock.medicine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { childId, isActive: true } })
      );
    });

    it("denies dose status for a child in another household", async () => {
      const caller = createCaller(createTestContext());
      prismaMock.householdMember.findUnique.mockResolvedValue(null);

      await expect(caller.doseStatus({ childId })).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(prismaMock.medicine.findMany).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("updates medicine details", async () => {
      const ctx = createTestContext();
      const caller = createCaller(ctx);

      prismaMock.medicine.update.mockResolvedValue(
        createTestMedicine({ dosage: "800 IU" }) as never
      );

      const result = await caller.update({ id: medicineId, dosage: "800 IU" });

      expect(prismaMock.medicine.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dosage: "800 IU",
          }),
        })
      );
    });

    it("deactivates medicine", async () => {
      const ctx = createTestContext();
      const caller = createCaller(ctx);

      prismaMock.medicine.update.mockResolvedValue(
        createTestMedicine({ isActive: false }) as never
      );

      const result = await caller.update({ id: medicineId, isActive: false });

      expect(prismaMock.medicine.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isActive: false,
          }),
        })
      );
    });
  });

  describe("delete", () => {
    it("deletes a medicine when OWNER", async () => {
      const ctx = createTestContext();
      const caller = createCaller(ctx);

      // Override default CAREGIVER to OWNER for this test
      prismaMock.householdMember.findUnique.mockResolvedValue(
        createTestMembership({ role: "OWNER" }) as never
      );
      prismaMock.medicine.delete.mockResolvedValue(createTestMedicine() as never);

      const result = await caller.delete({ id: medicineId });

      expect(result).toEqual({ success: true });
    });

    it("throws FORBIDDEN for CAREGIVER", async () => {
      const ctx = createTestContext();
      const caller = createCaller(ctx);

      // CAREGIVER is the default from beforeEach
      await expect(caller.delete({ id: medicineId })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });
  });

  describe("logRecord", () => {
    it("logs a medicine dose", async () => {
      const ctx = createTestContext();
      const caller = createCaller(ctx);

      prismaMock.medicine.findUnique.mockResolvedValue(
        createTestMedicine() as never
      );
      prismaMock.medicineRecord.create.mockResolvedValue(
        createTestMedicineRecord() as never
      );

      const result = await caller.logRecord({ medicineId });

      expect(prismaMock.medicineRecord.create).toHaveBeenCalled();
    });

    it("logs skipped dose", async () => {
      const ctx = createTestContext();
      const caller = createCaller(ctx);

      prismaMock.medicine.findUnique.mockResolvedValue(
        createTestMedicine() as never
      );
      prismaMock.medicineRecord.create.mockResolvedValue(
        createTestMedicineRecord({ skipped: true }) as never
      );

      const result = await caller.logRecord({
        medicineId,
        skipped: true,
        notes: "Baby asleep",
      });

      expect(prismaMock.medicineRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            skipped: true,
            notes: "Baby asleep",
          }),
        })
      );
    });
  });

  describe("updateRecord", () => {
    it("updates a medicine record", async () => {
      const ctx = createTestContext();
      const caller = createCaller(ctx);

      prismaMock.medicineRecord.findUnique.mockResolvedValue({
        ...createTestMedicineRecord(),
        medicine: createTestMedicine(),
      } as never);
      prismaMock.medicineRecord.update.mockResolvedValue(
        createTestMedicineRecord({ dosageGiven: "Half dose" }) as never
      );

      const result = await caller.updateRecord({
        id: recordId,
        dosageGiven: "Half dose",
      });

      expect(prismaMock.medicineRecord.update).toHaveBeenCalled();
    });
  });

  describe("deleteRecord", () => {
    it("deletes a medicine record", async () => {
      const ctx = createTestContext();
      const caller = createCaller(ctx);

      prismaMock.medicineRecord.findUnique.mockResolvedValue({
        ...createTestMedicineRecord(),
        medicine: createTestMedicine(),
      } as never);
      prismaMock.medicineRecord.delete.mockResolvedValue(
        createTestMedicineRecord() as never
      );

      const result = await caller.deleteRecord({ id: recordId });

      expect(result).toEqual({ success: true });
    });
  });

  describe("getRecords", () => {
    it("returns records for a medicine", async () => {
      const ctx = createTestContext();
      const caller = createCaller(ctx);

      prismaMock.medicine.findUnique.mockResolvedValue(
        createTestMedicine() as never
      );
      prismaMock.medicineRecord.findMany.mockResolvedValue([
        createTestMedicineRecord(),
      ] as never);

      const result = await caller.getRecords({ medicineId });

      expect(result).toHaveLength(1);
    });
  });
});
