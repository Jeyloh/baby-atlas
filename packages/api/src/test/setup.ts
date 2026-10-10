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

beforeEach(() => {
  mockReset(prismaMock);
});
