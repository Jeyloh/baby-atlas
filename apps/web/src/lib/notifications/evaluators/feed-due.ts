import {
  ageInMonths,
  FEED_HISTORY_HOURS,
  FEED_PREDICTION_MAX_MONTHS,
  formatMinutesOfDay,
  osloMinutesOfDay,
  predictNextFeed,
} from "@baby-atlas/utils";
import type { Candidate, Evaluate } from "../types";
import { findEligibleChildren } from "./eligible-children";

const MINUTE = 60_000;
/** The notice goes out this long before the predicted feed ... */
export const FEED_DUE_LEAD_MINUTES = 10;
/** ... and is dropped this long after it (the moment has passed). */
export const FEED_DUE_GRACE_MINUTES = 20;

/**
 * FEED_DUE: "soon time to feed" from the median interval of recent feeds.
 * Off by default (opt in in settings). Skips children with a running
 * breastfeeding or sleep timer, and a prediction whose window has passed.
 */
export const evaluate: Evaluate = async ({ prisma, now }) => {
  const children = (await findEligibleChildren(prisma, "FEED_DUE")).filter(
    (c) => ageInMonths(c.birthDate, now) < FEED_PREDICTION_MAX_MONTHS
  );
  if (children.length === 0) return [];

  const childIds = children.map((c) => c.id);
  const since = new Date(now.getTime() - FEED_HISTORY_HOURS * 60 * MINUTE);
  const [feeds, runningSleeps] = await Promise.all([
    prisma.feedingRecord.findMany({
      where: {
        childId: { in: childIds },
        feedingType: { in: ["BREAST", "BOTTLE"] },
        startTime: { gte: since },
      },
      select: { id: true, childId: true, feedingType: true, startTime: true, endTime: true },
    }),
    prisma.sleepRecord.findMany({
      where: { childId: { in: childIds }, endTime: null, startTime: { gte: since } },
      select: { childId: true },
    }),
  ]);

  const sleeping = new Set(runningSleeps.map((s) => s.childId));
  const candidates: Candidate[] = [];

  for (const child of children) {
    if (sleeping.has(child.id)) continue;
    const own = feeds.filter((f) => f.childId === child.id);
    if (own.some((f) => f.feedingType === "BREAST" && f.endTime === null)) continue;

    const prediction = predictNextFeed(own, now);
    if (!prediction) continue;

    const minutesToFeed = (prediction.at.getTime() - now.getTime()) / MINUTE;
    if (minutesToFeed > FEED_DUE_LEAD_MINUTES || minutesToFeed < -FEED_DUE_GRACE_MINUTES) continue;

    const lastFeed = own.reduce((latest, f) => (f.startTime > latest.startTime ? f : latest));
    candidates.push({
      kind: "FEED_DUE",
      childId: child.id,
      dedupeKey: `feed-due:${child.id}:${lastFeed.id}`,
      replaceKey: `feed-due:${child.id}`,
      url: `/dashboard/${child.id}`,
      titleKey: "push.feedDue.title",
      bodyKey: "push.feedDue.body",
      params: {
        name: child.name,
        time: formatMinutesOfDay(osloMinutesOfDay(prediction.at)),
      },
    });
  }

  return candidates;
};
