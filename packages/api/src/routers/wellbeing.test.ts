import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prismaMock } from "../test/setup";
import {
  createTestContext,
  createUnauthenticatedContext,
  TEST_IDS,
} from "../test/helpers";
import { createCallerFactory } from "../trpc";
import { wellbeingRouter } from "./wellbeing";

const createCaller = createCallerFactory(wellbeingRouter);
const OTHER_USER = "clq1234567890abcdefghij99";

describe("wellbeingRouter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 23:30 UTC on 9 March is already 10 March in Oslo
    vi.setSystemTime(new Date("2025-03-09T23:30:00.000Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("rejects unauthenticated callers", async () => {
    const caller = createCaller(createUnauthenticatedContext());
    await expect(caller.recent()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.upsertToday({ mood: 3 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  describe("upsertToday", () => {
    it("saves today's Oslo date for the session user", async () => {
      prismaMock.parentCheckIn.upsert.mockResolvedValue({
        date: new Date("2025-03-10T00:00:00.000Z"),
        mood: 4,
        sleepHours: 6.5,
        note: null,
      } as never);

      const result = await createCaller(createTestContext()).upsertToday({
        mood: 4,
        sleepHours: 6.5,
      });

      const date = new Date("2025-03-10T00:00:00.000Z");
      expect(prismaMock.parentCheckIn.upsert).toHaveBeenCalledWith({
        where: { userId_date: { userId: TEST_IDS.userId, date } },
        create: { userId: TEST_IDS.userId, date, mood: 4, sleepHours: 6.5, note: null },
        update: { mood: 4, sleepHours: 6.5, note: null },
      });
      expect(result).toEqual({ date: "2025-03-10", mood: 4, sleepHours: 6.5, note: null });
    });

    it("validates mood, hours and note length", async () => {
      const caller = createCaller(createTestContext());
      await expect(caller.upsertToday({ mood: 0 })).rejects.toThrow();
      await expect(caller.upsertToday({ mood: 6 })).rejects.toThrow();
      await expect(caller.upsertToday({ mood: 3.5 })).rejects.toThrow();
      await expect(caller.upsertToday({ mood: 3, sleepHours: 25 })).rejects.toThrow();
      await expect(caller.upsertToday({ mood: 3, sleepHours: -1 })).rejects.toThrow();
      await expect(caller.upsertToday({ mood: 3, note: "x".repeat(501) })).rejects.toThrow();
      expect(prismaMock.parentCheckIn.upsert).not.toHaveBeenCalled();
    });

    it("ignores a userId passed in the input", async () => {
      prismaMock.parentCheckIn.upsert.mockResolvedValue({
        date: new Date("2025-03-10T00:00:00.000Z"),
        mood: 3,
        sleepHours: null,
        note: null,
      } as never);
      await createCaller(createTestContext()).upsertToday({
        mood: 3,
        userId: OTHER_USER,
      } as never);
      expect(prismaMock.parentCheckIn.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_date: expect.objectContaining({ userId: TEST_IDS.userId }) },
        })
      );
    });
  });

  describe("recent", () => {
    it("reads only the caller's check-ins for the last 14 days", async () => {
      prismaMock.parentCheckIn.findMany.mockResolvedValue([
        { date: new Date("2025-03-10T00:00:00.000Z"), mood: 2, sleepHours: null, note: "slitent" },
      ] as never);

      const result = await createCaller(createTestContext()).recent();

      expect(prismaMock.parentCheckIn.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: TEST_IDS.userId,
            date: { gte: new Date("2025-02-25T00:00:00.000Z") },
          },
        })
      );
      expect(result).toEqual([{ date: "2025-03-10", mood: 2, sleepHours: null, note: "slitent" }]);
    });

    it("never queries another user's rows", async () => {
      prismaMock.parentCheckIn.findMany.mockResolvedValue([] as never);
      const ctx = createTestContext({
        session: { user: { id: OTHER_USER, email: "o@example.com", name: "O", image: null } },
      });
      await createCaller(ctx).recent();
      const where = prismaMock.parentCheckIn.findMany.mock.calls[0]![0]!.where;
      expect(where?.userId).toBe(OTHER_USER);
    });
  });

  describe("delete", () => {
    it("deletes only the caller's entry for that date", async () => {
      prismaMock.parentCheckIn.deleteMany.mockResolvedValue({ count: 1 } as never);
      const result = await createCaller(createTestContext()).delete({ date: "2025-03-08" });
      expect(prismaMock.parentCheckIn.deleteMany).toHaveBeenCalledWith({
        where: { userId: TEST_IDS.userId, date: new Date("2025-03-08T00:00:00.000Z") },
      });
      expect(result).toEqual({ deleted: 1 });
    });

    it("rejects a malformed date", async () => {
      await expect(
        createCaller(createTestContext()).delete({ date: "yesterday" })
      ).rejects.toThrow();
    });
  });
});
