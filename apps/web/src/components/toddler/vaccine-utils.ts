import {
  NORWEGIAN_VACCINE_PROGRAMME,
  vaccineDueDate,
  vaccineStatus,
  type VaccineDose,
  type VaccineStatus,
} from "@baby-atlas/utils";

export interface VaccineRecordLike {
  vaccineKey: string;
  givenAt: Date;
}

export interface VaccineDoseView {
  dose: VaccineDose;
  dueDate: Date;
  givenAt: Date | null;
  status: VaccineStatus;
}

export type DueGroupId = "w6" | "m3" | "m5" | "m12" | "m15";

export interface VaccineGroup {
  id: DueGroupId;
  doses: VaccineDoseView[];
}

export function dueGroupId(dose: VaccineDose): DueGroupId {
  return "weeks" in dose.due
    ? (`w${dose.due.weeks}` as DueGroupId)
    : (`m${dose.due.months}` as DueGroupId);
}

/** The programme grouped by due age, in programme order. */
export function buildVaccineTimeline(
  birthDate: Date,
  records: VaccineRecordLike[],
  now: Date = new Date()
): VaccineGroup[] {
  const given = new Map(records.map((r) => [r.vaccineKey, r.givenAt]));
  const groups: VaccineGroup[] = [];
  for (const dose of NORWEGIAN_VACCINE_PROGRAMME) {
    const givenAt = given.get(dose.key) ?? null;
    const dueDate = vaccineDueDate(birthDate, dose);
    const view: VaccineDoseView = {
      dose,
      dueDate,
      givenAt,
      status: vaccineStatus(dueDate, givenAt, now),
    };
    const id = dueGroupId(dose);
    const group = groups.find((g) => g.id === id);
    if (group) group.doses.push(view);
    else groups.push({ id, doses: [view] });
  }
  return groups;
}
