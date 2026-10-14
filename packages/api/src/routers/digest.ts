import { z } from "zod";
import {
  addDaysToKey,
  dateOnly,
  isoWeekLabel,
  lastFullWeekStart,
  mondayOfKey,
  osloDayKey,
  osloStartOfDay,
  weekDayKeys,
} from "@baby-atlas/utils";
import { createTRPCRouter, householdProcedure } from "../trpc";

// The digest is free: it only reports basic totals and averages of what the
// household logged. Deeper trend statistics stay behind premium (`stats`).

const DAY_KEY = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((key) => {
    const year = Number(key.slice(0, 4));
    return year >= 2000 && year <= 2100 && !Number.isNaN(Date.parse(`${key}T00:00:00Z`));
  });

const REPORT_PERIODS = {
  "4w": 28,
  "8w": 56,
  "12w": 84,
} as const;
const MAX_REPORT_DAYS = 366;
const MAX_JOURNAL_ENTRIES = 50;

// ----------------------------------------------------------------------------
// Pure aggregation
// ----------------------------------------------------------------------------

export interface PeriodInput {
  /** The Oslo calendar days the period covers, YYYY-MM-DD */
  dayKeys: string[];
  sleep: { startTime: Date; endTime: Date | null; sleepType: "NAP" | "NIGHT" }[];
  feedings: {
    startTime: Date;
    feedingType: "BREAST" | "BOTTLE" | "SOLIDS";
    amountMl: number | null;
  }[];
  diapers: { time: Date; diaperType: "WET" | "DIRTY" | "BOTH" | "DRY" }[];
  pumping: { startTime: Date; amountMl: number | null }[];
}

export interface PeriodSummary {
  days: number;
  sleep: {
    totalMinutesPerDay: number | null;
    nightMinutesPerDay: number | null;
    napMinutesPerDay: number | null;
    napsPerDay: number | null;
    loggedDays: number;
  };
  feeds: {
    perDay: number | null;
    bottleMlPerDay: number | null;
    total: number;
    loggedDays: number;
  };
  diapers: {
    wetPerDay: number | null;
    dirtyPerDay: number | null;
    loggedDays: number;
  };
  pumping: {
    mlPerDay: number | null;
    loggedDays: number;
  };
  /** Sleep, feeding, diaper and pumping records in the period */
  totalRecords: number;
}

function average(total: number, count: number, digits = 1): number | null {
  if (count === 0) return null;
  const factor = 10 ** digits;
  return Math.round((total / count) * factor) / factor;
}

/**
 * Per-day averages over a period. Like the trend statistics, an average only
 * counts days that have at least one log of that kind, so days where the
 * parents did not log do not drag the numbers down. Records belong to the Oslo
 * day they started on.
 */
