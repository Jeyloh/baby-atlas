import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "../test/setup";
import {
  createTestContext,
  createTestChild,
  createTestMembership,
  TEST_IDS,
} from "../test/helpers";
import { createCallerFactory } from "../trpc";
import { journalRouter } from "./journal";

const createCaller = createCallerFactory(journalRouter);

const ENTRY_ID = "clq1234567890abcdefghij20";
const PHOTO_ID = "clq1234567890abcdefghij21";
const PHOTO_ID_2 = "clq1234567890abcdefghij22";
const OTHER_USER_ID = "clq1234567890abcdefghij30";
const OTHER_CHILD_ID = "clq1234567890abcdefghij99";
const OTHER_HOUSEHOLD_ID = "clq1234567890abcdefghij98";

function asRole(role: "OWNER" | "ADMIN" | "CAREGIVER" | "VIEWER") {
  prismaMock.child.findUnique.mockResolvedValue(createTestChild() as never);
  prismaMock.householdMember.findUnique.mockResolvedValue(createTestMembership({ role }) as never);
}

function entryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ENTRY_ID,
    date: new Date("2026-10-01T00:00:00.000Z"),
    text: "Første skritt",
    tags: ["MILESTONE"],
    authorId: TEST_IDS.userId,
    createdAt: new Date("2026-10-01T10:00:00.000Z"),
    updatedAt: new Date("2026-10-01T10:00:00.000Z"),
    author: { name: "Test User", email: "test@example.com" },
    photos: [],
    ...overrides,
  };
}

