import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
  deleteMany: vi.fn(),
  storePushSubscription: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@baby-atlas/db", () => ({
  prisma: { pushSubscription: { findUnique: mocks.findUnique, deleteMany: mocks.deleteMany } },
}));
vi.mock("@baby-atlas/api", () => ({ storePushSubscription: mocks.storePushSubscription }));

import { POST } from "./route";

const OLD = "https://fcm.googleapis.com/fcm/send/old";
const NEW = "https://fcm.googleapis.com/fcm/send/new";
const body = { oldEndpoint: OLD, newEndpoint: NEW, keys: { p256dh: "p", auth: "a" } };

function post(payload: unknown) {
  return POST(new Request("http://localhost/api/notifications/resubscribe", {
    method: "POST",
    body: JSON.stringify(payload),
  }));
}

describe("POST /api/notifications/resubscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.findUnique.mockResolvedValue({ userId: "user-1", userAgent: "UA" });
  });

  it("requires a session", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await post(body)).status).toBe(401);
    expect(mocks.storePushSubscription).not.toHaveBeenCalled();
  });

  it("rejects an invalid body or an unknown push service", async () => {
    expect((await post({ ...body, newEndpoint: "https://example.com/x" })).status).toBe(400);
    expect((await post({})).status).toBe(400);
  });

  it("does not move a subscription that belongs to someone else", async () => {
    mocks.findUnique.mockResolvedValue({ userId: "someone-else", userAgent: null });
    expect((await post(body)).status).toBe(404);
    expect(mocks.storePushSubscription).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("stores the new subscription and removes the old one", async () => {
    const response = await post(body);
    expect(response.status).toBe(200);
    expect(mocks.storePushSubscription).toHaveBeenCalledWith(expect.anything(), "user-1", {
      endpoint: NEW,
      keys: body.keys,
      userAgent: "UA",
    });
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { endpoint: OLD, userId: "user-1" } });
  });
});
