import { addDaysToKey, digestWeekToSend, isoWeekLabel, osloStartOfDay } from "@baby-atlas/utils";
import type { Candidate, Evaluate } from "../types";

/**
 * "Your week is ready": Sunday from 18:00 Oslo, and Monday until 12:00 as a
 * catch-up. One notice per child per ISO week (the dispatcher logs
 * `(userId, dedupeKey)`), and only when that week has at least some records.
 * Quiet hours are handled by the dispatcher: a Sunday notice held back by
 * quiet hours goes out on Monday morning if it is still inside the window.
 */
export const evaluate: Evaluate = async ({ prisma, now }) => {
  const weekStart = digestWeekToSend(now);
  if (!weekStart) return [];

  // Only children someone could be notified about: a non-viewer member with a push subscription
  const children = await prisma.child.findMany({
    where: {
      household: {
        members: {
          some: { role: { not: "VIEWER" }, user: { pushSubscriptions: { some: {} } } },
        },
      },
    },
    select: { id: true, name: true },
  });
  if (children.length === 0) return [];

  const ids = children.map((c) => c.id);
  const from = osloStartOfDay(weekStart);
  const to = osloStartOfDay(addDaysToKey(weekStart, 7));
  const within = { gte: from, lt: to };

  // One bounded query per record type, one row per child that has any
  const [sleep, feedings, diapers, pumping] = await Promise.all([
    prisma.sleepRecord.findMany({
      where: { childId: { in: ids }, startTime: within },
      distinct: ["childId"],
      select: { childId: true },
    }),
    prisma.feedingRecord.findMany({
      where: { childId: { in: ids }, startTime: within },
      distinct: ["childId"],
      select: { childId: true },
    }),
    prisma.diaperRecord.findMany({
      where: { childId: { in: ids }, time: within },
      distinct: ["childId"],
      select: { childId: true },
    }),
    prisma.pumpingRecord.findMany({
      where: { childId: { in: ids }, startTime: within },
      distinct: ["childId"],
      select: { childId: true },
    }),
  ]);
  const withRecords = new Set(
    [...sleep, ...feedings, ...diapers, ...pumping].map((r) => r.childId)
  );

  const label = isoWeekLabel(weekStart);
  return children
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