describe("journalRouter", () => {
  beforeEach(() => {
    asRole("OWNER");
  });

  describe("access control", () => {
    beforeEach(() => {
      prismaMock.child.findUnique.mockResolvedValue(
        createTestChild({ id: OTHER_CHILD_ID, householdId: OTHER_HOUSEHOLD_ID }) as never
      );
      prismaMock.householdMember.findUnique.mockResolvedValue(null);
      prismaMock.journalEntry.findUnique.mockResolvedValue({ childId: OTHER_CHILD_ID } as never);
      prismaMock.journalPhoto.findUnique.mockResolvedValue({
        entry: { childId: OTHER_CHILD_ID },
      } as never);
    });

    it("rejects listing another household's journal", async () => {
      const caller = createCaller(createTestContext());
      await expect(caller.list({ childId: OTHER_CHILD_ID, limit: 20 })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(prismaMock.journalEntry.findMany).not.toHaveBeenCalled();
    });

    it("rejects writing to another household's journal", async () => {
      const caller = createCaller(createTestContext());
      await expect(
        caller.create({ childId: OTHER_CHILD_ID, date: new Date(), text: "Hei", tags: ["EVERYDAY"] })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(prismaMock.journalEntry.create).not.toHaveBeenCalled();
    });

    it("rejects updating, deleting and reordering another household's entry", async () => {
      const caller = createCaller(createTestContext());
      await expect(caller.update({ id: ENTRY_ID, text: "x" })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(caller.delete({ id: ENTRY_ID })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        caller.reorderPhotos({ entryId: ENTRY_ID, photoIds: [PHOTO_ID] })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(prismaMock.journalEntry.update).not.toHaveBeenCalled();
      expect(prismaMock.journalEntry.delete).not.toHaveBeenCalled();
    });

    it("rejects deleting another household's photo and keeps the files", async () => {
      const ctx = createTestContext();
      const caller = createCaller(ctx);
      await expect(caller.deletePhoto({ photoId: PHOTO_ID })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(prismaMock.journalPhoto.delete).not.toHaveBeenCalled();
      expect(ctx.storage.delete).not.toHaveBeenCalled();
    });

    it("returns NOT_FOUND for an entry that does not exist", async () => {
      prismaMock.journalEntry.findUnique.mockResolvedValue(null);
      const caller = createCaller(createTestContext());
      await expect(caller.delete({ id: ENTRY_ID })).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("rejects own householdId combined with another family's childId", async () => {
      prismaMock.householdMember.findUnique.mockResolvedValue(
        createTestMembership({ role: "OWNER" }) as never
      );
      const caller = createCaller(createTestContext());
      await expect(
        caller.list({ childId: OTHER_CHILD_ID, householdId: TEST_IDS.householdId, limit: 20 } as never)
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(prismaMock.journalEntry.findMany).not.toHaveBeenCalled();
    });
  });

  describe("list", () => {
    it("returns newest first by date, then createdAt, and never storage keys", async () => {
      prismaMock.journalEntry.findMany.mockResolvedValue([
        entryRow({ photos: [{ id: PHOTO_ID, width: 800, height: 600, sizeBytes: 1234 }] }),
      ] as never);
      const caller = createCaller(createTestContext());

      const result = await caller.list({ childId: TEST_IDS.childId, limit: 20 });

      const args = prismaMock.journalEntry.findMany.mock.calls[0]![0]!;
      expect(args.orderBy).toEqual([{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }]);
      expect(args.where).toEqual({ childId: TEST_IDS.childId });
      expect(JSON.stringify(args.select)).not.toContain("storageKey");
      expect(result.items[0]).toMatchObject({
        id: ENTRY_ID,
        authorName: "Test User",
        photos: [{ id: PHOTO_ID, width: 800, height: 600, sizeBytes: 1234 }],
      });
      expect(JSON.stringify(result)).not.toContain("storageKey");
    });

    it("falls back to the email when the author has no name, and null without an author", async () => {
      prismaMock.journalEntry.findMany.mockResolvedValue([
        entryRow({ author: { name: null, email: "partner@example.com" } }),
        entryRow({ id: "clq1234567890abcdefghij23", author: null, authorId: null }),
      ] as never);
      const caller = createCaller(createTestContext());

      const { items } = await caller.list({ childId: TEST_IDS.childId, limit: 20 });

      expect(items[0]!.authorName).toBe("partner@example.com");
      expect(items[1]!.authorName).toBeNull();
    });

    it("filters by any of the selected tags", async () => {
      prismaMock.journalEntry.findMany.mockResolvedValue([] as never);
      const caller = createCaller(createTestContext());

      await caller.list({ childId: TEST_IDS.childId, tags: ["SICKNESS", "CLINIC"], limit: 20 });

      expect(prismaMock.journalEntry.findMany.mock.calls[0]![0]!.where).toEqual({
        childId: TEST_IDS.childId,
        tags: { hasSome: ["SICKNESS", "CLINIC"] },
      });
    });

    it("does not filter when the tag list is empty", async () => {
      prismaMock.journalEntry.findMany.mockResolvedValue([] as never);
      const caller = createCaller(createTestContext());

      await caller.list({ childId: TEST_IDS.childId, tags: [], limit: 20 });

      expect(prismaMock.journalEntry.findMany.mock.calls[0]![0]!.where).toEqual({
        childId: TEST_IDS.childId,
      });
    });

    it("pages with a cursor and returns the next cursor only when more rows exist", async () => {
      const rows = [
        entryRow({ id: "clq1234567890abcdefghij24" }),
        entryRow({ id: "clq1234567890abcdefghij25" }),
        entryRow({ id: "clq1234567890abcdefghij26" }),
      ];
      prismaMock.journalEntry.findMany.mockResolvedValueOnce(rows as never);
      const caller = createCaller(createTestContext());

      const first = await caller.list({
        childId: TEST_IDS.childId,
        limit: 2,
        cursor: "clq1234567890abcdefghij27",
      });

      const args = prismaMock.journalEntry.findMany.mock.calls[0]![0]!;
      expect(args.take).toBe(3);
      expect(args.cursor).toEqual({ id: "clq1234567890abcdefghij27" });
      expect(args.skip).toBe(1);
      expect(first.items).toHaveLength(2);
      expect(first.nextCursor).toBe("clq1234567890abcdefghij25");

      prismaMock.journalEntry.findMany.mockResolvedValueOnce(rows.slice(0, 2) as never);
      const last = await caller.list({ childId: TEST_IDS.childId, limit: 2 });
      expect(last.nextCursor).toBeUndefined();
    });

    it("marks which entries the caller can edit", async () => {
      asRole("CAREGIVER");
      prismaMock.journalEntry.findMany.mockResolvedValue([
        entryRow({ authorId: TEST_IDS.userId }),
        entryRow({ id: "clq1234567890abcdefghij23", authorId: OTHER_USER_ID }),
      ] as never);
      const caller = createCaller(createTestContext());

      const { items } = await caller.list({ childId: TEST_IDS.childId, limit: 20 });

      expect(items.map((item) => item.canEdit)).toEqual([true, false]);
    });

    it("lets viewers read but marks nothing as editable", async () => {
      asRole("VIEWER");
      prismaMock.journalEntry.findMany.mockResolvedValue([entryRow()] as never);
      const caller = createCaller(createTestContext());

      const { items } = await caller.list({ childId: TEST_IDS.childId, limit: 20 });

      expect(items[0]!.canEdit).toBe(false);
    });

    it("reports whether the caller can write at all", async () => {
      prismaMock.journalEntry.findMany.mockResolvedValue([] as never);

      asRole("VIEWER");
      expect((await createCaller(createTestContext()).list({ childId: TEST_IDS.childId, limit: 20 })).canWrite).toBe(false);

      asRole("CAREGIVER");
      expect((await createCaller(createTestContext()).list({ childId: TEST_IDS.childId, limit: 20 })).canWrite).toBe(true);
    });
  });

  describe("create", () => {
    it("stores the caller as the author", async () => {
      asRole("CAREGIVER");
      prismaMock.journalEntry.create.mockResolvedValue({ id: ENTRY_ID } as never);
      const caller = createCaller(createTestContext());

      await caller.create({
        childId: TEST_IDS.childId,
        date: new Date("2026-09-30T00:00:00.000Z"),
        text: "  Smilte for første gang  ",
        tags: ["FIRST_TIME", "FIRST_TIME", "FUNNY"],
      });

      expect(prismaMock.journalEntry.create.mock.calls[0]![0]!.data).toEqual({
        childId: TEST_IDS.childId,
        authorId: TEST_IDS.userId,
        date: new Date("2026-09-30T00:00:00.000Z"),
        text: "Smilte for første gang",
        tags: ["FIRST_TIME", "FUNNY"],
      });
    });

    it("rejects viewers", async () => {
      asRole("VIEWER");
      const caller = createCaller(createTestContext());

      await expect(
        caller.create({ childId: TEST_IDS.childId, date: new Date(), text: "Hei", tags: ["EVERYDAY"] })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(prismaMock.journalEntry.create).not.toHaveBeenCalled();
    });

    it.each([
      ["empty text", { text: "   ", tags: ["EVERYDAY"] }],
      ["too long text", { text: "a".repeat(5001), tags: ["EVERYDAY"] }],
      ["no tags", { text: "Hei", tags: [] }],
      ["an unknown tag", { text: "Hei", tags: ["NOPE"] }],
    ])("rejects %s", async (_name, patch) => {
      const caller = createCaller(createTestContext());
      await expect(
        caller.create({ childId: TEST_IDS.childId, date: new Date(), ...patch } as never)
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(prismaMock.journalEntry.create).not.toHaveBeenCalled();
    });
  });

  describe("update and delete rules", () => {
    beforeEach(() => {
      prismaMock.journalEntry.update.mockResolvedValue({ id: ENTRY_ID } as never);
      prismaMock.journalEntry.delete.mockResolvedValue({ id: ENTRY_ID } as never);
    });

    function entryWithAuthor(authorId: string | null) {
      prismaMock.journalEntry.findUnique.mockResolvedValue({
        childId: TEST_IDS.childId,
        authorId,
        photos: [{ storageKey: `journal/${TEST_IDS.childId}/${ENTRY_ID}/${PHOTO_ID}.webp` }],
      } as never);
    }

    it("lets a caregiver edit and delete their own entry", async () => {
      asRole("CAREGIVER");
      entryWithAuthor(TEST_IDS.userId);
      const caller = createCaller(createTestContext());

      await caller.update({ id: ENTRY_ID, text: "Ny tekst" });
      await caller.delete({ id: ENTRY_ID });

      expect(prismaMock.journalEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ENTRY_ID }, data: expect.objectContaining({ text: "Ny tekst" }) })
      );
      expect(prismaMock.journalEntry.delete).toHaveBeenCalledWith({ where: { id: ENTRY_ID } });
    });

    it("rejects a caregiver editing or deleting someone else's entry", async () => {
      asRole("CAREGIVER");
      entryWithAuthor(OTHER_USER_ID);
      const ctx = createTestContext();
      const caller = createCaller(ctx);

      await expect(caller.update({ id: ENTRY_ID, text: "x" })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(caller.delete({ id: ENTRY_ID })).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(prismaMock.journalEntry.update).not.toHaveBeenCalled();
      expect(prismaMock.journalEntry.delete).not.toHaveBeenCalled();
      expect(ctx.storage.delete).not.toHaveBeenCalled();
    });

    it.each(["OWNER", "ADMIN"] as const)("lets %s edit and delete anyone's entry", async (role) => {
      asRole(role);
      entryWithAuthor(OTHER_USER_ID);
      const caller = createCaller(createTestContext());

      await caller.update({ id: ENTRY_ID, tags: ["CLINIC"] });
      await caller.delete({ id: ENTRY_ID });

      expect(prismaMock.journalEntry.update).toHaveBeenCalled();
      expect(prismaMock.journalEntry.delete).toHaveBeenCalled();
    });

    it("rejects a viewer even for their own entry", async () => {
      asRole("VIEWER");
      entryWithAuthor(TEST_IDS.userId);
      const caller = createCaller(createTestContext());

      await expect(caller.update({ id: ENTRY_ID, text: "x" })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(caller.delete({ id: ENTRY_ID })).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("rejects a caregiver editing an entry whose author was removed", async () => {
      asRole("CAREGIVER");
      entryWithAuthor(null);
      const caller = createCaller(createTestContext());

      await expect(caller.update({ id: ENTRY_ID, text: "x" })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it("removes the photo and thumbnail files when an entry is deleted", async () => {
      entryWithAuthor(TEST_IDS.userId);
      const ctx = createTestContext();

      await createCaller(ctx).delete({ id: ENTRY_ID });

      const key = `journal/${TEST_IDS.childId}/${ENTRY_ID}/${PHOTO_ID}.webp`;
      expect(ctx.storage.delete).toHaveBeenCalledWith(key);
      expect(ctx.storage.delete).toHaveBeenCalledWith(
        `journal/${TEST_IDS.childId}/${ENTRY_ID}/${PHOTO_ID}.thumb.webp`
      );
    });

    it("still succeeds when file removal fails", async () => {
      entryWithAuthor(TEST_IDS.userId);
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const ctx = createTestContext({
        storage: { delete: vi.fn().mockRejectedValue(new Error("storage down")) },
      });

      await expect(createCaller(ctx).delete({ id: ENTRY_ID })).resolves.toEqual({ success: true });
      expect(error).toHaveBeenCalled();
      error.mockRestore();
    });
  });

  describe("deletePhoto", () => {
    const key = `journal/${TEST_IDS.childId}/${ENTRY_ID}/${PHOTO_ID}.webp`;

    function photoWithAuthor(authorId: string | null) {
      prismaMock.journalPhoto.findUnique.mockResolvedValue({
        storageKey: key,
        entry: { childId: TEST_IDS.childId, authorId },
      } as never);
    }

    it("deletes the row and both files for the author", async () => {
      asRole("CAREGIVER");
      photoWithAuthor(TEST_IDS.userId);
      const ctx = createTestContext();

      await createCaller(ctx).deletePhoto({ photoId: PHOTO_ID });

      expect(prismaMock.journalPhoto.delete).toHaveBeenCalledWith({ where: { id: PHOTO_ID } });
      expect(ctx.storage.delete).toHaveBeenCalledWith(key);
      expect(ctx.storage.delete).toHaveBeenCalledWith(
        `journal/${TEST_IDS.childId}/${ENTRY_ID}/${PHOTO_ID}.thumb.webp`
      );
    });

    it("rejects a caregiver deleting a photo on someone else's entry", async () => {
      asRole("CAREGIVER");
      photoWithAuthor(OTHER_USER_ID);
      const ctx = createTestContext();

      await expect(createCaller(ctx).deletePhoto({ photoId: PHOTO_ID })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(prismaMock.journalPhoto.delete).not.toHaveBeenCalled();
      expect(ctx.storage.delete).not.toHaveBeenCalled();
    });
  });

  describe("reorderPhotos", () => {
    beforeEach(() => {
      prismaMock.journalEntry.findUnique.mockResolvedValue({
        childId: TEST_IDS.childId,
        authorId: TEST_IDS.userId,
        photos: [{ id: PHOTO_ID }, { id: PHOTO_ID_2 }],
      } as never);
      prismaMock.$transaction.mockResolvedValue([] as never);
    });

    it("writes the new positions", async () => {
      const caller = createCaller(createTestContext());

      await caller.reorderPhotos({ entryId: ENTRY_ID, photoIds: [PHOTO_ID_2, PHOTO_ID] });

      expect(prismaMock.journalPhoto.update).toHaveBeenCalledWith({
        where: { id: PHOTO_ID_2 },
        data: { position: 0 },
      });
      expect(prismaMock.journalPhoto.update).toHaveBeenCalledWith({
        where: { id: PHOTO_ID },
        data: { position: 1 },
      });
    });

    it("rejects a list that does not match the entry's photos", async () => {
      const caller = createCaller(createTestContext());

      await expect(
        caller.reorderPhotos({ entryId: ENTRY_ID, photoIds: [PHOTO_ID, "clq1234567890abcdefghij40"] })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(
        caller.reorderPhotos({ entryId: ENTRY_ID, photoIds: [PHOTO_ID, PHOTO_ID] })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });
  });
});
