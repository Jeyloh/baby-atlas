import { osloMinutesOfDay, tipPositionForAge } from "@baby-atlas/utils";
import type { Evaluate, Candidate } from "../types";

/** Tips go out from 10:00 Oslo on the day a new week or month starts. */
export const TIP_START_MINUTE = 10 * 60;
/** A tip older than this (days into its week or month) is stale: skip it. */
export const MAX_DAYS_LATE = 3;
/** Youngest-to-oldest range with tips is under 37 months; this bounds the query. */
const MAX_AGE_DAYS = 37 * 31;

/**
 * Message params are translated server-side: a value of the form
 * `@<namespace>:<key>` is replaced by that message in the recipient's locale
 * (see translatePush). The tip title and text come from the `tips` namespace.
 */
export function tipRef(tipKey: string, field: "title" | "body"): string {
  return `@tips:${tipKey}.${field}`;
}

export const evaluate: Evaluate = async ({ prisma, now }) => {
  if (osloMinutesOfDay(now) < TIP_START_MINUTE) return [];

  // Only children someone in the household can receive a push for
  const children = await prisma.child.findMany({
    where: {
      birthDate: {
        lte: now,
        gte: new Date(now.getTime() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000),
      },
      household: {
        members: { some: { user: { pushSubscriptions: { some: {} } } } },
      },
    },
    select: { id: true, birthDate: true },
  });

  const candidates: Candidate[] = [];
  for (const child of children) {
    const position = tipPositionForAge(child.birthDate, now);
    if (!position || position.daysIntoTip > MAX_DAYS_LATE) continue;

    candidates.push({
      kind: "WEEKLY_TIP",
      childId: child.id,
      dedupeKey: `tip:${child.id}:${position.key}`,
      url: `/dashboard/${child.id}`,
      titleKey: "push.weeklyTip.title",
      bodyKey: "push.weeklyTip.body",
      params: {
        tip: tipRef(position.key, "title"),
        text: tipRef(position.key, "body"),
      },
    });
  }
  return candidates;
};
