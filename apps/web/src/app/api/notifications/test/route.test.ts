import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findSubscriptions: vi.fn(),
  findSettings: vi.fn(),
  createLog: vi.fn(),
  sendToSubscriptions: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@baby-atlas/db", () => ({
  prisma: {
    pushSubscription: { findMany: mocks.findSubscriptions },
    notificationSettings: { findUnique: mocks.findSettings },
    notificationLog: { createMany: mocks.createLog },
  },
}));
vi.mock("@/lib/notifications/send", () => ({
  isPushConfigured: () => true,
  sendToSubscriptions: mocks.sendToSubscriptions,
}));

import { POST } from "./route";

describe("POST /api/notifications/test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.findSubscriptions.mockResolvedValue([{ id: "s1" }]);
    mocks.findSettings.mockResolvedValue({ locale: "en" });
    mocks.createLog.mockResolvedValue({ count: 1 });
    mocks.sendToSubscriptions.mockResolvedValue({ sent: 1, removed: 0, failed: 0 });
  });

  it("requires a session", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await POST()).status).toBe(401);
  });

  it("answers 409 without using up the rate limit when there is no subscription", async () => {
    mocks.findSubscriptions.mockResolvedValue([]);
    expect((await POST()).status).toBe(409);
    expect(mocks.createLog).not.toHaveBeenCalled();
  });

  it("sends once, then answers 429 while the window's claim is taken", async () => {
    expect((await POST()).status).toBe(200);
    expect(mocks.createLog).toHaveBeenCalledWith({
      data: [expect.objectContaining({ userId: "user-1", dedupeKey: expect.stringMatching(/^test:\d+$/) })],
      skipDuplicates: true,
    });

    mocks.createLog.mockResolvedValue({ count: 0 });
    const limited = await POST();
    expect(limited.status).toBe(429);
    expect(mocks.sendToSubscriptions).toHaveBeenCalledTimes(1);
  });
});
