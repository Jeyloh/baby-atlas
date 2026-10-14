import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@baby-atlas/db";
import { buildTimerCandidates, evaluate, type OpenTimer } from "./timer-running";
import { translatePush } from "../translate";

const NOW = new Date("2026-03-01T20:00:00Z");
const minutesAgo = (min: number) => new Date(NOW.getTime() - min * 60_000);

function timer(overrides: Partial<OpenTimer> = {}): OpenTimer {
  return {
    kind: "sleep",
    recordId: "rec1",
    childId: "child1",
    childName: "Emma",
    startTime: minutesAgo(10),
    sleepType: "NAP",
    members: [
      { userId: "mom", role: "OWNER" },
      { userId: "dad", role: "CAREGIVER" },
      { userId: "gran", role: "VIEWER" },
    ],
    ...overrides,
  };
}

describe("buildTimerCandidates", () => {
  it("returns nothing for a timer below its threshold", () => {
    expect(buildTimerCandidates([timer({ startTime: minutesAgo(179) })], new Map(), NOW)).toEqual([]);
  });

  it("notifies at the threshold (tier 1) for everyone but viewers", () => {
    const [candidate, ...rest] = buildTimerCandidates([timer({ startTime: minutesAgo(180) })], new Map(), NOW);
    expect(rest).toEqual([]);
    expect(candidate).toMatchObject({
      kind: "TIMER_RUNNING",
      childId: "child1",
      dedupeKey: "timer:rec1:1x",
      replaceKey: "timer:rec1",
      url: "/dashboard/child1?fixTimer=sleep:rec1",
      titleKey: "push.timerRunning.title1",
      bodyKey: "push.timerRunning.body1",
      audience: ["mom", "dad"],
      params: { childName: "Emma", type: "nap", hours: 3, minutes: 0 },
    });
  });

  it("uses tier 2 at twice the threshold with the same replaceKey", () => {
    const [candidate] = buildTimerCandidates([timer({ startTime: minutesAgo(360) })], new Map(), NOW);
    expect(candidate).toMatchObject({
      dedupeKey: "timer:rec1:2x",
      replaceKey: "timer:rec1",
      titleKey: "push.timerRunning.title2",
      bodyKey: "push.timerRunning.body2",
    });
  });

  it("never sends tier 1 and 2 to the same person in one run", () => {
    const candidates = buildTimerCandidates([timer({ startTime: minutesAgo(400) })], new Map(), NOW);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].dedupeKey).toBe("timer:rec1:2x");
  });

  it("uses the night sleep threshold for night sleep", () => {
    // 5 h is far past a nap threshold but normal for a night
    expect(
      buildTimerCandidates([timer({ sleepType: "NIGHT", startTime: minutesAgo(300) })], new Map(), NOW)
    ).toEqual([]);
  });

  it("maps feeding kinds to their own type and a feeding link", () => {
    const [candidate] = buildTimerCandidates(
      [timer({ kind: "breast", recordId: "feed1", startTime: minutesAgo(70) })],
      new Map(),
      NOW
    );
    expect(candidate.params.type).toBe("breastfeeding");
    expect(candidate.url).toBe("/dashboard/child1?fixTimer=feeding:feed1");
  });

  it("applies each person's own thresholds, grouping people in the same tier", () => {
    // Nap running for 100 min: dad lowered the nap threshold to 45 min (tier 2),
    // mom lowered it to 90 (tier 1)
    const overrides = new Map([
      ["mom", { nap: 90 }],
      ["dad", { nap: 45 }],
    ]);
    const candidates = buildTimerCandidates([timer({ startTime: minutesAgo(100) })], overrides, NOW);
    const byKey = Object.fromEntries(candidates.map((c) => [c.dedupeKey, c.audience]));
    expect(byKey).toEqual({ "timer:rec1:1x": ["mom"], "timer:rec1:2x": ["dad"] });
  });

  it("lets a person raise the threshold so they are not notified", () => {
    const overrides = new Map([["mom", { nap: 600 }]]);
    const [candidate] = buildTimerCandidates([timer({ startTime: minutesAgo(200) })], overrides, NOW);
    expect(candidate.audience).toEqual(["dad"]);
  });

  it("skips a tier that was reached long ago", () => {
    // Tier 2 of a nap was reached at 360 min; 360 + 13 h ago is stale
    expect(buildTimerCandidates([timer({ startTime: minutesAgo(360 + 13 * 60) })], new Map(), NOW)).toEqual([]);
  });
});

