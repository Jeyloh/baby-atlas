// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";
import { fakeHeic, jpegWithGps, plainImage } from "@/lib/journal/test-images";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  entryFind: vi.fn(),
  childFind: vi.fn(),
  memberFind: vi.fn(),
  photoCount: vi.fn(),
  photoAggregate: vi.fn(),
  photoCreate: vi.fn(),
  photoUpdate: vi.fn(),
  photoDelete: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@baby-atlas/db", () => ({
  prisma: {
    journalEntry: { findUnique: mocks.entryFind },
    child: { findUnique: mocks.childFind },
    householdMember: { findUnique: mocks.memberFind },
    journalPhoto: {
      count: mocks.photoCount,
      aggregate: mocks.photoAggregate,
      create: mocks.photoCreate,
      update: mocks.photoUpdate,
      delete: mocks.photoDelete,
    },
  },
}));
vi.mock("@/lib/storage", () => ({
  getStorage: () => ({ put: mocks.put, delete: mocks.del, get: vi.fn() }),
}));

import { POST } from "./route";

const ENTRY_ID = "entry-1";
const CHILD_ID = "child-1";
const USER_ID = "user-1";

function upload(
  file: Buffer | null,
  { type = "image/jpeg", entryId = ENTRY_ID }: { type?: string; entryId?: string | null } = {}
) {
  const form = new FormData();
  if (entryId !== null) form.set("entryId", entryId);
  if (file) form.set("file", new File([new Uint8Array(file)], "photo", { type }));
  return POST(new Request("http://localhost/api/journal/photos", { method: "POST", body: form }));
}

