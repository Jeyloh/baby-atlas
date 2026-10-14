/**
 * The Norwegian childhood immunisation programme (Barnevaksinasjonsprogrammet,
 * FHI) for ages 0 to 3. Risk-group vaccines (BCG, hepatitis B at birth) are
 * not included. Doses at 7 and 11 years fall outside the app's age range.
 *
 * `vaccine` is a translation key under `vaccines.names` in the web app.
 */
export type VaccineId = "rotavirus" | "sixInOne" | "pneumococcal" | "mmr";

export interface VaccineDose {
  key: string;
  vaccine: VaccineId;
  dose: number;
  due: { weeks: number } | { months: number };
  /**
   * Last age in days at which the dose can still be given, when the vaccine has
   * an upper age limit (rotavirus: dose 1 before 12 weeks, dose 2 before 16 weeks).
   */
  maxAgeDays?: number;
}

export const NORWEGIAN_VACCINE_PROGRAMME: VaccineDose[] = [
  { key: "rotavirus-1", vaccine: "rotavirus", dose: 1, due: { weeks: 6 }, maxAgeDays: 84 },
  { key: "rotavirus-2", vaccine: "rotavirus", dose: 2, due: { months: 3 }, maxAgeDays: 112 },
  { key: "six-in-one-1", vaccine: "sixInOne", dose: 1, due: { months: 3 } },
  { key: "pneumococcal-1", vaccine: "pneumococcal", dose: 1, due: { months: 3 } },
  { key: "six-in-one-2", vaccine: "sixInOne", dose: 2, due: { months: 5 } },
  { key: "pneumococcal-2", vaccine: "pneumococcal", dose: 2, due: { months: 5 } },
  { key: "six-in-one-3", vaccine: "sixInOne", dose: 3, due: { months: 12 } },
  { key: "pneumococcal-3", vaccine: "pneumococcal", dose: 3, due: { months: 12 } },
  { key: "mmr-1", vaccine: "mmr", dose: 1, due: { months: 15 } },
];

export function isKnownVaccineKey(key: string): boolean {
  return NORWEGIAN_VACCINE_PROGRAMME.some((d) => d.key === key);
}

/**
 * `birthDate` is a date-only value (UTC midnight, as Prisma returns @db.Date),
 * so the arithmetic is done on UTC calendar fields. Local-time math would
 * shift the result by a day when it crosses a daylight saving change.
 * Month addition clamps to the last day (31 Jan + 1 month = 28/29 Feb).
 */
export function vaccineDueDate(birthDate: Date, dose: VaccineDose): Date {
  const y = birthDate.getUTCFullYear();
  const m = birthDate.getUTCMonth();
  const d = birthDate.getUTCDate();

  if ("weeks" in dose.due) {
    return new Date(Date.UTC(y, m, d + dose.due.weeks * 7));
  }
  const lastDayOfTargetMonth = new Date(Date.UTC(y, m + dose.due.months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m + dose.due.months, Math.min(d, lastDayOfTargetMonth)));
}

export type VaccineStatus = "given" | "overdue" | "due" | "upcoming";

/** "due" means within the next 14 days, or up to 30 days past the due date. */
export function vaccineStatus(
  dueDate: Date,
  givenAt: Date | null,
  now: Date = new Date()
): VaccineStatus {
  if (givenAt) return "given";
  const daysUntil = (dueDate.getTime() - now.getTime()) / 86_400_000;
  if (daysUntil < -30) return "overdue";
  if (daysUntil <= 14) return "due";
  return "upcoming";
}
