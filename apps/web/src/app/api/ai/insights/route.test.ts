import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findChild: vi.fn(),
  checkUserSubscription: vi.fn(),
  getRequestLocale: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@baby-atlas/db", () => ({
  prisma: { child: { findUnique: mocks.findChild } },
}));
vi.mock("@/lib/subscription", () => ({
  checkUserSubscription: mocks.checkUserSubscription,
}));
vi.mock("@/lib/insights/request-locale", () => ({
  getRequestLocale: mocks.getRequestLocale,
}));
vi.mock("@/lib/insights/load-data", () => ({ loadInsightsData: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn(() => {
    throw new Error("The Anthropic API must not be called in tests");
  }),
}));

import { POST } from "./route";

const childId = "clq1234567890abcdefghij03";

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/ai/insights", {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
}

describe("POST /api/ai/insights", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.findChild.mockResolvedValue({
      id: childId,
      name: "Baby",
      birthDate: new Date("2024-01-01"),
      household: { members: [{ userId: "user-1" }] },
    });
    mocks.checkUserSubscription.mockResolvedValue({ isPremium: true });
    mocks.getRequestLocale.mockResolvedValue("nb");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns 401 without a session", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await post({ childId })).status).toBe(401);
  });

  it("returns 400 for an invalid body", async () => {
    expect((await post({ question: "hi" })).status).toBe(400);
  });

  it("returns 403 when the user is not in the household", async () => {
    mocks.findChild.mockResolvedValue({
      id: childId,
      household: { members: [] },
    });
    expect((await post({ childId })).status).toBe(403);
  });

  it("returns 402 premium_required for non-premium users", async () => {
    mocks.checkUserSubscription.mockResolvedValue({ isPremium: false });
    const response = await post({ childId });
    expect(response.status).toBe(402);
    expect(await response.json()).toEqual({ error: "premium_required" });
  });

  it("returns 503 when the API key is missing", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect((await post({ childId })).status).toBe(503);
  });
});
