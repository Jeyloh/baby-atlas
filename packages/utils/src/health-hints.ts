import { osloDayKey } from "./oslo-day";
import { osloMinutesOfDay } from "./quiet-hours";
import { ageInDays, typicalFeedIntervalMinutes, type FeedEvent } from "./predictions";

/**
 * Rule-based health hints. They are information, never a diagnosis: each one
 * tells the parent what the app noticed and where to read or who to contact.
 *
 * Sources (checked October 2026):
 * - Fever in children (Helsenorge): contact a doctor when the child is three
 *   months or younger and has a fever, has a fever and a lowered general
 *   condition, or when paracetamol is needed for more than two to three days.
 *   https://www.helsenorge.no/sykdom/barn/feber-hos-barn/
 *   Norwegian paediatric guidance counts 38.0 C measured rectally as fever
 *   and treats a fever under 3 months as a reason for a doctor to see the
 *   baby (Helsebiblioteket, Generell veileder i pediatri, 3.26 Behandling av feber).
 *   A temperature under 35 C in a young baby is also a reason to call.
 * - Very high fever (40 C or more) in older babies: Helsetelefonen advises a
 *   doctor for a fever over 40 C that does not come down. https://helsetelefonen.no/feber-hos-barn/
 * - Wet diapers and feeding in newborns: Helsedirektoratet's breastfeeding
 *   booklet "Hvordan du ammer ditt barn" and Helsenorge say 5 to 6 or more wet
 *   diapers a day from about day 5 is a good sign, and that newborns feed
 *   8 to 12 times a day. https://www.helsenorge.no/barn/spedbarnsmat-og-amming/amming-og-morsmelk
 * - Emergency numbers: legevakt 116 117, ambulance 113.
 */

export const HELSENORGE_FEVER_URL = "https://www.helsenorge.no/sykdom/barn/feber-hos-barn/";
export const HELSENORGE_FEEDING_URL =
  "https://www.helsenorge.no/barn/spedbarnsmat-og-amming/amming-og-morsmelk";

/** Fever (rectal measurement) in Celsius. */
export const FEVER_CELSIUS = 38.0;
/** A temperature below this in a baby under 3 months is a reason to contact a doctor. */
export const LOW_TEMPERATURE_CELSIUS = 35.0;
/** A very high fever for an older baby. */
export const VERY_HIGH_FEVER_CELSIUS = 40.0;
/** Babies younger than this (in whole months, calendar) get the strict fever rule. */
export const YOUNG_INFANT_MONTHS = 3;
/** A fever hint stays this long after the reading. */
export const FEVER_HINT_HOURS = 24;
/** Fever lasting this many hours or more triggers the "fever for days" hint. */
export const LONG_FEVER_HOURS = 72;

export const NEWBORN_WET_DIAPER_FROM_DAY = 5;
export const NEWBORN_WET_DIAPER_UNTIL_DAY = 28;
export const MIN_WET_DIAPERS_PER_DAY = 6;
/** Wet diapers are only counted when this many diapers of any kind were logged, so a gap in logging does not look like a problem. */
export const MIN_LOGGED_DIAPERS_FOR_HINT = 4;

export const FEED_GAP_MAX_AGE_DAYS = 60;
export const FEED_GAP_MIN_HOURS = 4;
export const FEED_GAP_FACTOR = 1.75;
/** The feeding gap hint only shows in the daytime (Oslo). */
const DAY_START = 7 * 60;
const DAY_END = 22 * 60;

const HOUR = 60 * 60 * 1000;

export type HealthHintKind =
  | "feverYoung"
  | "lowTemperatureYoung"
  | "feverVeryHigh"
  | "feverLong"
  | "wetDiapers"
  | "feedingGap";

export interface HealthHint {
  /** Stable for one occurrence, so a dismissal holds until the situation changes */
  id: string;
  kind: HealthHintKind;
  /** "urgent" is shown first and in a stronger style */
  severity: "urgent" | "info";
  /** Values for the message text */
  params: Record<string, string | number>;
  /** Page to read more */
  url: string;
  /** When the hint stops showing even if the situation stays the same (null: no limit) */
  expiresAt: Date | null;
}

export interface TemperatureReading {
  id: string;
  time: Date;
  celsius: number;
}

export interface DiaperEvent {
  time: Date;
  diaperType: "WET" | "DIRTY" | "BOTH" | "DRY";
}

export interface HealthHintInput {
  birthDate: Date;
  now: Date;
  /** Readings from the last 5 days or so */
  temperatures: TemperatureReading[];
  /** Diapers from the last 24 hours */
  diapers: DiaperEvent[];
  /** Breast and bottle feeds from the last 48 hours (not solids) */
  feeds: (FeedEvent & { endTime?: Date | null })[];
  /** A feed is running right now */
  feedingActive?: boolean;
}

