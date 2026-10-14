import {
  formatMinutesOfDay,
  osloMinutesOfDay,
  predictNextNap,
  WAKE_WINDOW_HISTORY_HOURS,
} from "@baby-atlas/utils";
import type { Candidate, Evaluate } from "../types";
import { findEligibleChildren } from "./eligible-children";

const MINUTE = 60_000;
/** The notice goes out this long before the predicted nap ... */
export const NAP_DUE_LEAD_MINUTES = 10;
/** ... and is dropped this long after it (the moment has passed). */
export const NAP_DUE_GRACE_MINUTES = 20;

/**
 * NAP_DUE: "soon time for a nap" from the child's age and own wake windows.
 * Off by default (opt in in settings). Nothing for a child that is asleep,
 * is breastfeeding right now, is 3 years or older, or whose predicted time has
 * passed.
 */
export const evaluate: Evaluate = async ({ prisma, now }) => {
  const children = await findEligibleChildren(prisma, "NAP_DUE");
  if (children.length === 0) return [];

  const childIds = children.map((c) => c.id);
  const since = new Date(now.getTime() - WAKE_WINDOW_HISTORY_HOURS * 60 * MINUTE);
  const [sleeps, runningFeeds] = await Promise.all([
    prisma.sleepRecord.findMany({
      where: { childId: { in: childIds }, startTime: { gte: since } },
      select: { id: true, childId: true, sleepType: true, startTime: true, endTime: true },
    }),
    prisma.feedingRecord.findMany({
      where: {
        childId: { in: childIds },
        feedingType: "BREAST",
        endTime: null,
        startTime: { gte: since },
      },
      select: { childId: true },
    }),
  ]);

  const feeding = new Set(runningFeeds.map((f) => f.childId));
  const candidates: Candidate[] = [];

  for (const child of children) {
    if (feeding.has(child.id)) continue;
    const own = sleeps.filter((s) => s.childId === child.id);

    const prediction = predictNextNap({ birthDate: child.birthDate, now, sleeps: own });
    if (!prediction) continue;

    const minutesToNap = (prediction.at.getTime() - now.getTime()) / MINUTE;
    if (minutesToNap > NAP_DUE_LEAD_MINUTES || minutesToNap < -NAP_DUE_GRACE_MINUTES) continue;

    // The sleep that ended last: a new sleep gives a new notice
    const lastSleep = own
      .filter((s) => s.endTime !== null)
      .reduce((latest, s) => (s.endTime! > latest.endTime! ? s : latest));
    candidates.push({
      kind: "NAP_DUE",
      childId: child.id,
      dedupeKey: `nap-due:${child.id}:${lastSleep.id}`,
      replaceKey: `nap-due:${child.id}`,
      url: `/dashboard/${child.id}`,
      titleKey: "push.napDue.title",
      bodyKey: "push.napDue.body",
      params: {
        name: child.name,
        time: formatMinutesOfDay(osloMinutesOfDay(prediction.at)),
      },
    });
  }

  return candidates;
};
