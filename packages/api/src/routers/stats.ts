import { z } from "zod";
import { createTRPCRouter, assertChildAccess } from "../trpc";
import { premiumProcedure } from "../premium";

const TIME_ZONE = "Europe/Oslo";
const DAY_MS = 24 * 60 * 60 * 1000;

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function dayKey(date: Date): string {
  return dayFormatter.format(date);
}

export function lastDayKeys(days: number, now: Date): string[] {
  return Array.from({ length: days }, (_, i) =>
    dayKey(new Date(now.getTime() - (days - 1 - i) * DAY_MS))
  );
}

export interface TrendInput {
  now: Date;
  days: number;
  sleep: { startTime: Date; endTime: Date | null; sleepType: "NAP" | "NIGHT" }[];
  feedings: {
    startTime: Date;
    feedingType: "BREAST" | "BOTTLE" | "SOLIDS";
    amountMl: number | null;
  }[];
  diapers: { time: Date; diaperType: "WET" | "DIRTY" | "BOTH" | "DRY" }[];
}

export interface DailyTrend {
  date: string;
  sleepMinutes: number;
  naps: number;
  feeds: number;
  wetDiapers: number;
  dirtyDiapers: number;
}

export interface TrendStats {
  days: DailyTrend[];
  averages: {
    sleepMinutesPerDay: number | null;
    napsPerDay: number | null;
    feedsPerDay: number | null;
    mlPerBottle: number | null;
    wetDiapersPerDay: number | null;
    dirtyDiapersPerDay: number | null;
  };
}

function average(total: number, count: number, digits = 1): number | null {
  if (count === 0) return null;
  const factor = 10 ** digits;
  return Math.round((total / count) * factor) / factor;
}

// Averages only count days that have at least one log of that kind, so days
// where the parents did not log do not drag the numbers down.
export function computeTrends(input: TrendInput): TrendStats {
  const keys = lastDayKeys(input.days, input.now);
  const byDay = new Map<string, DailyTrend>(
    keys.map((date) => [
      date,
      { date, sleepMinutes: 0, naps: 0, feeds: 0, wetDiapers: 0, dirtyDiapers: 0 },
    ])
  );
  let bottleMl = 0;
  let bottleCount = 0;

  for (const record of input.sleep) {
    const day = byDay.get(dayKey(record.startTime));
    if (!day || !record.endTime) continue;
    day.sleepMinutes += Math.max(
      0,
      Math.round((record.endTime.getTime() - record.startTime.getTime()) / 60000)
    );
    if (record.sleepType === "NAP") day.naps += 1;
  }

  for (const record of input.feedings) {
    const day = byDay.get(dayKey(record.startTime));
    if (!day) continue;
    day.feeds += 1;
    if (record.feedingType === "BOTTLE" && record.amountMl != null) {
      bottleMl += record.amountMl;
      bottleCount += 1;
    }
  }

  for (const record of input.diapers) {
    const day = byDay.get(dayKey(record.time));
    if (!day) continue;
    if (record.diaperType === "WET" || record.diaperType === "BOTH") {
      day.wetDiapers += 1;
    }
    if (record.diaperType === "DIRTY" || record.diaperType === "BOTH") {
      day.dirtyDiapers += 1;
    }
  }

  const days = keys.map((key) => byDay.get(key)!);
  const sum = (pick: (d: DailyTrend) => number) =>
    days.reduce((total, d) => total + pick(d), 0);
  const activeDays = (pick: (d: DailyTrend) => number) =>
    days.filter((d) => pick(d) > 0).length;

  return {
    days,
    averages: {
      sleepMinutesPerDay: average(
        sum((d) => d.sleepMinutes),
        activeDays((d) => d.sleepMinutes),
        0
      ),
      napsPerDay: average(
        sum((d) => d.naps),
        activeDays((d) => d.naps)
      ),
      feedsPerDay: average(
        sum((d) => d.feeds),
        activeDays((d) => d.feeds)
      ),
      mlPerBottle: average(bottleMl, bottleCount, 0),
      wetDiapersPerDay: average(
        sum((d) => d.wetDiapers),
        activeDays((d) => d.wetDiapers)
      ),
      dirtyDiapersPerDay: average(
        sum((d) => d.dirtyDiapers),
        activeDays((d) => d.dirtyDiapers)
      ),
    },
  };
}

export const statsRouter = createTRPCRouter({
  trends: premiumProcedure
    .input(
      z.object({
        childId: z.string().cuid(),
        days: z.number().int().min(1).max(30).default(14),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertChildAccess(ctx, input.childId);

      const now = new Date();
      // One extra day so the Oslo day boundary never cuts off the first day.
      const since = new Date(now.getTime() - (input.days + 1) * DAY_MS);

      const [sleep, feedings, diapers] = await Promise.all([
        ctx.prisma.sleepRecord.findMany({
          where: { childId: input.childId, startTime: { gte: since } },
          select: { startTime: true, endTime: true, sleepType: true },
        }),
        ctx.prisma.feedingRecord.findMany({
          where: { childId: input.childId, startTime: { gte: since } },
          select: { startTime: true, feedingType: true, amountMl: true },
        }),
        ctx.prisma.diaperRecord.findMany({
          where: { childId: input.childId, time: { gte: since } },
          select: { time: true, diaperType: true },
        }),
      ]);

      return computeTrends({ now, days: input.days, sleep, feedings, diapers });
    }),
});
