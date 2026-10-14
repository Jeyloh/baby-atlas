import { NORWEGIAN_VACCINE_PROGRAMME, vaccineDueDate, type VaccineDose } from "./vaccination";
import { osloDayKey } from "./oslo-day";
import { osloMinutesOfDay } from "./quiet-hours";

/**
 * The health station (helsestasjon) programme for ages 0 to 3.
 *
 * Sources:
 * - Helsedirektoratet, national guideline for the health station and school
 *   health service, "Helsestasjon 0-5 år":
 *   https://www.helsedirektoratet.no/retningslinjer/helsestasjons-og-skolehelsetjenesten/helsestasjon-05-ar
 * - Helsebiblioteket, summary of the health station programme:
 *   https://www.helsebiblioteket.no/innhold/pht/svangerskapsomsorg-og-helsestasjon/helsestasjonsprogrammet
 * - FHI, the vaccine schedule (vaccines live in vaccination.ts, which stays the
 *   single source: a checkup only links to dose keys from there):
 *   https://www.fhi.no/va/vaksiner-barn/
 *
 * This is guidance, not a rule. The municipality decides the exact timing and
 * some offer 17 or 18 months, group sessions or a physiotherapist. The window
 * start and end days are our own estimates around the recommended age.
 *
 * Titles, descriptions and who you meet are in the web app messages
 * (`checkups.items.<key>`).
 */
export type CheckupWho = "nurse" | "nurseDoctor";

export type CheckupKey =
  | "home_visit"
  | "week_4"
  | "week_6"
  | "month_3"
  | "month_4"
  | "month_5"
  | "month_6"
  | "month_8"
  | "month_10"
  | "month_12"
  | "month_15"
  | "month_18"
  | "year_2";

export interface CheckupContact {
  key: CheckupKey;
  /** Recommended age in days */
  ageDays: number;
  /** The age range (in days) in which the visit usually takes place */
  windowStartDays: number;
  windowEndDays: number;
  who: CheckupWho;
  /** Often a group consultation */
  group: boolean;
  /** Keys of doses in NORWEGIAN_VACCINE_PROGRAMME given at this visit */
  vaccineKeys: string[];
  /** The nurse arranges it herself, parents normally do not book it */
  arrangedByNurse?: boolean;
  sources: string[];
}

const HELSEDIR =
  "https://www.helsedirektoratet.no/retningslinjer/helsestasjons-og-skolehelsetjenesten/helsestasjon-05-ar";
const HELSEBIBLIOTEKET =
  "https://www.helsebiblioteket.no/innhold/pht/svangerskapsomsorg-og-helsestasjon/helsestasjonsprogrammet";
const FHI_ROTAVIRUS =
  "https://www.fhi.no/va/vaksiner-barn/vaksinene-i-barnevaksinasjonsprogrammet/vaksine-mot-rotavirussykdom/";

