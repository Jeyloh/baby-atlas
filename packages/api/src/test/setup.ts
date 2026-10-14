import { beforeEach, vi } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@baby-atlas/db";

// Create the mock and store it in globalThis for proper access
const createPrismaMock = () => mockDeep<PrismaClient>();
(globalThis as Record<string, unknown>).__prismaMock__ =
  (globalThis as Record<string, unknown>).__prismaMock__ ?? createPrismaMock();

export const prismaMock = (globalThis as Record<string, unknown>)
  .__prismaMock__ as DeepMockProxy<PrismaClient>;

// Mock the @baby-atlas/db module
vi.mock("@baby-atlas/db", () => ({
  prisma: (globalThis as Record<string, unknown>).__prismaMock__,
}));

// Matches TEST_IDS.childId in helpers.ts (not imported to avoid a cycle)
const TEST_CHILD_ID = "clq1234567890abcdefghij03";

beforeEach(() => {
  mockReset(prismaMock);

  // By default every record belongs to the test child, so recordProcedure's
  // ownership lookup passes. Tests override these to cover other cases.
  // Timer records also carry a start, which the end and update procedures read
  const owned = {
    childId: TEST_CHILD_ID,
    startTime: new Date("2024-01-15T10:00:00Z"),
    endTime: null,
  } as never;
  prismaMock.sleepRecord.findUnique.mockResolvedValue(owned);
  prismaMock.feedingRecord.findUnique.mockResolvedValue(owned);
  prismaMock.diaperRecord.findUnique.mockResolvedValue(owned);
  prismaMock.pumpingRecord.findUnique.mockResolvedValue(owned);
  prismaMock.growthRecord.findUnique.mockResolvedValue(owned);
  prismaMock.activityRecord.findUnique.mockResolvedValue(owned);
  prismaMock.temperatureRecord.findUnique.mockResolvedValue(owned);
  prismaMock.medicine.findUnique.mockResolvedValue(owned);
  prismaMock.journalEntry.findUnique.mockResolvedValue(owned);
  prismaMock.journalPhoto.findUnique.mockResolvedValue({
    entry: { childId: TEST_CHILD_ID },
  } as never);
  prismaMock.medicineRecord.findUnique.mockResolvedValue({
    medicine: { childId: TEST_CHILD_ID },
  } as never);
});
