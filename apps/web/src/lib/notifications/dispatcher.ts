import type { PrismaClient } from "@baby-atlas/db";
import {
  planDeliveries,
  logKey,
  type Delivery,
  type HouseholdMemberRef,
  type RecipientSettings,
} from "./plan";
import { evaluators as defaultEvaluators, KIND_META } from "./registry";
import {
  sendToSubscriptions,
  sendWebPush,
  topicFor,
  type PushSender,
  type StoredSubscription,
} from "./send";
import { toLocale } from "@/i18n/config";
import { translatePush } from "./translate";
import type { Candidate, Evaluate, NotificationKind } from "./types";

/**
 * Sent notices are remembered this long. Longer than any evaluator window, and
 * long enough that once-only notices (vaccine and checkup reminders, relevant
 * for weeks to months) are not sent again.
 */
export const LOG_RETENTION_DAYS = 400;
/** Stop starting new sends after this long so the run ends within maxDuration. */
export const DEFAULT_TIME_BUDGET_MS = 45_000;
/** An evaluator that takes longer counts as failed; the others carry on. */
export const EVALUATOR_TIMEOUT_MS = 15_000;
/** Deliveries sent at the same time */
export const SEND_CONCURRENCY = 10;

export interface DispatchResult {
  candidates: number;
  planned: number;
  claimed: number;
  sent: number;
  failed: number;
  removedSubscriptions: number;
  evaluatorErrors: number;
  prunedLogs: number;
  /** Planned deliveries not attempted because the time budget ran out */
  deferred: number;
}

export interface DispatchOptions {
  prisma: PrismaClient;
  now?: Date;
  evaluators?: Record<NotificationKind, Evaluate>;
  sender?: PushSender;
  timeBudgetMs?: number;
}