export function summarizePeriod(input: PeriodInput): PeriodSummary {
  const keys = new Set(input.dayKeys);

  const sleepDays = new Map<string, { night: number; nap: number; naps: number }>();
  let sleepRecords = 0;
  for (const record of input.sleep) {
    const key = osloDayKey(record.startTime);
    if (!keys.has(key)) continue;
    sleepRecords += 1;
    if (!record.endTime) continue;
    const minutes = Math.max(
      0,
      Math.round((record.endTime.getTime() - record.startTime.getTime()) / 60000)
    );
    const day = sleepDays.get(key) ?? { night: 0, nap: 0, naps: 0 };
    if (record.sleepType === "NIGHT") day.night += minutes;
    else {
      day.nap += minutes;
      day.naps += 1;
    }
    sleepDays.set(key, day);
  }
  let night = 0;
  let nap = 0;
  let naps = 0;
  for (const day of sleepDays.values()) {
    night += day.night;
    nap += day.nap;
    naps += day.naps;
  }

  const feedDays = new Map<string, number>();
  const bottleDays = new Map<string, number>();
  let feedTotal = 0;
  let bottleMl = 0;
  for (const record of input.feedings) {
    const key = osloDayKey(record.startTime);
    if (!keys.has(key)) continue;
    feedTotal += 1;
    feedDays.set(key, (feedDays.get(key) ?? 0) + 1);
    if (record.feedingType === "BOTTLE" && record.amountMl != null) {
      bottleMl += record.amountMl;
      bottleDays.set(key, (bottleDays.get(key) ?? 0) + record.amountMl);
    }
  }

  const diaperDays = new Set<string>();
  let wet = 0;
  let dirty = 0;
  let diaperRecords = 0;
  for (const record of input.diapers) {
    const key = osloDayKey(record.time);
    if (!keys.has(key)) continue;
    diaperRecords += 1;
    diaperDays.add(key);
    if (record.diaperType === "WET" || record.diaperType === "BOTH") wet += 1;
    if (record.diaperType === "DIRTY" || record.diaperType === "BOTH") dirty += 1;
  }

  const pumpDays = new Map<string, number>();
  let pumpMl = 0;
  let pumpRecords = 0;
  for (const record of input.pumping) {
    const key = osloDayKey(record.startTime);
    if (!keys.has(key)) continue;
    pumpRecords += 1;
    if (record.amountMl != null) {
      pumpMl += record.amountMl;
      pumpDays.set(key, (pumpDays.get(key) ?? 0) + record.amountMl);
    }
  }

  const sleepLogged = sleepDays.size;
  return {
    days: input.dayKeys.length,
    sleep: {
      totalMinutesPerDay: average(night + nap, sleepLogged, 0),
      nightMinutesPerDay: average(night, sleepLogged, 0),
      napMinutesPerDay: average(nap, sleepLogged, 0),
      napsPerDay: average(naps, sleepLogged),
      loggedDays: sleepLogged,
    },
    feeds: {
      perDay: average(feedTotal, feedDays.size),
      bottleMlPerDay: average(bottleMl, bottleDays.size, 0),
      total: feedTotal,
      loggedDays: feedDays.size,
    },
    diapers: {
      wetPerDay: average(wet, diaperDays.size),
      dirtyPerDay: average(dirty, diaperDays.size),
      loggedDays: diaperDays.size,
    },
    pumping: {
      mlPerDay: average(pumpMl, pumpDays.size, 0),
      loggedDays: pumpDays.size,
    },
    totalRecords: sleepRecords + feedTotal + diaperRecords + pumpRecords,
  };
}

export interface GrowthPoint {
  date: Date;
  weightKg: number | null;
  heightCm: number | null;
  headCircumferenceCm: number | null;
}

