import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  runDispatcher: vi.fn(),
  isPushConfigured: vi.fn(),
}));

vi.mock("@baby-atlas/db", () => ({ prisma: {} }));
vi.mock("@/lib/notifications/dispatcher", () => ({ runDispatcher: mocks.runDispatcher }));
vi.mock("@/lib/notifications/send", () => ({ isPushConfigured: mocks.isPushConfigured }));

import { GET } from "./route";

function get(authorization?: string) {
  return GET(
    new Request("http://localhost/api/cron/notifications", {
      headers: authorization ? { authorization } : {},
    })
  );
}

describe("GET /api/cron/notifications", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    mocks.isPushConfigured.mockReturnValue(true);
    mocks.runDispatcher.mockResolvedValue({ sent: 3 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("rejects a missing or wrong secret", async () => {
    expect((await get()).status).toBe(401);
    expect((await get("Bearer nope")).status).toBe(401);
    expect((await get("s3cret")).status).toBe(401);
    expect(mocks.runDispatcher).not.toHaveBeenCalled();
  });

  it("rejects everything when no secret is configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await get("Bearer ")).status).toBe(401);
    expect(mocks.runDispatcher).not.toHaveBeenCalled();
  });

  it("answers 503 when push is not configured", async () => {
    mocks.isPushConfigured.mockReturnValue(false);
    const response = await get("Bearer s3cret");
    expect(response.status).toBe(503);
    expect(mocks.runDispatcher).not.toHaveBeenCalled();
  });

  it("runs the dispatcher and returns its counts", async () => {
    const response = await get("Bearer s3cret");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sent: 3 });
  });

  it("answers 500 without details when the run fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.runDispatcher.mockRejectedValue(new Error("db down"));
    const response = await get("Bearer s3cret");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "dispatch_failed" });
  });
});
