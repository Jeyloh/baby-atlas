import type { PrismaClient } from "@baby-atlas/db";
import type { InsightsData } from "./build-context";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function loadInsightsData(
  prisma: PrismaClient,
  child: { id: string; birthDate: Date },
  now: Date,
  days = 14
): Promise<InsightsData> {
  const since = new Date(now.getTime() - (days + 1) * DAY_MS);
  const childId = child.id;

  const [
    sleep,
    feedings,
    diapers,
    temperatures,
    growth,
    potty,
    words,
    medicineRecords,
  ] = await Promise.all([
    prisma.sleepRecord.findMany({
      where: { childId, startTime: { gte: since } },
      select: { startTime: true, endTime: true, sleepType: true },
    }),
    prisma.feedingRecord.findMany({
      where: { childId, startTime: { gte: since } },
      select: { startTime: true, feedingType: true, amountMl: true },
    }),
    prisma.diaperRecord.findMany({
      where: { childId, time: { gte: since } },
      select: { time: true, diaperType: true },
    }),
    prisma.temperatureRecord.findMany({
      where: { childId, time: { gte: since } },
      select: { time: true, temperatureCelsius: true },
    }),
    prisma.growthRecord.findMany({
      where: { childId, date: { gte: since } },
      select: {
        date: true,
        weightKg: true,
        heightCm: true,
        headCircumferenceCm: true,
      },
    }),
    prisma.pottyReadinessLog.findMany({
      where: { childId, time: { gte: since } },
      select: { time: true, signals: true },
    }),
    prisma.speechWord.findMany({
      where: { childId, firstSaidAt: { gte: since } },
      select: { word: true, firstSaidAt: true },
    }),
    prisma.medicineRecord.findMany({
      where: { time: { gte: since }, medicine: { childId } },
      select: { time: true, skipped: true, medicine: { select: { name: true } } },
    }),
  ]);

  return {
    now,
    birthDate: child.birthDate,
    days,
    sleep,
    feedings,
    diapers,
    temperatures,
    growth,
    potty,
    words,
    medicines: medicineRecords.map((r) => ({
      time: r.time,
      skipped: r.skipped,
      name: r.medicine.name,
    })),
  };
}
