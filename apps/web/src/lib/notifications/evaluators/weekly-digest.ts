import { addDaysToKey, digestWeekToSend, isoWeekLabel, osloStartOfDay } from "@baby-atlas/utils";
import type { Candidate, Evaluate } from "../types";

/**
 * "Last week is ready": Monday from 08:00 to 20:00 Oslo, for the Monday to
 * Sunday week that just ended. One notice per child per ISO week (the
 * dispatcher logs `(userId, dedupeKey)`), and only when that week has at least
 * some records. A notice held back by quiet hours goes out later the same day.
 */
export const evaluate: Evaluate = async ({ prisma, now }) => {
  const weekStart = digestWeekToSend(now);
  if (!weekStart) return [];
  const label = isoWeekLabel(weekStart);

  // Only children someone could be notified about: a non-viewer member with a push subscription
  const recipientFilter = { role: { not: "VIEWER" as const }, user: { pushSubscriptions: { some: {} } } };
  const children = await prisma.child.findMany({
    where: { household: { members: { some: recipientFilter } } },
    select: {
      id: true,
      name: true,
      household: { select: { members: { where: recipientFilter, select: { userId: true } } } },
    },
  });
  if (children.length === 0) return [];

  // Skip children whose digest already went to everyone who could get it
  const logs = await prisma.notificationLog.findMany({
    where: { dedupeKey: { in: children.map((c) => `digest:${c.id}:${label}`) } },
    select: { userId: true, dedupeKey: true },
  });
  const sentTo = new Map<string, Set<string>>();
  for (const log of logs) {
    const users = sentTo.get(log.dedupeKey) ?? new Set<string>();
    users.add(log.userId);
    sentTo.set(log.dedupeKey, users);
  }
  const pending = children.filter((child) => {
    const sent = sentTo.get(`digest:${child.id}:${label}`);
    return !child.household.members.every((m) => sent?.has(m.userId));
  });
  if (pending.length === 0) return [];

  const ids = pending.map((c) => c.id);
  const from = osloStartOfDay(weekStart);
  const to = osloStartOfDay(addDaysToKey(weekStart, 7));
  const within = { gte: from, lt: to };

  // One grouped query per record type: one row per child that has any
  const [sleep, feedings, diapers, pumping] = await Promise.all([
    prisma.sleepRecord.groupBy({
      by: ["childId"],
      where: { childId: { in: ids }, startTime: within },
    }),
    prisma.feedingRecord.groupBy({
      by: ["childId"],
      where: { childId: { in: ids }, startTime: within },
    }),
    prisma.diaperRecord.groupBy({
      by: ["childId"],
      where: { childId: { in: ids }, time: within },
    }),
    prisma.pumpingRecord.groupBy({
      by: ["childId"],
      where: { childId: { in: ids }, startTime: within },
    }),
  ]);
  const withRecords = new Set(
    [...sleep, ...feedings, ...diapers, ...pumping].map((r) => r.childId)
  );

  return pending
    .filter((child) => withRecords.has(child.id))
    .map(
      (child): Candidate => ({
        kind: "WEEKLY_DIGEST",
        childId: child.id,
        dedupeKey: `digest:${child.id}:${label}`,
        url: `/dashboard/${child.id}/digest?week=${weekStart}`,
        titleKey: "push.weeklyDigest.title",
        bodyKey: "push.weeklyDigest.body",
        params: { name: child.name, week: Number(label.slice(-2)) },
      })
    );
};
