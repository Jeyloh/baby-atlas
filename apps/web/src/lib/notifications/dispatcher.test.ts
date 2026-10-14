import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@baby-atlas/db";
import { runDispatcher } from "./dispatcher";
import type { PushSender } from "./send";
import type { Candidate, Evaluate, NotificationKind } from "./types";

const NOW = new Date("2026-01-15T11:00:00Z"); // 12:00 in Oslo
const CHILD = "child-1";

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    kind: "TIMER_RUNNING",
    childId: CHILD,
    dedupeKey: "timer:rec-1:1x",
    url: `/dashboard/${CHILD}`,
    titleKey: "push.test.title",
    bodyKey: "push.test.body",
    params: {},
    ...overrides,
  };
}

/** A small in-memory stand-in for the tables the dispatcher uses. */
function createFakePrisma() {
  const logs: { userId: string; dedupeKey: string; kind: string; childId: string; sentAt: Date }[] = [];
  const subscriptions = [
    { id: "sub-1", userId: "owner", endpoint: "https://push.test/1", p256dh: "k", auth: "a", failureCount: 0, lastSuccessAt: null as Date | null, createdAt: NOW },
    { id: "sub-2", userId: "caregiver", endpoint: "https://push.test/2", p256dh: "k", auth: "a", failureCount: 0, lastSuccessAt: null as Date | null, createdAt: NOW },
  ];
  let oldLogsPruned = 0;

  const prisma = {
    child: {
      findMany: vi.fn(async () => [
        {
          id: CHILD,
          household: {
            members: [
              { userId: "owner", role: "OWNER" },
              { userId: "caregiver", role: "CAREGIVER" },
            ],
          },
        },
      ]),
    },
    notificationSettings: {
      findMany: vi.fn(async () => [
        { userId: "caregiver", enabledKinds: ["TIMER_RUNNING"], mutedChildIds: [], quietStart: null, quietEnd: null, locale: "en" },
      ]),
    },
    pushSubscription: {
      findMany: vi.fn(async () => subscriptions.map((s) => ({ ...s }))),
      updateMany: vi.fn(async ({ where, data }: { where: { id: string }; data: { failureCount?: number | { increment: number } } }) => {
        const sub = subscriptions.find((s) => s.id === where.id);
        if (sub && typeof data.failureCount === "object") sub.failureCount += data.failureCount.increment;
        if (sub && data.failureCount === 0) sub.failureCount = 0;
        return { count: sub ? 1 : 0 };
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const sub = subscriptions.find((s) => s.id === where.id);
        return sub ? { failureCount: sub.failureCount } : null;
      }),
      deleteMany: vi.fn(async ({ where }: { where: { id: string } }) => {
        const index = subscriptions.findIndex((s) => s.id === where.id);
        if (index >= 0) subscriptions.splice(index, 1);
        return { count: index >= 0 ? 1 : 0 };
      }),
    },
    notificationLog: {
      findMany: vi.fn(async () => logs.map((l) => ({ userId: l.userId, dedupeKey: l.dedupeKey }))),
      createMany: vi.fn(async ({ data }: { data: { userId: string; dedupeKey: string; kind: string; childId: string }[] }) => {
        let count = 0;
        for (const row of data) {
          if (logs.some((l) => l.userId === row.userId && l.dedupeKey === row.dedupeKey)) continue;
          logs.push({ ...row, sentAt: NOW });
          count += 1;
        }
        return { count };
      }),
      deleteMany: vi.fn(async ({ where }: { where: { sentAt?: unknown; userId?: string; dedupeKey?: string } }) => {
        if (where.sentAt) return { count: oldLogsPruned };
        const before = logs.length;
        for (let i = logs.length - 1; i >= 0; i -= 1) {
          if (logs[i]!.userId === where.userId && logs[i]!.dedupeKey === where.dedupeKey) logs.splice(i, 1);
        }
        return { count: before - logs.length };
      }),
    },
  };

  return { prisma: prisma as unknown as PrismaClient, mocks: prisma, logs, subscriptions, setOldLogs: (n: number) => (oldLogsPruned = n) };
}

