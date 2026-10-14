import { z } from "zod";
import { createTRPCRouter, householdProcedure } from "../trpc";

/** Shortest absence that gets a handover summary. */
export const HANDOVER_MIN_GAP_MS = 2 * 60 * 60 * 1000;
/** The summary never looks further back than this, however long the absence. */
export const HANDOVER_MAX_WINDOW_MS = 24 * 60 * 60 * 1000;

const childInput = z.object({ childId: z.string().cuid() });

export const handoverRouter = createTRPCRouter({
  /**
   * What happened for this child since the caller was last here. Null when the
   * caller has no earlier visit or was here less than two hours ago.
   */
  summary: householdProcedure.input(childInput).query(async ({ ctx, input }) => {
    const now = new Date();
    const visit = await ctx.prisma.childVisit.findUnique({
      where: {
        userId_childId: { userId: ctx.session.user.id, childId: input.childId },
      },
      select: { lastSeenAt: true },
    });
    if (!visit) return null;
    if (now.getTime() - visit.lastSeenAt.getTime() < HANDOVER_MIN_GAP_MS) return null;

    const windowStart = new Date(
      Math.max(visit.lastSeenAt.getTime(), now.getTime() - HANDOVER_MAX_WINDOW_MS)
    );
    const { childId } = input;
    const inWindow = { gte: windowStart, lte: now };

    const [feeds, sleeps, diapers, doses, temperatures, runningFeeds, runningPumping, runningActivity] =
      await Promise.all([
        ctx.prisma.feedingRecord.findMany({
          where: { childId, startTime: inWindow },
          orderBy: { startTime: "desc" },
          take: 50,
          select: { feedingType: true, startTime: true, side: true, amountMl: true },
        }),
        ctx.prisma.sleepRecord.findMany({
          where: {
            childId,
            startTime: { lte: now },
            OR: [{ endTime: null }, { endTime: { gte: windowStart } }],
          },
          orderBy: { startTime: "desc" },
          take: 50,
          select: { startTime: true, endTime: true, sleepType: true },
        }),
        ctx.prisma.diaperRecord.findMany({
          where: { childId, time: inWindow },
          orderBy: { time: "desc" },
          take: 100,
          select: { diaperType: true, time: true },
        }),
        ctx.prisma.medicineRecord.findMany({
          where: { medicine: { childId }, skipped: false, time: inWindow },
          orderBy: { time: "desc" },
          take: 20,
          select: { time: true, dosageGiven: true, medicine: { select: { name: true } } },
        }),
        ctx.prisma.temperatureRecord.findMany({
          where: { childId, time: inWindow },
          orderBy: { time: "desc" },
          take: 20,
          select: { time: true, temperatureCelsius: true },
        }),
        ctx.prisma.feedingRecord.findMany({
          where: { childId, endTime: null, startTime: { lte: now, gte: windowStart } },
          select: { feedingType: true, startTime: true },
        }),
        ctx.prisma.pumpingRecord.findMany({
          where: { childId, endTime: null, startTime: { lte: now, gte: windowStart } },
          select: { startTime: true },
        }),
        ctx.prisma.activityRecord.findMany({
          where: { childId, endTime: null, startTime: { lte: now, gte: windowStart } },
          select: { activityType: true, startTime: true },
        }),
      ]);

    let sleepMs = 0;
    let sleepingSince: Date | null = null;
    for (const s of sleeps) {
      const start = Math.max(s.startTime.getTime(), windowStart.getTime());
      const end = Math.min((s.endTime ?? now).getTime(), now.getTime());
      if (end > start) sleepMs += end - start;
      if (!s.endTime && (!sleepingSince || s.startTime > sleepingSince)) {
        sleepingSince = s.startTime;
      }
    }
    const lastSleepEnd = sleeps.reduce<Date | null>(
      (latest, s) => (s.endTime && (!latest || s.endTime > latest) ? s.endTime : latest),
      null
    );

    const latestFeed = feeds[0];
    const latestDose = doses[0];
    const latestTemperature = temperatures[0];

    return {
      since: visit.lastSeenAt,
      windowStart,
      feeds: {
        count: feeds.length,
        latest: latestFeed
          ? {
              type: latestFeed.feedingType,
              time: latestFeed.startTime,
              side: latestFeed.side,
              amountMl: latestFeed.amountMl,
            }
          : null,
      },
      sleep: {
        totalMinutes: Math.round(sleepMs / 60000),
        sleepingNow: sleepingSince !== null,
        sleepingSince,
        lastEndedAt: lastSleepEnd,
      },
      diapers: {
        wet: diapers.filter((d) => d.diaperType === "WET" || d.diaperType === "BOTH").length,
        dirty: diapers.filter((d) => d.diaperType === "DIRTY" || d.diaperType === "BOTH").length,
        latestTime: diapers[0]?.time ?? null,
      },
      medicine: {
        count: doses.length,
        latest: latestDose
          ? {
              name: latestDose.medicine.name,
              time: latestDose.time,
              dosageGiven: latestDose.dosageGiven,
            }
          : null,
      },
      temperature: {
        count: temperatures.length,
        latest: latestTemperature
          ? { celsius: latestTemperature.temperatureCelsius, time: latestTemperature.time }
          : null,
      },
      running: [
        ...sleeps
          .filter((s) => !s.endTime)
          .map((s) => ({
            type: s.sleepType === "NIGHT" ? ("sleepNight" as const) : ("sleepNap" as const),
            startTime: s.startTime,
          })),
        ...runningFeeds.map((f) => ({
          type: `feeding${f.feedingType}` as "feedingBREAST" | "feedingBOTTLE" | "feedingSOLIDS",
          startTime: f.startTime,
        })),
        ...runningPumping.map((p) => ({ type: "pumping" as const, startTime: p.startTime })),
        ...runningActivity.map((a) => ({ type: "activity" as const, startTime: a.startTime })),
      ],
    };
  }),

  /** Records that the caller has now seen this child's home screen. */
  markSeen: householdProcedure.input(childInput).mutation(async ({ ctx, input }) => {
    const now = new Date();
    await ctx.prisma.childVisit.upsert({
      where: {
        userId_childId: { userId: ctx.session.user.id, childId: input.childId },
      },
      create: { userId: ctx.session.user.id, childId: input.childId, lastSeenAt: now },
      update: { lastSeenAt: now },
    });
    return { lastSeenAt: now };
  }),
});
