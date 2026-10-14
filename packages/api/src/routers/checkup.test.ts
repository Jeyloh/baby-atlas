import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../test/setup";
import {
  createTestContext,
  createTestChild,
  createTestMembership,
  createUnauthenticatedContext,
  TEST_IDS,
} from "../test/helpers";
import { createCallerFactory } from "../trpc";
import { checkupRouter } from "./checkup";

const createCaller = createCallerFactory(checkupRouter);
const childId = TEST_IDS.childId;

describe("checkupRouter", () => {
  beforeEach(() => {
    prismaMock.child.findUnique.mockResolvedValue(createTestChild() as never);
    prismaMock.householdMember.findUnique.mockResolvedValue(
      createTestMembership({ role: "CAREGIVER" }) as never
    );
  });

  describe("list", () => {
    it("merges stored records with the programme", async () => {
      prismaMock.child.findUnique.mockResolvedValue(
        createTestChild({ birthDate: new Date("2020-01-01T00:00:00Z") }) as never
      );
      prismaMock.checkupRecord.findMany.mockResolvedValue([
        {
          id: "x",
          childId,
          checkupKey: "month_3",
          scheduledAt: null,
          completedAt: new Date("2020-04-02T00:00:00Z"),
          notes: "Alt fint",
        },
      ] as never);

      const result = await createCaller(createTestContext()).list({ childId });

      expect(result.length).toBeGreaterThan(10);
      const m3 = result.find((v) => v.contact.key === "month_3");
      expect(m3).toMatchObject({ status: "done", notes: "Alt fint" });
      expect(result.find((v) => v.contact.key === "week_6")?.notes).toBeNull();
      expect(result.map((v) => v.contact.key as string)).not.toContain("year_4");
    });

    it("is open to viewers", async () => {
      prismaMock.householdMember.findUnique.mockResolvedValue(
        createTestMembership({ role: "VIEWER" }) as never
      );
      prismaMock.checkupRecord.findMany.mockResolvedValue([] as never);
      await expect(createCaller(createTestContext()).list({ childId })).resolves.toBeDefined();
    });
  });

  describe("setScheduled", () => {
    it("books a time", async () => {
      prismaMock.checkupRecord.upsert.mockResolvedValue({} as never);
      const scheduledAt = new Date("2026-11-03T08:30:00Z");

      await createCaller(createTestContext()).setScheduled({
        childId,
        checkupKey: "month_3",
        scheduledAt,
      });

      expect(prismaMock.checkupRecord.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { childId_checkupKey: { childId, checkupKey: "month_3" } },
          update: { scheduledAt },
        })
      );
    });

    it("removes the booking with null", async () => {
      prismaMock.checkupRecord.updateMany.mockResolvedValue({ count: 1 } as never);

      await createCaller(createTestContext()).setScheduled({
        childId,
        checkupKey: "month_3",
        scheduledAt: null,
      });

      expect(prismaMock.checkupRecord.updateMany).toHaveBeenCalledWith({
        where: { childId, checkupKey: "month_3" },
        data: { scheduledAt: null },
      });
    });

    it("rejects unknown checkups", async () => {
      await expect(
        createCaller(createTestContext()).setScheduled({
          childId,
          checkupKey: "year_4",
          scheduledAt: new Date(),
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  describe("markDone", () => {
    it("records the date", async () => {
      prismaMock.checkupRecord.upsert.mockResolvedValue({} as never);
      const completedAt = new Date("2026-01-05T00:00:00Z");

      await createCaller(createTestContext()).markDone({
        childId,
        checkupKey: "week_6",
        completedAt,
        notes: "Veide 4,2 kg",
      });

      expect(prismaMock.checkupRecord.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { completedAt, notes: "Veide 4,2 kg" },
        })
      );
    });

    it("rejects a date in the future", async () => {
      const future = new Date(Date.now() + 3 * 86_400_000);
      await expect(
        createCaller(createTestContext()).markDone({
          childId,
          checkupKey: "week_6",
          completedAt: future,
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(prismaMock.checkupRecord.upsert).not.toHaveBeenCalled();
    });
  });

  describe("undoDone", () => {
    it("clears the done date but keeps the record", async () => {
      prismaMock.checkupRecord.updateMany.mockResolvedValue({ count: 1 } as never);

      await createCaller(createTestContext()).undoDone({ childId, checkupKey: "week_6" });

      expect(prismaMock.checkupRecord.updateMany).toHaveBeenCalledWith({
        where: { childId, checkupKey: "week_6" },
        data: { completedAt: null },
      });
    });
  });

  describe("setNotes", () => {
    it("trims and clears empty notes", async () => {
      prismaMock.checkupRecord.upsert.mockResolvedValue({} as never);

      await createCaller(createTestContext()).setNotes({
        childId,
        checkupKey: "week_6",
        notes: "   ",
      });

      expect(prismaMock.checkupRecord.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { notes: null } })
      );
    });
  });

  describe("access control", () => {
    it("denies a user outside the household on every procedure", async () => {
      prismaMock.householdMember.findUnique.mockResolvedValue(null);
      const caller = createCaller(createTestContext());
      const base = { childId, checkupKey: "week_6" };

      await expect(caller.list({ childId })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        caller.setScheduled({ ...base, scheduledAt: new Date() })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        caller.markDone({ ...base, completedAt: new Date("2026-01-01") })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.undoDone(base)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.setNotes({ ...base, notes: "x" })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });

      expect(prismaMock.checkupRecord.findMany).not.toHaveBeenCalled();
      expect(prismaMock.checkupRecord.upsert).not.toHaveBeenCalled();
      expect(prismaMock.checkupRecord.updateMany).not.toHaveBeenCalled();
    });

    it("denies viewers on writes", async () => {
      prismaMock.householdMember.findUnique.mockResolvedValue(
        createTestMembership({ role: "VIEWER" }) as never
      );
      const caller = createCaller(createTestContext());
      const base = { childId, checkupKey: "week_6" };

      await expect(
        caller.setScheduled({ ...base, scheduledAt: new Date() })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        caller.markDone({ ...base, completedAt: new Date("2026-01-01") })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.undoDone(base)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.setNotes({ ...base, notes: "x" })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(prismaMock.checkupRecord.upsert).not.toHaveBeenCalled();
    });

    it("requires a session", async () => {
      await expect(
        createCaller(createUnauthenticatedContext()).list({ childId })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });
  });
});