describe("POST /api/journal/photos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: USER_ID } });
    mocks.entryFind.mockResolvedValue({ id: ENTRY_ID, childId: CHILD_ID, authorId: USER_ID });
    mocks.childFind.mockResolvedValue({ householdId: "house-1" });
    mocks.memberFind.mockResolvedValue({ role: "CAREGIVER" });
    mocks.photoCount.mockResolvedValue(0);
    mocks.photoAggregate.mockResolvedValue({ _max: { position: null } });
    mocks.photoCreate.mockResolvedValue({ id: "photo-1" });
    mocks.photoUpdate.mockResolvedValue({});
    mocks.photoDelete.mockResolvedValue({});
    mocks.put.mockResolvedValue(undefined);
    mocks.del.mockResolvedValue(undefined);
  });

  describe("access", () => {
    it("rejects a request without a session", async () => {
      mocks.auth.mockResolvedValue(null);
      expect((await upload(await plainImage("jpeg"))).status).toBe(401);
      expect(mocks.put).not.toHaveBeenCalled();
    });

    it("answers 404 for an entry in a household the user is not part of", async () => {
      mocks.memberFind.mockResolvedValue(null);
      expect((await upload(await plainImage("jpeg"))).status).toBe(404);
      expect(mocks.put).not.toHaveBeenCalled();
      expect(mocks.photoCreate).not.toHaveBeenCalled();
    });

    it("answers 404 for an entry that does not exist", async () => {
      mocks.entryFind.mockResolvedValue(null);
      expect((await upload(await plainImage("jpeg"))).status).toBe(404);
    });

    it("rejects viewers", async () => {
      mocks.memberFind.mockResolvedValue({ role: "VIEWER" });
      expect((await upload(await plainImage("jpeg"))).status).toBe(403);
      expect(mocks.put).not.toHaveBeenCalled();
    });

    it("rejects a caregiver adding photos to someone else's entry", async () => {
      mocks.entryFind.mockResolvedValue({ id: ENTRY_ID, childId: CHILD_ID, authorId: "other-user" });
      expect((await upload(await plainImage("jpeg"))).status).toBe(403);
    });

    it("lets an admin add photos to someone else's entry", async () => {
      mocks.memberFind.mockResolvedValue({ role: "ADMIN" });
      mocks.entryFind.mockResolvedValue({ id: ENTRY_ID, childId: CHILD_ID, authorId: "other-user" });
      expect((await upload(await plainImage("jpeg"))).status).toBe(201);
    });
  });

  describe("validation", () => {
    it("rejects a missing file or entry id", async () => {
      expect((await upload(null)).status).toBe(400);
      expect((await upload(await plainImage("jpeg"), { entryId: null })).status).toBe(400);
    });

    it("rejects an empty file", async () => {
      expect((await upload(Buffer.alloc(0))).status).toBe(400);
    });

    it("rejects a declared type outside the allowed list", async () => {
      const response = await upload(await plainImage("png"), { type: "image/gif" });
      expect(response.status).toBe(415);
      expect(mocks.put).not.toHaveBeenCalled();
    });

    it.each([
      ["HTML", Buffer.from("<html><script>alert(1)</script></html>")],
      ["SVG", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
      ["a GIF", Buffer.from("GIF89a" + "x".repeat(40))],
    ])("rejects %s sent with a jpeg content type, by magic bytes", async (_name, bytes) => {
      const response = await upload(bytes, { type: "image/jpeg" });
      expect(response.status).toBe(415);
      expect(await response.json()).toEqual({ error: "unsupported_type" });
      expect(mocks.photoCreate).not.toHaveBeenCalled();
      expect(mocks.put).not.toHaveBeenCalled();
    });

    it("rejects a file over the size limit", async () => {
      const response = await upload(Buffer.alloc(8 * 1024 * 1024 + 1));
      expect(response.status).toBe(413);
    });

    it("rejects a request whose declared length is far over the limit before reading it", async () => {
      const request = new Request("http://localhost/api/journal/photos", {
        method: "POST",
        headers: { "content-length": String(50 * 1024 * 1024) },
        body: new FormData(),
      });
      expect((await POST(request)).status).toBe(413);
      expect(mocks.entryFind).not.toHaveBeenCalled();
    });

    it("rejects the seventh photo", async () => {
      mocks.photoCount.mockResolvedValue(6);
      const response = await upload(await plainImage("jpeg"));
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: "too_many_photos" });
      expect(mocks.photoCreate).not.toHaveBeenCalled();
    });

    it("rolls back when two uploads race past the limit", async () => {
      mocks.photoCount.mockResolvedValueOnce(5).mockResolvedValueOnce(7);
      const response = await upload(await plainImage("jpeg"));
      expect(response.status).toBe(409);
      expect(mocks.photoDelete).toHaveBeenCalledWith({ where: { id: "photo-1" } });
      expect(mocks.put).not.toHaveBeenCalled();
    });

    it("answers 415 heic_unsupported for HEIC that cannot be decoded", async () => {
      const response = await upload(fakeHeic(), { type: "image/heic" });
      expect(response.status).toBe(415);
      expect(await response.json()).toEqual({ error: "heic_unsupported" });
      expect(mocks.photoCreate).not.toHaveBeenCalled();
    });

    it("answers 415 unreadable_image for a truncated jpeg", async () => {
      const truncated = (await plainImage("jpeg")).subarray(0, 20);
      const response = await upload(truncated);
      expect(response.status).toBe(415);
      expect(await response.json()).toEqual({ error: "unreadable_image" });
    });
  });

  describe("storing", () => {
    it("re-encodes, strips location data and stores full and thumbnail under the photo key", async () => {
      const response = await upload(await jpegWithGps());

      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({ id: "photo-1", width: 1024, height: 2048 });

      const keys = mocks.put.mock.calls.map((call) => call[0]);
      expect(keys).toEqual([
        `journal/${CHILD_ID}/${ENTRY_ID}/photo-1.webp`,
        `journal/${CHILD_ID}/${ENTRY_ID}/photo-1.thumb.webp`,
      ]);
      for (const [, bytes, mimeType] of mocks.put.mock.calls) {
        expect(mimeType).toBe("image/webp");
        const meta = await sharp(bytes as Uint8Array).metadata();
        expect(meta.format).toBe("webp");
        expect(meta.exif).toBeUndefined();
        expect(Buffer.from(bytes as Uint8Array).includes(Buffer.from("SecretGpsDatum"))).toBe(false);
        expect(Buffer.from(bytes as Uint8Array).includes(Buffer.from("SecretCam"))).toBe(false);
      }
      expect(mocks.photoUpdate).toHaveBeenCalledWith({
        where: { id: "photo-1" },
        data: { storageKey: `journal/${CHILD_ID}/${ENTRY_ID}/photo-1.webp` },
      });
    });

    it("puts the new photo after the existing ones", async () => {
      mocks.photoAggregate.mockResolvedValue({ _max: { position: 3 } });
      await upload(await plainImage("png"), { type: "image/png" });
      expect(mocks.photoCreate.mock.calls[0]![0].data.position).toBe(4);
    });

    it("removes the row and the files when storage fails", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      mocks.put.mockRejectedValueOnce(new Error("disk full"));

      const response = await upload(await plainImage("jpeg"));

      expect(response.status).toBe(500);
      expect(mocks.photoDelete).toHaveBeenCalledWith({ where: { id: "photo-1" } });
      expect(mocks.del).toHaveBeenCalledWith(`journal/${CHILD_ID}/${ENTRY_ID}/photo-1.webp`);
      expect(mocks.del).toHaveBeenCalledWith(`journal/${CHILD_ID}/${ENTRY_ID}/photo-1.thumb.webp`);
      error.mockRestore();
    });
  });
});
