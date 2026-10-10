// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  photoFind: vi.fn(),
  childFind: vi.fn(),
  memberFind: vi.fn(),
  get: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@baby-atlas/db", () => ({
  prisma: {
    journalPhoto: { findUnique: mocks.photoFind },
    child: { findUnique: mocks.childFind },
    householdMember: { findUnique: mocks.memberFind },
  },
}));
vi.mock("@/lib/storage", () => ({
  getStorage: () => ({ get: mocks.get, put: vi.fn(), delete: vi.fn() }),
}));

import { GET } from "./route";

const KEY = "journal/child-1/entry-1/photo-1.webp";

function stream(bytes: number[]) {
  return new Response(new Uint8Array(bytes)).body!;
}

function get(query = "") {
  return GET(new Request(`http://localhost/api/journal/photos/photo-1${query}`), {
    params: Promise.resolve({ photoId: "photo-1" }),
  });
}

describe("GET /api/journal/photos/[photoId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.photoFind.mockResolvedValue({ storageKey: KEY, entry: { childId: "child-1" } });
    mocks.childFind.mockResolvedValue({ householdId: "house-1" });
    mocks.memberFind.mockResolvedValue({ role: "VIEWER" });
    mocks.get.mockImplementation(async () => ({
      stream: stream([1, 2, 3]),
      mimeType: "image/webp",
      size: 3,
    }));
  });

  it("streams the full image to a household member with a private cache header", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=3600");
    expect(response.headers.get("Content-Length")).toBe("3");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(Buffer.from([1, 2, 3]));
    expect(mocks.get).toHaveBeenCalledWith(KEY);
    expect(mocks.memberFind).toHaveBeenCalledWith({
      where: { householdId_userId: { householdId: "house-1", userId: "user-1" } },
    });
  });

  it("serves the thumbnail with ?size=thumb", async () => {
    await get("?size=thumb");
    expect(mocks.get).toHaveBeenCalledWith("journal/child-1/entry-1/photo-1.thumb.webp");
  });

  it("serves the full image for any other size value", async () => {
    await get("?size=../../etc/passwd");
    expect(mocks.get).toHaveBeenCalledWith(KEY);
  });

  it("answers 404, not 403, when the user is not in the household", async () => {
    mocks.memberFind.mockResolvedValue(null);
    const response = await get();
    expect(response.status).toBe(404);
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("answers the same 404 for a photo that does not exist", async () => {
    mocks.photoFind.mockResolvedValue(null);
    const response = await get();
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
  });

  it("answers 404 for a photo whose upload has not finished", async () => {
    mocks.photoFind.mockResolvedValue({ storageKey: "", entry: { childId: "child-1" } });
    expect((await get()).status).toBe(404);
  });

  it("answers 404 when the file is missing from storage", async () => {
    mocks.get.mockResolvedValue(null);
    expect((await get()).status).toBe(404);
  });

  it("answers 401 without a session and reads nothing", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await get()).status).toBe(401);
    expect(mocks.photoFind).not.toHaveBeenCalled();
    expect(mocks.get).not.toHaveBeenCalled();
  });
});