/** Whole calendar months between birth date and now (birth date and now taken as UTC dates). */
function isYoungerThanMonths(birthDate: Date, now: Date, months: number): boolean {
  const limit = new Date(
    Date.UTC(birthDate.getUTCFullYear(), birthDate.getUTCMonth() + months, birthDate.getUTCDate())
  );
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return today < limit;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function feverHints(input: HealthHintInput): HealthHint[] {
  const { now, birthDate } = input;
  const readings = input.temperatures
    .filter((r) => r.time.getTime() <= now.getTime())
    .sort((a, b) => a.time.getTime() - b.time.getTime());
  if (readings.length === 0) return [];

  const young = isYoungerThanMonths(birthDate, now, YOUNG_INFANT_MONTHS);
  const recent = readings.filter((r) => now.getTime() - r.time.getTime() < FEVER_HINT_HOURS * HOUR);
  const expiresOf = (r: TemperatureReading) => new Date(r.time.getTime() + FEVER_HINT_HOURS * HOUR);
  const hints: HealthHint[] = [];

  if (young) {
    const fever = recent.filter((r) => r.celsius >= FEVER_CELSIUS).at(-1);
    if (fever) {
      hints.push({
        id: `feverYoung:${fever.id}`,
        kind: "feverYoung",
        severity: "urgent",
        params: { temperature: round1(fever.celsius) },
        url: HELSENORGE_FEVER_URL,
        expiresAt: expiresOf(fever),
      });
    }
    const low = recent.filter((r) => r.celsius < LOW_TEMPERATURE_CELSIUS).at(-1);
    if (low) {
      hints.push({
        id: `lowTemperatureYoung:${low.id}`,
        kind: "lowTemperatureYoung",
        severity: "urgent",
        params: { temperature: round1(low.celsius) },
        url: HELSENORGE_FEVER_URL,
        expiresAt: expiresOf(low),
      });
    }
    return hints;
  }

  const veryHigh = recent.filter((r) => r.celsius >= VERY_HIGH_FEVER_CELSIUS).at(-1);
  if (veryHigh) {
    hints.push({
      id: `feverVeryHigh:${veryHigh.id}`,
      kind: "feverVeryHigh",
      severity: "info",
      params: { temperature: round1(veryHigh.celsius) },
      url: HELSENORGE_FEVER_URL,
      expiresAt: expiresOf(veryHigh),
    });
  }

  // A run of fever readings that started at least 72 hours before the latest one,
  // with the latest reading inside the last 24 hours.
  const latest = readings[readings.length - 1]!;
  if (latest.celsius >= FEVER_CELSIUS && now.getTime() - latest.time.getTime() < FEVER_HINT_HOURS * HOUR) {
    let first = latest;
    for (let i = readings.length - 2; i >= 0; i--) {
      const reading = readings[i]!;
      if (reading.celsius < FEVER_CELSIUS) break;
      first = reading;
    }
    const spanHours = (latest.time.getTime() - first.time.getTime()) / HOUR;
    if (spanHours >= LONG_FEVER_HOURS) {
      hints.push({
        id: `feverLong:${latest.id}`,
        kind: "feverLong",
        severity: "info",
        params: { days: Math.floor(spanHours / 24) },
        url: HELSENORGE_FEVER_URL,
        expiresAt: expiresOf(latest),
      });
    }
  }
  return hints;
}

function wetDiaperHint(input: HealthHintInput): HealthHint | null {
  const { now, birthDate } = input;
  const days = ageInDays(birthDate, now);
  if (days < NEWBORN_WET_DIAPER_FROM_DAY || days >= NEWBORN_WET_DIAPER_UNTIL_DAY) return null;

  const since = now.getTime() - 24 * HOUR;
  const diapers = input.diapers.filter(
    (d) => d.time.getTime() >= since && d.time.getTime() <= now.getTime()
  );
  if (diapers.length < MIN_LOGGED_DIAPERS_FOR_HINT) return null;

  const wet = diapers.filter((d) => d.diaperType === "WET" || d.diaperType === "BOTH").length;
  if (wet >= MIN_WET_DIAPERS_PER_DAY) return null;

  return {
    id: `wetDiapers:${osloDayKey(now)}`,
    kind: "wetDiapers",
    severity: "info",
    params: { count: wet, min: MIN_WET_DIAPERS_PER_DAY },
    url: HELSENORGE_FEEDING_URL,
    expiresAt: null,
  };
}

function feedingGapHint(input: HealthHintInput): HealthHint | null {
  const { now, birthDate } = input;
  if (input.feedingActive) return null;
  if (ageInDays(birthDate, now) >= FEED_GAP_MAX_AGE_DAYS) return null;

  const minuteOfDay = osloMinutesOfDay(now);
  if (minuteOfDay < DAY_START || minuteOfDay >= DAY_END) return null;

  const typical = typicalFeedIntervalMinutes(input.feeds, now);
  if (!typical) return null;

  // Measure from when the latest feed ended if it is known
  const last = input.feeds
    .filter((f) => f.startTime.getTime() <= now.getTime())
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    .at(-1);
  if (!last) return null;
  const lastTime = Math.max(last.startTime.getTime(), last.endTime?.getTime() ?? 0);
  const gapMinutes = (now.getTime() - lastTime) / 60_000;

  if (gapMinutes <= FEED_GAP_MIN_HOURS * 60 || gapMinutes <= typical.minutes * FEED_GAP_FACTOR) {
    return null;
  }

  return {
    id: `feedingGap:${last.startTime.getTime()}`,
    kind: "feedingGap",
    severity: "info",
    params: { hours: Math.floor(gapMinutes / 60) },
    url: HELSENORGE_FEEDING_URL,
    expiresAt: null,
  };
}

/** All hints that apply right now, urgent ones first. */
export function evaluateHealthHints(input: HealthHintInput): HealthHint[] {
  const hints = [...feverHints(input)];
  const wet = wetDiaperHint(input);
  if (wet) hints.push(wet);
  const gap = feedingGapHint(input);
  if (gap) hints.push(gap);

  return hints
    .filter((h) => !h.expiresAt || h.expiresAt.getTime() > input.now.getTime())
    .sort((a, b) => Number(b.severity === "urgent") - Number(a.severity === "urgent"));
}
