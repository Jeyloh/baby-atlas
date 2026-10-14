import { vaccinesToRemind, type VaccineDose } from "@baby-atlas/utils";
import type { Candidate, EvaluatorContext } from "../types";
import { loadChildrenForCheckups } from "./checkup-data";

type ChildRow = Awaited<ReturnType<typeof loadChildrenForCheckups>>[number];

/**
 * Pure part: one notice per due age (for example the 3 month visit), naming
 * all doses of that age that are due and not recorded. Skipped when a checkup
 * that covers them is booked in the future.
 */
export function vaccineCandidates(child: ChildRow, now: Date): Candidate[] {
  const given = new Set(child.vaccinationRecords.map((r) => r.vaccineKey));
  const futureBooked = new Set(
    child.checkupRecords
      .filter((r) => r.scheduledAt && !r.completedAt && r.scheduledAt > now)
      .map((r) => r.checkupKey)
  );

  const byAge = new Map<string, VaccineDose[]>();
  for (const dose of vaccinesToRemind(child.birthDate, given, futureBooked, now)) {
    const dueKey = "weeks" in dose.due ? `w${dose.due.weeks}` : `m${dose.due.months}`;
    byAge.set(dueKey, [...(byAge.get(dueKey) ?? []), dose]);
  }

  return [...byAge.entries()].map(([dueKey, doses]) => ({
    kind: "VACCINE_REMINDER" as const,
    childId: child.id,
    dedupeKey: `vaccine:${child.id}:${dueKey}`,
    url: `/dashboard/${child.id}/vaccines?tab=vaccines`,
    titleKey: "push.vaccineReminder.title",
    bodyKey:
      doses.length === 1
        ? `push.vaccineReminder.body.${doses[0]!.vaccine}`
        : "push.vaccineReminder.body.several",
    params: { child: child.name, count: doses.length },
    replaceKey: `vaccine:${child.id}:${dueKey}`,
  }));
}

export async function evaluate({ prisma, now }: EvaluatorContext): Promise<Candidate[]> {
  const children = await loadChildrenForCheckups(prisma, now);
  return children.flatMap((child) => vaccineCandidates(child, now));
}