export interface GrowthChange {
  weightKg: number | null;
  heightCm: number | null;
  headCircumferenceCm: number | null;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * How much each measurement changed: the latest value in the week minus the
 * latest earlier value of the same kind. `null` when either side is missing.
 * `inWeek` and `before` are newest first.
 */
export function growthChange(inWeek: GrowthPoint[], before: GrowthPoint[]): GrowthChange {
  const latest = (
    points: GrowthPoint[],
    pick: (p: GrowthPoint) => number | null
  ): number | null => {
    for (const point of points) {
      const value = pick(point);
      if (value != null) return value;
    }
    return null;
  };
  const change = (pick: (p: GrowthPoint) => number | null, digits: number) => {
    const now = latest(inWeek, pick);
    const earlier = latest(before, pick);
    return now == null || earlier == null ? null : round(now - earlier, digits);
  };
  return {
    weightKg: change((p) => p.weightKg, 3),
    heightCm: change((p) => p.heightCm, 1),
    headCircumferenceCm: change((p) => p.headCircumferenceCm, 1),
  };
}

// ----------------------------------------------------------------------------
// Router
// ----------------------------------------------------------------------------

const keyOf = (date: Date) => date.toISOString().slice(0, 10);

/** The days of a period without today, which is only partly logged. */
export function completedDayKeys(dayKeys: string[], todayKey: string): string[] {
  return dayKeys.filter((key) => key !== todayKey);
}

/** Medicines with at most this many doses in the period list every dose. */
const LIST_DOSES_UP_TO = 10;
const MAX_TEMPERATURE_LIST = 30;

export const digestRouter = createTRPCRouter({
  /**
   * One Monday to Sunday week (default: the last complete week in Europe/Oslo)
   * next to the week before it, so the page can show what changed.
   */
  week: householdProcedure
    .input(z.object({ childId: z.string().cuid(), weekStart: DAY_KEY.optional() }))
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const todayKey = osloDayKey(now);
      const currentWeekStart = mondayOfKey(todayKey);
      // A future week has no data: stop at the week that is running now
      const requested = input.weekStart ? mondayOfKey(input.weekStart) : lastFullWeekStart(now);
      const weekStart = requested > currentWeekStart ? currentWeekStart : requested;
      const previousStart = addDaysToKey(weekStart, -7);
      const weekEnd = addDaysToKey(weekStart, 6);
      const nextStart = addDaysToKey(weekStart, 7);

      const windowStart = osloStartOfDay(previousStart);
      const midpoint = osloStartOfDay(weekStart);
      const windowEnd = osloStartOfDay(nextStart);
      const dateFrom = dateOnly(previousStart);
      const dateMid = dateOnly(weekStart);
      const dateTo = dateOnly(nextStart);
      const childId = input.childId;

      const [sleep, feedings, diapers, pumping, growth, earlierGrowth, words, journal] =
        await Promise.all([
          ctx.prisma.sleepRecord.findMany({
            where: { childId, startTime: { gte: windowStart, lt: windowEnd } },
            select: { startTime: true, endTime: true, sleepType: true },
          }),
          ctx.prisma.feedingRecord.findMany({
            where: { childId, startTime: { gte: windowStart, lt: windowEnd } },
            select: { startTime: true, feedingType: true, amountMl: true },
          }),
          ctx.prisma.diaperRecord.findMany({
            where: { childId, time: { gte: windowStart, lt: windowEnd } },
            select: { time: true, diaperType: true },
          }),
          ctx.prisma.pumpingRecord.findMany({
            where: { childId, startTime: { gte: windowStart, lt: windowEnd } },
            select: { startTime: true, amountMl: true },
          }),
          ctx.prisma.growthRecord.findMany({
            where: { childId, date: { gte: dateMid, lt: dateTo } },
            orderBy: { date: "desc" },
            select: { date: true, weightKg: true, heightCm: true, headCircumferenceCm: true },
          }),
          ctx.prisma.growthRecord.findMany({
            where: { childId, date: { lt: dateMid } },
            orderBy: { date: "desc" },
            take: 6,
            select: { date: true, weightKg: true, heightCm: true, headCircumferenceCm: true },
          }),
          ctx.prisma.speechWord.findMany({
            where: { childId, firstSaidAt: { gte: dateFrom, lt: dateTo } },
            orderBy: { firstSaidAt: "asc" },
            select: { word: true, firstSaidAt: true },
          }),
          ctx.prisma.journalEntry.findMany({
            where: { childId, date: { gte: dateFrom, lt: dateTo } },
            select: { date: true },
          }),
        ]);

      const inWeek = <T>(items: T[], at: (item: T) => Date) =>
        items.filter((item) => at(item).getTime() >= midpoint.getTime());
      const beforeWeek = <T>(items: T[], at: (item: T) => Date) =>
        items.filter((item) => at(item).getTime() < midpoint.getTime());

      const summaryFor = (week: "current" | "previous"): PeriodSummary => {
        const pick = week === "current" ? inWeek : beforeWeek;
        return summarizePeriod({
          // Today is still going, so it would pull the averages down
          dayKeys: completedDayKeys(
            weekDayKeys(week === "current" ? weekStart : previousStart),
            todayKey
          ),
          sleep: pick(sleep, (r) => r.startTime),
          feedings: pick(feedings, (r) => r.startTime),
          diapers: pick(diapers, (r) => r.time),
          pumping: pick(pumping, (r) => r.startTime),
        });
      };

      const currentWords = words.filter((w) => w.firstSaidAt.getTime() >= dateMid.getTime());
      const previousWordCount = words.length - currentWords.length;
      const currentJournal = journal.filter((e) => e.date.getTime() >= dateMid.getTime());

      return {
        weekStart,
        weekEnd,
        previousWeekStart: previousStart,
        // The week that is running now, so the page can stop "next" there
        currentWeekStart,
        isoWeek: isoWeekLabel(weekStart),
        current: {
          ...summaryFor("current"),
          newWords: currentWords.length,
          journalEntries: currentJournal.length,
        },
        previous: {
          ...summaryFor("previous"),
          newWords: previousWordCount,
          journalEntries: journal.length - currentJournal.length,
        },
        words: currentWords.map((w) => w.word),
        growth: {
          // Oldest first for reading
          entries: [...growth].reverse().map((g) => ({
            date: keyOf(g.date),
            weightKg: g.weightKg,
            heightCm: g.heightCm,
            headCircumferenceCm: g.headCircumferenceCm,
          })),
          change: growthChange(growth, earlierGrowth),
        },
      };
    }),

