import { timerThresholdsSchema } from "@baby-atlas/schemas";
import {
  fixTimerParam,
  thresholdMinutes,
  tierReachedAt,
  timerRecordType,
  timerThresholdKey,
  timerTier,
  type RunningTimerKind,
  type TimerThresholdOverrides,
  type TimerTier,
} from "@baby-atlas/utils";
import type { Candidate, Evaluate } from "../types";

/** Only timers that started within this window are looked at (the longest threshold is 24 h, tier 2 is 48 h). */
const LOOKBACK_HOURS = 72;
/** A tier reached longer ago than this is not announced any more (it was missed while notices were off). */
const TIER_RELEVANCE_HOURS = 12;
const HOUR_MS = 60 * 60 * 1000;

interface Member {
  userId: string;
  role: string;
}

export interface OpenTimer {
  kind: RunningTimerKind;
  recordId: string;
  childId: string;
  childName: string;
  startTime: Date;
  sleepType?: "NAP" | "NIGHT" | null;
  members: Member[];
}

/**
 * Candidates for the timers that have run past their threshold. Thresholds
 * are per person (settings.timerThresholds), so each person is placed in the
 * tier their own thresholds give, and people in the same tier share one
 * candidate. Each person gets at most one notice per timer and run: the
 * highest tier reached, so a notice held back by quiet hours does not turn
 * into two. Tier 2 shares the replaceKey of tier 1 and replaces it on the
 * device.
 */
export function buildTimerCandidates(
  timers: OpenTimer[],
  overridesByUser: Map<string, TimerThresholdOverrides>,
  now: Date
): Candidate[] {
  const candidates: Candidate[] = [];

  for (const timer of timers) {
    const key = timerThresholdKey(timer.kind, timer.sleepType);
    const usersByTier = new Map<1 | 2, string[]>();

    for (const member of timer.members) {
      if (member.role === "VIEWER") continue;
      const threshold = thresholdMinutes(key, overridesByUser.get(member.userId));
      const tier: TimerTier = timerTier(timer.startTime, now, threshold);
      if (tier === 0) continue;
      const reachedAt = tierReachedAt(timer.startTime, threshold, tier);
      if (now.getTime() - reachedAt.getTime() > TIER_RELEVANCE_HOURS * HOUR_MS) continue;
      usersByTier.set(tier, [...(usersByTier.get(tier) ?? []), member.userId]);
    }

    const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - timer.startTime.getTime()) / 60_000));
    for (const [tier, audience] of usersByTier) {
      candidates.push({
        kind: "TIMER_RUNNING",
        childId: timer.childId,
        dedupeKey: `timer:${timer.recordId}:${tier}x`,
        replaceKey: `timer:${timer.recordId}`,
        url: `/dashboard/${timer.childId}?fixTimer=${fixTimerParam(timerRecordType(timer.kind), timer.recordId)}`,
        titleKey: `push.timerRunning.title${tier}`,
        bodyKey: `push.timerRunning.body${tier}`,
        params: {
          childName: timer.childName,
          type: key,
          hours: Math.floor(elapsedMinutes / 60),
          minutes: elapsedMinutes % 60,
        },
        audience,
      });
    }
  }

  return candidates;
}

function parseOverrides(value: unknown): TimerThresholdOverrides {
  const parsed = timerThresholdsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

/**
 * Forgotten timers: sleep, breastfeeds, bottles, pumping and activities that
 * are still running past a threshold (see packages/utils timer-thresholds).
 * Only children in households where somebody has a push subscription are
 * read, and only timers that started in the last 72 hours.
 */
export const evaluate: Evaluate = async ({ prisma, now }) => {
  const since = new Date(now.getTime() - LOOKBACK_HOURS * HOUR_MS);
  // Not a minute-old timer: the shortest allowed threshold is one minute
  const until = new Date(now.getTime() - 60_000);

  const base = {
    endTime: null,
    startTime: { gte: since, lte: until },
    child: {
      household: {
        members: {
          some: { role: { not: "VIEWER" as const }, user: { pushSubscriptions: { some: {} } } },
        },
      },
    },
  };
  const childSelect = {
    id: true,
    name: true,
    household: { select: { members: { select: { userId: true, role: true } } } },
  } as const;

  const [sleep, feeding, pumping, activity] = await Promise.all([
    prisma.sleepRecord.findMany({
      where: base,
      select: { id: true, startTime: true, sleepType: true, child: { select: childSelect } },
    }),
    prisma.feedingRecord.findMany({
      where: { ...base, feedingType: { in: ["BREAST", "BOTTLE"] } },
      select: { id: true, startTime: true, feedingType: true, child: { select: childSelect } },
    }),
    prisma.pumpingRecord.findMany({
      where: base,
      select: { id: true, startTime: true, child: { select: childSelect } },
    }),
    prisma.activityRecord.findMany({
      where: base,
      select: { id: true, startTime: true, child: { select: childSelect } },
    }),
  ]);

  type Child = (typeof sleep)[number]["child"];
  const open = (kind: RunningTimerKind, record: { id: string; startTime: Date }, child: Child, sleepType?: "NAP" | "NIGHT") =>
    ({
      kind,
      recordId: record.id,
      childId: child.id,
      childName: child.name,
      startTime: record.startTime,
      sleepType,
      members: child.household.members,
    }) satisfies OpenTimer;

  const timers: OpenTimer[] = [
    ...sleep.map((r) => open("sleep", r, r.child, r.sleepType)),
    ...feeding.map((r) => open(r.feedingType === "BOTTLE" ? "bottle" : "breast", r, r.child)),
    ...pumping.map((r) => open("pumping", r, r.child)),
    ...activity.map((r) => open("activity", r, r.child)),
  ];
  if (timers.length === 0) return [];

  const userIds = [...new Set(timers.flatMap((t) => t.members.map((m) => m.userId)))];
  const settings = await prisma.notificationSettings.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, timerThresholds: true },
  });
  const overridesByUser = new Map(settings.map((s) => [s.userId, parseOverrides(s.timerThresholds)]));

  return buildTimerCandidates(timers, overridesByUser, now);
};