describe("push texts", () => {
  const params = { childName: "Emma", type: "nap", hours: 3, minutes: 5 };

  it("render in Norwegian and English", () => {
    expect(translatePush("nb", "push.timerRunning.body1", params)).toBe(
      "Luren til Emma har pågått i 3 t 5 min. Trykk for å sette sluttid."
    );
    expect(translatePush("en", "push.timerRunning.body2", { ...params, hours: 0, minutes: 40 })).toBe(
      "Emma's nap has now been running for 40 min. Tap to correct the end time."
    );
    expect(translatePush("nb", "push.timerRunning.title1")).toBe("Har du glemt å stoppe tidtakeren?");
    expect(translatePush("en", "push.timerRunning.title2")).toBe("The timer is still running");
  });

  it("fall back to the generic activity wording", () => {
    expect(translatePush("en", "push.timerRunning.body1", { ...params, type: "activity" })).toContain(
      "activity"
    );
  });
});

describe("evaluate", () => {
  function fakePrisma(overrides: { sleep?: unknown[]; thresholds?: unknown } = {}) {
    const child = {
      id: "child1",
      name: "Emma",
      household: { members: [{ userId: "mom", role: "OWNER" }] },
    };
    return {
      sleepRecord: {
        findMany: vi.fn(async () => overrides.sleep ?? [
          { id: "rec1", startTime: minutesAgo(200), sleepType: "NAP", child },
        ]),
      },
      feedingRecord: { findMany: vi.fn(async () => []) },
      pumpingRecord: { findMany: vi.fn(async () => []) },
      activityRecord: { findMany: vi.fn(async () => []) },
      notificationSettings: {
        findMany: vi.fn(async () => [{ userId: "mom", timerThresholds: overrides.thresholds ?? null }]),
      },
    };
  }

  it("builds candidates from open records and asks only for open, recent records of subscribed households", async () => {
    const prisma = fakePrisma();
    const result = await evaluate({ prisma: prisma as unknown as PrismaClient, now: NOW });

    expect(result).toHaveLength(1);
    expect(result[0].dedupeKey).toBe("timer:rec1:1x");

    const where = (prisma.sleepRecord.findMany.mock.calls as unknown as [{ where: Record<string, unknown> }][])[0][0].where;
    expect(where).toMatchObject({
      endTime: null,
      child: { household: { members: { some: { user: { pushSubscriptions: { some: {} } } } } } },
    });
    expect(where.startTime).toMatchObject({ gte: expect.any(Date), lte: expect.any(Date) });
  });

  it("honours a stored override and ignores a malformed one", async () => {
    const raised = await evaluate({
      prisma: fakePrisma({ thresholds: { nap: 600 } }) as unknown as PrismaClient,
      now: NOW,
    });
    expect(raised).toEqual([]);

    const broken = await evaluate({
      prisma: fakePrisma({ thresholds: { nap: "soon" } }) as unknown as PrismaClient,
      now: NOW,
    });
    expect(broken).toHaveLength(1);
  });

  it("does not read settings when nothing is running", async () => {
    const prisma = fakePrisma({ sleep: [] });
    expect(await evaluate({ prisma: prisma as unknown as PrismaClient, now: NOW })).toEqual([]);
    expect(prisma.notificationSettings.findMany).not.toHaveBeenCalled();
  });
});
