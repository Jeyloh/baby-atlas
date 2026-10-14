import { describe, it, expect, vi } from "vitest";
import type { PrismaClient } from "@baby-atlas/db";
import { evaluate } from "./medicine-next-dose";

const H = 60 * 60 * 1000;
const NOW = new Date("2026-03-10T15:00:00Z"); // 16:00 in Oslo (CET)
const ago = (hours: number) => new Date(NOW.getTime() - hours * H);

interface FakeMedicine {
  id?: string;
  minIntervalHours?: number;
  maxDosesPer24h?: number | null;
}

function setup(medicine: FakeMedicine, records: { id: string; time: Date; skipped?: boolean }[]) {
  const med = {
    id: "med1",
    name: "Paracet",
    childId: "child1",
    minIntervalHours: 6,
    maxDosesPer24h: null,
    child: { name: "Ola" },
    ...medicine,
  };
  const prisma = {
    medicine: { findMany: vi.fn(async () => [med]) },
    medicineRecord: {
      findMany: vi.fn(async () =>
        records.map((r) => ({ medicineId: "med1", skipped: false, ...r }))
      ),
    },
  };
  return { prisma: prisma as unknown as PrismaClient, mocks: prisma };
}

describe("MEDICINE_NEXT_DOSE evaluator", () => {
  it("only asks for active, opted-in medicines of households with a push subscription", async () => {
    const { prisma, mocks } = setup({}, []);
    await evaluate({ prisma, now: NOW });
    expect(mocks.medicine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          remindNextDose: true,
          minIntervalHours: { not: null },
        }),
      })
    );
    const where = (mocks.medicine.findMany.mock.calls[0] as unknown as [{ where: object }])[0].where;
    expect(JSON.stringify(where)).toContain("pushSubscriptions");
  });

  it("skips the record query when there are no medicines", async () => {
    const { prisma, mocks } = setup({}, []);
    mocks.medicine.findMany.mockResolvedValueOnce([]);
    expect(await evaluate({ prisma, now: NOW })).toEqual([]);
    expect(mocks.medicineRecord.findMany).not.toHaveBeenCalled();
  });

  it("reminds once the allowed time has passed, with the time in Oslo", async () => {
    // Last dose 6.5 h ago, so the time was reached 30 min ago: 14:30Z = 15:30 in Oslo
    const { prisma } = setup({}, [{ id: "r1", time: ago(6.5) }]);
    const result = await evaluate({ prisma, now: NOW });
    expect(result).toEqual([
      expect.objectContaining({
        kind: "MEDICINE_NEXT_DOSE",
        childId: "child1",
        dedupeKey: "medicine:med1:r1",
        url: "/dashboard/child1",
        titleKey: "push.medicineNextDose.title",
        bodyKey: "push.medicineNextDose.body",
        params: { medicine: "Paracet", child: "Ola", time: "15:30" },
      }),
    ]);
  });

  it("reminds exactly at the allowed time and at the edge of the window", async () => {
    const atTime = setup({}, [{ id: "r1", time: ago(6) }]);
    expect(await evaluate({ prisma: atTime.prisma, now: NOW })).toHaveLength(1);
    const atEdge = setup({}, [{ id: "r1", time: ago(18) }]);
    expect(await evaluate({ prisma: atEdge.prisma, now: NOW })).toHaveLength(1);
  });

  it("does not remind before the allowed time", async () => {
    const { prisma } = setup({}, [{ id: "r1", time: ago(5.9) }]);
    expect(await evaluate({ prisma, now: NOW })).toEqual([]);
  });

  it("does not send stale reminders (allowed more than 12 h ago)", async () => {
    const { prisma } = setup({}, [{ id: "r1", time: ago(18.1) }]);
    expect(await evaluate({ prisma, now: NOW })).toEqual([]);
  });

  it("ignores skipped records when finding the last dose", async () => {
    const { prisma } = setup({}, [
      { id: "given", time: ago(7) },
      { id: "skip", time: ago(1), skipped: true },
    ]);
    const result = await evaluate({ prisma, now: NOW });
    expect(result).toHaveLength(1);
    expect(result[0]!.dedupeKey).toBe("medicine:med1:given");
  });

  it("uses a new dedupe key for each new last dose", async () => {
    const first = await evaluate({ prisma: setup({}, [{ id: "r1", time: ago(7) }]).prisma, now: NOW });
    const second = await evaluate({ prisma: setup({}, [{ id: "r2", time: ago(7) }]).prisma, now: NOW });
    expect(first[0]!.dedupeKey).not.toBe(second[0]!.dedupeKey);
  });

  it("does not remind when the 24 h limit is already reached", async () => {
    const { prisma } = setup({ maxDosesPer24h: 2 }, [
      { id: "r1", time: ago(20) },
      { id: "r2", time: ago(7) },
    ]);
    expect(await evaluate({ prisma, now: NOW })).toEqual([]);
  });

  it("reminds when below the 24 h limit", async () => {
    const { prisma } = setup({ maxDosesPer24h: 3 }, [
      { id: "r1", time: ago(20) },
      { id: "r2", time: ago(7) },
    ]);
    expect(await evaluate({ prisma, now: NOW })).toHaveLength(1);
  });

  it("sends nothing when no dose has been logged", async () => {
    const { prisma } = setup({}, []);
    expect(await evaluate({ prisma, now: NOW })).toEqual([]);
  });

  it("handles long intervals with a last dose older than 24 h", async () => {
    const { prisma } = setup({ minIntervalHours: 36 }, [{ id: "r1", time: ago(37) }]);
    expect(await evaluate({ prisma, now: NOW })).toHaveLength(1);
  });
});