export const HELSESTASJON_PROGRAMME: CheckupContact[] = [
  { key: "home_visit", ageDays: 8, windowStartDays: 7, windowEndDays: 14, who: "nurse", group: false, vaccineKeys: [], arrangedByNurse: true, sources: [HELSEBIBLIOTEKET, HELSEDIR] },
  { key: "week_4", ageDays: 28, windowStartDays: 25, windowEndDays: 35, who: "nurse", group: true, vaccineKeys: [], sources: [HELSEBIBLIOTEKET, HELSEDIR] },
  { key: "week_6", ageDays: 42, windowStartDays: 38, windowEndDays: 56, who: "nurseDoctor", group: false, vaccineKeys: ["rotavirus-1"], sources: [HELSEBIBLIOTEKET, HELSEDIR, FHI_ROTAVIRUS] },
  { key: "month_3", ageDays: 91, windowStartDays: 84, windowEndDays: 105, who: "nurse", group: false, vaccineKeys: ["rotavirus-2", "six-in-one-1", "pneumococcal-1"], sources: [HELSEBIBLIOTEKET] },
  { key: "month_4", ageDays: 122, windowStartDays: 112, windowEndDays: 135, who: "nurse", group: true, vaccineKeys: [], sources: [HELSEBIBLIOTEKET, HELSEDIR] },
  { key: "month_5", ageDays: 152, windowStartDays: 140, windowEndDays: 168, who: "nurse", group: false, vaccineKeys: ["six-in-one-2", "pneumococcal-2"], sources: [HELSEBIBLIOTEKET] },
  { key: "month_6", ageDays: 183, windowStartDays: 170, windowEndDays: 200, who: "nurseDoctor", group: false, vaccineKeys: [], sources: [HELSEBIBLIOTEKET, HELSEDIR] },
  { key: "month_8", ageDays: 243, windowStartDays: 225, windowEndDays: 275, who: "nurse", group: false, vaccineKeys: [], sources: [HELSEBIBLIOTEKET] },
  { key: "month_10", ageDays: 304, windowStartDays: 285, windowEndDays: 335, who: "nurse", group: false, vaccineKeys: [], sources: [HELSEBIBLIOTEKET] },
  { key: "month_12", ageDays: 365, windowStartDays: 350, windowEndDays: 395, who: "nurseDoctor", group: false, vaccineKeys: ["six-in-one-3", "pneumococcal-3"], sources: [HELSEBIBLIOTEKET, HELSEDIR] },
  { key: "month_15", ageDays: 456, windowStartDays: 440, windowEndDays: 490, who: "nurse", group: false, vaccineKeys: ["mmr-1"], sources: [HELSEBIBLIOTEKET] },
  { key: "month_18", ageDays: 540, windowStartDays: 500, windowEndDays: 560, who: "nurse", group: true, vaccineKeys: [], sources: [HELSEBIBLIOTEKET, HELSEDIR] },
  { key: "year_2", ageDays: 730, windowStartDays: 700, windowEndDays: 790, who: "nurseDoctor", group: false, vaccineKeys: [], sources: [HELSEBIBLIOTEKET, HELSEDIR] },
];

export function isKnownCheckupKey(key: string): boolean {
  return HELSESTASJON_PROGRAMME.some((c) => c.key === key);
}

export function getCheckup(key: string): CheckupContact | undefined {
  return HELSESTASJON_PROGRAMME.find((c) => c.key === key);
}

/** The visits that give a vaccine dose (normally one). */
export function checkupsForVaccine(vaccineKey: string): CheckupContact[] {
  return HELSESTASJON_PROGRAMME.filter((c) => c.vaccineKeys.includes(vaccineKey));
}

const DAY_MS = 86_400_000;