function withTimeout<T>(promise: Promise<T>, ms = EVALUATOR_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`evaluator timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function collectCandidates(
  prisma: PrismaClient,
  now: Date,
  evaluators: Record<NotificationKind, Evaluate>
): Promise<{ candidates: Candidate[]; errors: number }> {
  // One failing evaluator must not stop the others
  const memo = new Map<string, Promise<unknown>>();
  const results = await Promise.allSettled(
    Object.values(evaluators).map((evaluate) => withTimeout(Promise.resolve().then(() => evaluate({ prisma, now, memo }))))
  );

  const candidates: Candidate[] = [];
  let errors = 0;
  for (const result of results) {
    if (result.status === "rejected") {
      errors += 1;
      console.error("[notifications] evaluator failed", result.reason);
    } else {
      candidates.push(...result.value);
    }
  }
  return { candidates, errors };
}

async function loadContext(prisma: PrismaClient, candidates: Candidate[]) {
  const childIds = [...new Set(candidates.map((c) => c.childId))];
  const children = await prisma.child.findMany({
    where: { id: { in: childIds } },
    select: {
      id: true,
      household: { select: { members: { select: { userId: true, role: true } } } },
    },
  });

  const membersByChild = new Map<string, HouseholdMemberRef[]>(
    children.map((child) => [child.id, child.household.members])
  );
  const userIds = [
    ...new Set([...membersByChild.values()].flatMap((members) => members.map((m) => m.userId))),
  ];

  const [settingsRows, subscriptions, logs] = await Promise.all([
    prisma.notificationSettings.findMany({ where: { userId: { in: userIds } } }),
    prisma.pushSubscription.findMany({
      where: { userId: { in: userIds } },
      select: {
        id: true,
        userId: true,
        endpoint: true,
        p256dh: true,
        auth: true,
        lastSuccessAt: true,
        createdAt: true,
      },
    }),
    prisma.notificationLog.findMany({
      where: {
        userId: { in: userIds },
        dedupeKey: { in: [...new Set(candidates.map((c) => c.dedupeKey))] },
      },
      select: { userId: true, dedupeKey: true },
    }),
  ]);

  const settingsByUser = new Map<string, RecipientSettings>(
    settingsRows.map((row) => [
      row.userId,
      {
        enabledKinds: row.enabledKinds,
        mutedChildIds: row.mutedChildIds,
        quietStart: row.quietStart,
        quietEnd: row.quietEnd,
        locale: toLocale(row.locale),
      },
    ])
  );

  const subscriptionsByUser = new Map<string, StoredSubscription[]>();
  for (const { userId, ...subscription } of subscriptions) {
    const list = subscriptionsByUser.get(userId) ?? [];
    list.push(subscription);
    subscriptionsByUser.set(userId, list);
  }

  const logged = new Set(logs.map((log) => logKey(log.userId, log.dedupeKey)));
  return { membersByChild, settingsByUser, subscriptionsByUser, logged };
}

/**
 * Claims a notice for a user by inserting its log row. Only the run whose
 * insert wins may send, so two runs at the same time never both notify.
 */
export async function claimDelivery(prisma: PrismaClient, delivery: Delivery): Promise<boolean> {
  const { count } = await prisma.notificationLog.createMany({
    data: [
      {
        userId: delivery.userId,
        childId: delivery.candidate.childId,
        kind: delivery.candidate.kind,
        dedupeKey: delivery.candidate.dedupeKey,
      },
    ],
    skipDuplicates: true,
  });
  return count === 1;
}

/**
 * One run: evaluate, filter, claim, send. Safe to run often and at the same
 * time as another run.
 */
export async function runDispatcher(options: DispatchOptions): Promise<DispatchResult> {
  const { prisma } = options;
  const now = options.now ?? new Date();
  const sender = options.sender ?? sendWebPush;
  const deadline = Date.now() + (options.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS);

  const result: DispatchResult = {
    candidates: 0,
    planned: 0,
    claimed: 0,
    sent: 0,
    failed: 0,
    removedSubscriptions: 0,
    evaluatorErrors: 0,
    prunedLogs: 0,
    deferred: 0,
  };

  const cutoff = new Date(now.getTime() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  result.prunedLogs = (
    await prisma.notificationLog.deleteMany({ where: { sentAt: { lt: cutoff } } })
  ).count;

  const { candidates, errors } = await collectCandidates(
    prisma,
    now,
    options.evaluators ?? defaultEvaluators
  );
  result.candidates = candidates.length;
  result.evaluatorErrors = errors;
  if (candidates.length === 0) return result;

  const context = await loadContext(prisma, candidates);
  const deliveries = planDeliveries({
    candidates,
    membersByChild: context.membersByChild,
    settingsByUser: context.settingsByUser,
    subscribedUsers: new Set(context.subscriptionsByUser.keys()),
    logged: context.logged,
    now,
  });
  result.planned = deliveries.length;

  const deliver = async (delivery: Delivery) => {
    // Insert the log row first: when it already exists, another run has it
    if (!(await claimDelivery(prisma, delivery))) return;
    result.claimed += 1;

    const { candidate, userId } = delivery;
    const locale = context.settingsByUser.get(userId)?.locale ?? toLocale(null);
    const meta = KIND_META[candidate.kind];
    const replaceKey = topicFor(candidate.replaceKey ?? candidate.dedupeKey);

    const counts = await sendToSubscriptions(
      prisma,
      context.subscriptionsByUser.get(userId) ?? [],
      {
        title: translatePush(locale, candidate.titleKey, candidate.params),
        body: translatePush(locale, candidate.bodyKey, candidate.params),
        tag: replaceKey,
        url: candidate.url,
      },
      { ttlSeconds: meta.ttlSeconds, urgency: meta.urgency, topic: replaceKey },
      sender,
      now
    );

    result.sent += counts.sent;
    result.failed += counts.failed;
    result.removedSubscriptions += counts.removed;

    // Nothing reached a device: free the claim so a later run can try again
    if (counts.sent === 0) {
      await prisma.notificationLog.deleteMany({
        where: { userId, dedupeKey: candidate.dedupeKey },
      });
    }
  };

  // A few workers take deliveries in turn. None starts a new one after the
  // deadline, so a slow push service cannot push the run past maxDuration.
  let next = 0;
  const worker = async () => {
    while (Date.now() <= deadline && next < deliveries.length) {
      const delivery = deliveries[next++]!;
      await deliver(delivery);
    }
  };
  await Promise.all(Array.from({ length: Math.min(SEND_CONCURRENCY, deliveries.length) }, worker));
  result.deferred = deliveries.length - next;

  return result;
}