function evaluatorsReturning(candidates: Candidate[]): Record<NotificationKind, Evaluate> {
  const none: Evaluate = async () => [];
  return {
    TIMER_RUNNING: async () => candidates,
    MEDICINE_NEXT_DOSE: none,
    FEED_DUE: none,
    NAP_DUE: none,
    CHECKUP_REMINDER: none,
    VACCINE_REMINDER: none,
    WEEKLY_DIGEST: none,
    WEEKLY_TIP: none,
  };
}

const okSender = () => vi.fn<PushSender>(async () => ({ ok: true }));

describe("runDispatcher", () => {
  let fake: ReturnType<typeof createFakePrisma>;

  beforeEach(() => {
    fake = createFakePrisma();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("sends to each recipient in their language and logs it", async () => {
    const sender = okSender();
    const result = await runDispatcher({
      prisma: fake.prisma,
      now: NOW,
      evaluators: evaluatorsReturning([candidate()]),
      sender,
    });

    expect(result).toMatchObject({ candidates: 1, planned: 2, claimed: 2, sent: 2 });
    expect(sender).toHaveBeenCalledTimes(2);

    const toOwner = sender.mock.calls.find(([sub]) => sub.id === "sub-1")!;
    const toCaregiver = sender.mock.calls.find(([sub]) => sub.id === "sub-2")!;
    expect(toOwner[1].title).toBe("Testvarsel fra Baby Atlas"); // no settings: Bokmål
    expect(toCaregiver[1].title).toBe("Test notification from Baby Atlas");
    expect(toOwner[1].url).toBe(`/dashboard/${CHILD}`);
    expect(toOwner[2]).toMatchObject({ ttlSeconds: 3600 });
    expect(fake.logs.map((l) => l.userId).sort()).toEqual(["caregiver", "owner"]);
  });

  it("is idempotent: a second run sends nothing new", async () => {
    const sender = okSender();
    const options = { prisma: fake.prisma, now: NOW, evaluators: evaluatorsReturning([candidate()]), sender };

    await runDispatcher(options);
    sender.mockClear();
    const second = await runDispatcher(options);

    expect(second).toMatchObject({ planned: 0, claimed: 0, sent: 0 });
    expect(sender).not.toHaveBeenCalled();
  });

  it("does not send when another run already claimed the notice", async () => {
    const sender = okSender();
    // The log is empty when this run reads it, but gets filled before it claims
    fake.mocks.notificationLog.findMany.mockResolvedValueOnce([]);
    fake.logs.push(
      { userId: "owner", dedupeKey: "timer:rec-1:1x", kind: "TIMER_RUNNING", childId: CHILD, sentAt: NOW },
      { userId: "caregiver", dedupeKey: "timer:rec-1:1x", kind: "TIMER_RUNNING", childId: CHILD, sentAt: NOW }
    );

    const result = await runDispatcher({
      prisma: fake.prisma,
      now: NOW,
      evaluators: evaluatorsReturning([candidate()]),
      sender,
    });

    expect(result).toMatchObject({ planned: 2, claimed: 0, sent: 0 });
    expect(sender).not.toHaveBeenCalled();
  });

  it("claims before it sends", async () => {
    const order: string[] = [];
    fake.mocks.notificationLog.createMany.mockImplementation(async () => {
      order.push("claim");
      return { count: 1 };
    });
    const sender = vi.fn<PushSender>(async () => {
      order.push("send");
      return { ok: true };
    });

    await runDispatcher({ prisma: fake.prisma, now: NOW, evaluators: evaluatorsReturning([candidate()]), sender });

    // Deliveries run side by side, but each one claims before it sends
    expect(order[0]).toBe("claim");
    expect(order.indexOf("send")).toBeGreaterThan(order.indexOf("claim"));
  });

  it("deletes a subscription that answers 410 and frees the claim", async () => {
    const sender = vi.fn<PushSender>(async () => ({ ok: false, gone: true, statusCode: 410 }));

    const result = await runDispatcher({
      prisma: fake.prisma,
      now: NOW,
      evaluators: evaluatorsReturning([candidate()]),
      sender,
    });

    expect(result).toMatchObject({ sent: 0, removedSubscriptions: 2 });
    expect(fake.subscriptions).toHaveLength(0);
    expect(fake.logs).toHaveLength(0);
  });

  it("counts permanent rejections (400, 403, 413) and deletes after five in a row", async () => {
    const sender = vi.fn<PushSender>(async () => ({ ok: false, gone: false, statusCode: 403 }));
    const options = { prisma: fake.prisma, now: NOW, evaluators: evaluatorsReturning([candidate()]), sender };

    await runDispatcher(options);
    expect(fake.subscriptions.map((s) => s.failureCount)).toEqual([1, 1]);
    // The claim was freed, so the next run tries again
    expect(fake.logs).toHaveLength(0);

    for (let i = 0; i < 4; i += 1) await runDispatcher(options);
    expect(fake.subscriptions).toHaveLength(0);
  });

  it.each([500, 503, 429, undefined])(
    "never deletes a recent subscription for a temporary failure (%s)",
    async (statusCode) => {
      const sender = vi.fn<PushSender>(async () => ({ ok: false, gone: false, statusCode }));
      const options = { prisma: fake.prisma, now: NOW, evaluators: evaluatorsReturning([candidate()]), sender };

      for (let i = 0; i < 8; i += 1) await runDispatcher(options);

      expect(fake.subscriptions).toHaveLength(2);
      expect(fake.subscriptions.map((s) => s.failureCount)).toEqual([0, 0]);
    }
  );

  it("drops a subscription that had only temporary failures for over 7 days", async () => {
    const sender = vi.fn<PushSender>(async () => ({ ok: false, gone: false, statusCode: 503 }));
    // sub-1 never succeeded and is 8 days old; sub-2 succeeded yesterday
    fake.subscriptions[0]!.createdAt = new Date(NOW.getTime() - 8 * 24 * 3600 * 1000);
    fake.subscriptions[1]!.createdAt = new Date(NOW.getTime() - 30 * 24 * 3600 * 1000);
    fake.subscriptions[1]!.lastSuccessAt = new Date(NOW.getTime() - 24 * 3600 * 1000);

    await runDispatcher({ prisma: fake.prisma, now: NOW, evaluators: evaluatorsReturning([candidate()]), sender });

    expect(fake.subscriptions.map((s) => s.id)).toEqual(["sub-2"]);
  });

  it("sends at most ten deliveries at the same time", async () => {
    const many = Array.from({ length: 25 }, (_, i) => candidate({ dedupeKey: `timer:rec-${i}:1x` }));
    let running = 0;
    let peak = 0;
    const sender = vi.fn<PushSender>(async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      return { ok: true };
    });

    const result = await runDispatcher({ prisma: fake.prisma, now: NOW, evaluators: evaluatorsReturning(many), sender });

    expect(result).toMatchObject({ planned: 50, claimed: 50, sent: 50, deferred: 0 });
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(10);
  });

  it("keeps going when an evaluator throws", async () => {
    const sender = okSender();
    const evaluators = evaluatorsReturning([candidate()]);
    evaluators.WEEKLY_TIP = async () => {
      throw new Error("boom");
    };

    const result = await runDispatcher({ prisma: fake.prisma, now: NOW, evaluators, sender });

    expect(result).toMatchObject({ evaluatorErrors: 1, sent: 2 });
  });

  it("prunes old log rows", async () => {
    fake.setOldLogs(7);
    const result = await runDispatcher({
      prisma: fake.prisma,
      now: NOW,
      evaluators: evaluatorsReturning([]),
      sender: okSender(),
    });

    expect(result.prunedLogs).toBe(7);
    const [{ where }] = fake.mocks.notificationLog.deleteMany.mock.calls[0] as unknown as [
      { where: { sentAt: { lt: Date } } },
    ];
    // 400 days before NOW
    expect(where.sentAt.lt.toISOString()).toBe(
      new Date(NOW.getTime() - 400 * 86_400_000).toISOString()
    );
  });

  it("defers the rest when the time budget is used up", async () => {
    const sender = okSender();
    const result = await runDispatcher({
      prisma: fake.prisma,
      now: NOW,
      evaluators: evaluatorsReturning([candidate()]),
      sender,
      timeBudgetMs: -1,
    });

    expect(result).toMatchObject({ planned: 2, claimed: 0, deferred: 2 });
    expect(sender).not.toHaveBeenCalled();
  });
});
