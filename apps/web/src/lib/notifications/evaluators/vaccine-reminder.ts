import { vaccinesToRemind } from "@baby-atlas/utils";
import type { Candidate, EvaluatorContext } from "../types";
import { loadChildrenForCheckups } from "./checkup-data";

type ChildRow = Awaited<ReturnType<typeof loadChildrenForCheckups>>[number];

/**
 * Pure part: one notice per vaccine dose whose due age is reached and that is
 * not recorded, unless a checkup that covers it is booked in the future.
 * Doses due at the same age replace each other on the device.
 */
export function vaccineCandidates(child: ChildRow, now: Date): Candidate[] {
  const given = new Set(child.vaccinationRecords.map((r) => r.vaccineKey));
  const futureBooked = new Set(
    child.checkupRecords
      .filter((r) => r.scheduledAt && !r.completedAt && r.scheduledAt > now)
      .map((r) => r.checkupKey)
  );

  return vaccinesToRemind(child.birthDate, given, futureBooked, now).map((dose) => ({
    kind: "VACCINE_REMINDER" as const,
    childId: child.id,
    dedupeKey: `vaccine:${child.id}:${dose.key}`,
    url: `/dashboard/${child.id}/vaccines?tab=vaccines`,
    titleKey: "push.vaccineReminder.title",
    bodyKey: `push.vaccineReminder.body.${dose.vaccine}`,
    params: { child: child.name, dose: dose.dose },
    replaceKey: `vaccine:${child.id}:${JSON.stringify(dose.due)}`,
  }));
}

export async function evaluate({ prisma, now }: EvaluatorContext): Promise<Candidate[]> {
  const children = await loadChildrenForCheckups(prisma, now);
  return children.flatMap((child) => vaccineCandidates(child, now));
}