/** Today's Oslo calendar day as UTC midnight, comparable with date-only values. */
function osloTodayAsUtcDate(now: Date): number {
  const [y, m, d] = osloDayKey(now).split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

/** Whole days from the birth date to today in Oslo. `birthDate` is UTC midnight. */
export function childAgeInDays(birthDate: Date, now: Date): number {
  return Math.round((osloTodayAsUtcDate(now) - birthDate.getTime()) / DAY_MS);
}

function addDays(birthDate: Date, days: number): Date {
  return new Date(birthDate.getTime() + days * DAY_MS);
}

export interface CheckupWindow {
  /** Recommended date (UTC midnight, like birthDate) */
  target: Date;
  start: Date;
  end: Date;
}

export function checkupWindow(birthDate: Date, contact: CheckupContact): CheckupWindow {
  return {
    target: addDays(birthDate, contact.ageDays),
    start: addDays(birthDate, contact.windowStartDays),
    end: addDays(birthDate, contact.windowEndDays),
  };
}

export interface CheckupRecordLike {
  checkupKey: string;
  scheduledAt: Date | null;
  completedAt: Date | null;
}

/**
 * done: marked as done. overdue: the usual window has passed. due: the window is
 * open. upcoming: not yet. Whether a time is booked is a separate fact.
 */
export type CheckupStatus = "done" | "overdue" | "due" | "upcoming";

export function checkupStatus(
  contact: CheckupContact,
  birthDate: Date,
  record: Pick<CheckupRecordLike, "completedAt"> | null | undefined,
  now: Date
): CheckupStatus {
  if (record?.completedAt) return "done";
  const age = childAgeInDays(birthDate, now);
  if (age > contact.windowEndDays) return "overdue";
  if (age >= contact.windowStartDays) return "due";
  return "upcoming";
}

export interface CheckupView {
  contact: CheckupContact;
  window: CheckupWindow;
  status: CheckupStatus;
  scheduledAt: Date | null;
  completedAt: Date | null;
  /** A time is booked and it has not passed yet */
  booked: boolean;
}

/** The whole programme with each visit's status for this child, in age order. */
export function buildCheckupViews(
  birthDate: Date,
  records: CheckupRecordLike[],
  now: Date
): CheckupView[] {
  const byKey = new Map(records.map((r) => [r.checkupKey, r]));
  return HELSESTASJON_PROGRAMME.map((contact) => {
    const record = byKey.get(contact.key) ?? null;
    return {
      contact,
      window: checkupWindow(birthDate, contact),
      status: checkupStatus(contact, birthDate, record, now),
      scheduledAt: record?.scheduledAt ?? null,
      completedAt: record?.completedAt ?? null,
      booked: !!record?.scheduledAt && !record.completedAt && record.scheduledAt > now,
    };
  });
}

/** Visits that are not done and whose window has not passed, soonest first. */
export function upcomingCheckups(views: CheckupView[]): CheckupView[] {
  return views.filter((v) => v.status === "due" || v.status === "upcoming");
}

/** The next visit to think about: the first open or coming one. */
export function nextCheckup(views: CheckupView[]): CheckupView | null {
  return upcomingCheckups(views)[0] ?? null;
}

// ---- Times ----

/** Oslo wall-clock time as an instant ("2026-10-14", "09:30"). */
export function osloLocalToInstant(day: string, time: string): Date {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let guess = wall;
  // Two passes settle the offset, also across a daylight saving change
  for (let i = 0; i < 2; i++) {
    const at = new Date(guess);
    const shown = osloTodayAsUtcDate(at) + osloMinutesOfDay(at) * 60_000;
    guess += wall - shown;
  }
  return new Date(guess);
}

/** HH:mm in Oslo (24-hour). */
export function formatOsloTime(date: Date): string {
  const minutes = osloMinutesOfDay(date);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

// ---- Reminders ----

/** The reminder for a booked time goes out from 17:00 Oslo the day before. */
export const BOOKED_REMINDER_FROM_MINUTES = 17 * 60;

/**
 * A booked appointment tomorrow (Oslo calendar day), and it is 17:00 or later
 * in Oslo now. The dispatcher's quiet hours still apply.
 */
export function isBookedReminderDue(scheduledAt: Date, now: Date): boolean {
  if (scheduledAt <= now) return false;
  const tomorrow = new Date(osloTodayAsUtcDate(now) + DAY_MS).toISOString().slice(0, 10);
  if (osloDayKey(scheduledAt) !== tomorrow) return false;
  return osloMinutesOfDay(now) >= BOOKED_REMINDER_FROM_MINUTES;
}

/**
 * "Time to book": the window is open, the visit is not done and nothing is
 * booked. The nurse arranges the home visit herself, so it is left out.
 */
export function isTimeToBook(
  contact: CheckupContact,
  birthDate: Date,
  record: Pick<CheckupRecordLike, "scheduledAt" | "completedAt"> | null | undefined,
  now: Date
): boolean {
  if (contact.arrangedByNurse) return false;
  if (record?.completedAt || record?.scheduledAt) return false;
  return checkupStatus(contact, birthDate, null, now) === "due";
}

/** Doses more than this long past their due date are no longer reminded about. */
export const VACCINE_REMINDER_MAX_OVERDUE_DAYS = 60;

/**
 * Doses from the existing programme whose due age is reached and that are not
 * recorded, skipping those a checkup booked in the future will cover.
 */
export function vaccinesToRemind(
  birthDate: Date,
  givenKeys: ReadonlySet<string>,
  futureBookedCheckupKeys: ReadonlySet<string>,
  now: Date
): VaccineDose[] {
  const today = osloTodayAsUtcDate(now);
  return NORWEGIAN_VACCINE_PROGRAMME.filter((dose) => {
    if (givenKeys.has(dose.key)) return false;
    const daysPast = (today - vaccineDueDate(birthDate, dose).getTime()) / DAY_MS;
    if (daysPast < 0 || daysPast > VACCINE_REMINDER_MAX_OVERDUE_DAYS) return false;
    return !checkupsForVaccine(dose.key).some((c) => futureBookedCheckupKeys.has(c.key));
  });
}