  /**
   * Everything the printable visit report needs in one call. The period ends
   * today (Europe/Oslo) and starts 4, 8 or 12 weeks back, or on the day of the
   * last completed health station checkup.
   */
  report: householdProcedure
    .input(
      z.object({
        childId: z.string().cuid(),
        period: z.enum(["4w", "8w", "12w", "sinceCheckup"]).default("4w"),
      })
    )
    .query(async ({ ctx, input }) => {
      const childId = input.childId;
      const now = new Date();
      const toKey = osloDayKey(now);

      const lastCheckup = await ctx.prisma.checkupRecord.findFirst({
        where: { childId, completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
        select: { completedAt: true },
      });
      const lastCheckupKey = lastCheckup?.completedAt ? keyOf(lastCheckup.completedAt) : null;

      let effective: keyof typeof REPORT_PERIODS | "sinceCheckup" = input.period;
      if (effective === "sinceCheckup" && !lastCheckupKey) effective = "4w";
      let fromKey =
        effective === "sinceCheckup"
          ? (lastCheckupKey as string)
          : addDaysToKey(toKey, 1 - REPORT_PERIODS[effective]);
      // Bound the work for a very old checkup
      const earliest = addDaysToKey(toKey, 1 - MAX_REPORT_DAYS);
      if (fromKey < earliest) fromKey = earliest;
      if (fromKey > toKey) fromKey = toKey;

      const windowStart = osloStartOfDay(fromKey);
      const windowEnd = osloStartOfDay(addDaysToKey(toKey, 1));
      const dateFrom = dateOnly(fromKey);
      const dateTo = dateOnly(addDaysToKey(toKey, 1));
      const dayKeys: string[] = [];
      for (let key = fromKey; key <= toKey; key = addDaysToKey(key, 1)) dayKeys.push(key);
      const averageKeys = completedDayKeys(dayKeys, toKey);

      const [
        child,
        sleep,
        feedings,
        diapers,
        pumping,
        growth,
        medicines,
        temperatures,
        vaccinations,
        journal,
      ] = await Promise.all([
        ctx.prisma.child.findUnique({
          where: { id: childId },
          select: { name: true, birthDate: true, gender: true },
        }),
        ctx.prisma.sleepRecord.findMany({
          where: { childId, startTime: { gte: windowStart, lt: windowEnd } },
          select: { startTime: true, endTime: true, sleepType: true },
        }),
        ctx.prisma.feedingRecord.findMany({
          where: { childId, startTime: { gte: windowStart, lt: windowEnd } },
          select: { startTime: true, feedingType: true, amountMl: true },
        }),
        ctx.prisma.diaperRecord.findMany({
          where: { childId, time: { gte: windowStart, lt: windowEnd } },
          select: { time: true, diaperType: true },
        }),
        ctx.prisma.pumpingRecord.findMany({
          where: { childId, startTime: { gte: windowStart, lt: windowEnd } },
          select: { startTime: true, amountMl: true },
        }),
        ctx.prisma.growthRecord.findMany({
          where: { childId, date: { gte: dateFrom, lt: dateTo } },
          orderBy: { date: "asc" },
          select: { date: true, weightKg: true, heightCm: true, headCircumferenceCm: true },
        }),
        ctx.prisma.medicine.findMany({
          where: { childId },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            dosage: true,
            frequency: true,
            isActive: true,
          },
        }),
        Promise.all([
          ctx.prisma.temperatureRecord.count({
            where: { childId, time: { gte: windowStart, lt: windowEnd } },
          }),
          ctx.prisma.temperatureRecord.findFirst({
            where: { childId, time: { gte: windowStart, lt: windowEnd } },
            orderBy: [{ temperatureCelsius: "desc" }, { time: "desc" }],
            select: { time: true, temperatureCelsius: true },
          }),
          ctx.prisma.temperatureRecord.findMany({
            where: { childId, time: { gte: windowStart, lt: windowEnd } },
            orderBy: { time: "desc" },
            take: MAX_TEMPERATURE_LIST,
            select: { time: true, temperatureCelsius: true },
          }),
        ]),
        ctx.prisma.vaccinationRecord.findMany({
          where: { childId },
          orderBy: { givenAt: "asc" },
          select: { vaccineKey: true, givenAt: true },
        }),
        ctx.prisma.journalEntry.findMany({
          where: {
            childId,
            date: { gte: dateFrom, lt: dateTo },
            tags: { hasSome: ["CLINIC", "SICKNESS"] },
          },
          orderBy: { date: "asc" },
          take: MAX_JOURNAL_ENTRIES,
          select: { id: true, date: true, text: true, tags: true },
        }),
      ]);

      const [temperatureCount, highest, latestTemperatures] = temperatures;

      // Per medicine: counts and first/last dose from one grouped query, and
      // the doses themselves only when there are few enough to list
      const medicineIds = medicines.map((m) => m.id);
      const period = { gte: windowStart, lt: windowEnd };
      const doseStats =
        medicineIds.length === 0
          ? []
          : await ctx.prisma.medicineRecord.groupBy({
              by: ["medicineId", "skipped"],
              where: { medicineId: { in: medicineIds }, time: period },
              _count: { _all: true },
              _min: { time: true },
              _max: { time: true },
            });
      const givenStats = new Map(
        doseStats.filter((s) => !s.skipped).map((s) => [s.medicineId, s])
      );
      const skippedCounts = new Map(
        doseStats.filter((s) => s.skipped).map((s) => [s.medicineId, s._count._all])
      );
      const listedIds = medicineIds.filter(
        (id) => (givenStats.get(id)?._count._all ?? 0) <= LIST_DOSES_UP_TO
      );
      const listedDoses =
        listedIds.length === 0
          ? []
          : await ctx.prisma.medicineRecord.findMany({
              where: { medicineId: { in: listedIds }, skipped: false, time: period },
              orderBy: { time: "asc" },
              select: { medicineId: true, time: true, dosageGiven: true },
            });

      return {
        child,
        range: { from: fromKey, to: toKey, days: dayKeys.length, period: effective },
        lastCheckupDate: lastCheckupKey,
        averages: summarizePeriod({ dayKeys: averageKeys, sleep, feedings, diapers, pumping }),
        growth: growth.map((g) => ({
          date: keyOf(g.date),
          weightKg: g.weightKg,
          heightCm: g.heightCm,
          headCircumferenceCm: g.headCircumferenceCm,
        })),
        medicines: medicines
          // Medicines that are in use or were given or skipped in the period
          .filter((m) => m.isActive || givenStats.has(m.id) || skippedCounts.has(m.id))
          .map((m) => {
            const stats = givenStats.get(m.id);
            return {
              id: m.id,
              name: m.name,
              dosage: m.dosage,
              frequency: m.frequency,
              isActive: m.isActive,
              givenCount: stats?._count._all ?? 0,
              firstDose: stats?._min.time ?? null,
              lastDose: stats?._max.time ?? null,
              skipped: skippedCounts.get(m.id) ?? 0,
              // Only for few doses: the first and last are enough otherwise
              doses: listedDoses
                .filter((d) => d.medicineId === m.id)
                .map((d) => ({ time: d.time, dosageGiven: d.dosageGiven })),
            };
          }),
        temperatures: {
          count: temperatureCount,
          highest: highest ? { time: highest.time, celsius: highest.temperatureCelsius } : null,
          // Newest first, capped; `count` tells how many there are in all
          latest: latestTemperatures.map((t) => ({ time: t.time, celsius: t.temperatureCelsius })),
        },
        vaccinations: vaccinations.map((v) => ({
          vaccineKey: v.vaccineKey,
          givenAt: keyOf(v.givenAt),
        })),
        journal: journal.map((e) => ({
          id: e.id,
          date: keyOf(e.date),
          text: e.text,
          tags: e.tags,
        })),
      };
    }),
});
