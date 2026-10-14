import {
  formatMinutesOfDay,
  medicineDoseStatus,
  osloMinutesOfDay,
} from "@baby-atlas/utils";
import type { Candidate, Evaluate } from "../types";

const HOUR_MS = 60 * 60 * 1000;
/** Only remind this long after the allowed time, so stale reminders are never sent. */
export const REMINDER_WINDOW_MS = 2 * HOUR_MS;
/** Longest interval setting (48 h) plus the reminder window, for the dose lookup. */
const LOOKBACK_MS = 48 * HOUR_MS + REMINDER_WINDOW_MS;

/**
 * Tells caregivers when the time the parent set as the earliest next dose has
 * passed. Only for medicines with the reminder switched on, never when the
 * 24-hour limit is already reached, and only within two hours of that time.
 * One notice per last dose record. Factual: no advice about dosing.
 */
export const evaluate: Evaluate = async ({ prisma, now }) => {
  const medicines = await prisma.medicine.findMany({
    where: {
      isActive: true,
      remindNextDose: true,
      minIntervalHours: { not: null },
      child: {
        household: {
          members: { some: { user: { pushSubscriptions: { some: {} } } } },
        },
      },
    },
    select: {
      id: true,
      name: true,
      childId: true,
      minIntervalHours: true,
      maxDosesPer24h: true,
      child: { select: { name: true } },
    },
  });
  if (medicines.length === 0) return [];

  const records = await prisma.medicineRecord.findMany({
    where: {
      medicineId: { in: medicines.map((m) => m.id) },
      time: { gte: new Date(now.getTime() - LOOKBACK_MS), lte: now },
    },
    select: { id: true, medicineId: true, time: true, skipped: true },
  });

  const byMedicine = new Map<string, typeof records>();
  for (const record of records) {
    const list = byMedicine.get(record.medicineId);
    if (list) list.push(record);
    else byMedicine.set(record.medicineId, [record]);
  }

  const candidates: Candidate[] = [];
  for (const medicine of medicines) {
    const status = medicineDoseStatus(
      byMedicine.get(medicine.id) ?? [],
      { minIntervalHours: medicine.minIntervalHours, maxDosesPer24h: medicine.maxDosesPer24h },
      now
    );
    if (!status.lastDose || !status.nextByInterval) continue;
    // The 24-hour limit still holds the next dose back
    if (status.maxReached) continue;

    const allowedMs = status.nextByInterval.getTime();
    if (allowedMs > now.getTime() || now.getTime() - allowedMs > REMINDER_WINDOW_MS) continue;

    candidates.push({
      kind: "MEDICINE_NEXT_DOSE",
      childId: medicine.childId,
      dedupeKey: `medicine:${medicine.id}:${status.lastDose.id}`,
      replaceKey: `medicine:${medicine.id}`,
      url: `/dashboard/${medicine.childId}`,
      titleKey: "push.medicineNextDose.title",
      bodyKey: "push.medicineNextDose.body",
      params: {
        medicine: medicine.name,
        child: medicine.child.name,
        time: formatMinutesOfDay(osloMinutesOfDay(status.nextByInterval)),
      },
    });
  }
  return candidates;
};
