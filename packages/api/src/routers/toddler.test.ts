import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../test/setup";
import {
  createTestContext,
  createTestMembership,
  createTestChild,
  TEST_IDS,
} from "../test/helpers";
import { createCallerFactory } from "../trpc";
import { speechRouter } from "./speech";
import { pottyRouter } from "./potty";
import { vaccinationRouter } from "./vaccination";

const speech = createCallerFactory(speechRouter);
const potty = createCallerFactory(pottyRouter);
const vaccination = createCallerFactory(vaccinationRouter);

const childId = TEST_IDS.childId;
const recordId = TEST_IDS.recordId;

describe("toddler routers", () => {
  beforeEach(() => {
    prismaMock.child.findUnique.mockResolvedValue(createTestChild() as never);
    prismaMock.householdMember.findUnique.mockResolvedValue(
      createTestMembership({ role: "CAREGIVER" }) as never
    );
  });

  describe("access control", () => {
    it("rejects users outside the household", async () => {
      prismaMock.householdMember.findUnique.mockResolvedValue(null);
      const caller = speech(createTestContext());

      await expect(caller.list({ childId })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it("lets viewers read but not write", async () => {
      prismaMock.householdMember.findUnique.mockResolvedValue(
        createTestMembership({ role: "VIEWER" }) as never
      );
      prismaMock.speechWord.findMany.mockResolvedValue([]);
      const caller = speech(createTestContext());

      await expect(caller.list({ childId })).resolves.toEqual([]);
      await expect(
        caller.add({ childId, word: "mamma", firstSaidAt: new Date() })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("checks the record's household on delete by id", async () => {
      prismaMock.pottyReadinessLog.findUnique.mockResolvedValue({ childId } as never);
      prismaMock.householdMember.findUnique.mockResolvedValue(null);
      const caller = potty(createTestContext());

      await expect(caller.delete({ id: recordId })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(prismaMock.pottyReadinessLog.delete).not.toHaveBeenCalled();
    });

    it("returns NOT_FOUND when the record does not exist", async () => {
      prismaMock.speechWord.findUnique.mockResolvedValue(null);
      const caller = speech(createTestContext());

      await expect(caller.delete({ id: recordId })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });

  describe("speech", () => {
    it("trims and stores a new word", async () => {
      prismaMock.speechWord.create.mockResolvedValue({ id: recordId } as never);
      const caller = speech(createTestContext());

      await caller.add({ childId, word: "  bil ", firstSaidAt: new Date("2026-01-01") });

      expect(prismaMock.speechWord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ word: "bil", category: "WORD" }),
      });
    });
  });

  describe("potty", () => {
    it("requires at least one signal", async () => {
      const caller = potty(createTestContext());
      await expect(
        caller.log({ childId, time: new Date(), signals: [] })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("removes duplicate signals", async () => {
      prismaMock.pottyReadinessLog.create.mockResolvedValue({ id: recordId } as never);
      const caller = potty(createTestContext());

      await caller.log({
        childId,
        time: new Date(),
        signals: ["DRY_TWO_HOURS", "DRY_TWO_HOURS", "ANNOUNCES_NEED"],
      });

      expect(prismaMock.pottyReadinessLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ signals: ["DRY_TWO_HOURS", "ANNOUNCES_NEED"] }),
      });
    });
  });

  describe("vaccination", () => {
    it("rejects keys outside the programme", async () => {
      const caller = vaccination(createTestContext());
      await expect(
        caller.mark({ childId, vaccineKey: "made-up", givenAt: new Date() })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("upserts a known dose", async () => {
      prismaMock.vaccinationRecord.upsert.mockResolvedValue({ id: recordId } as never);
      const caller = vaccination(createTestContext());

      await caller.mark({ childId, vaccineKey: "mmr-1", givenAt: new Date("2026-04-01") });

      expect(prismaMock.vaccinationRecord.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { childId_vaccineKey: { childId, vaccineKey: "mmr-1" } },
        })
      );
    });
  });
});
