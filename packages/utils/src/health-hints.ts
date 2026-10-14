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
 *   All limits are for rectal measurement; ear and armpit readings can be
 *   too low or unreliable.
 * - 39.0 C or more at 3 to 6 months: NHS "Fever in children" (contact a
 *   doctor the same day). https://www.nhs.uk/conditions/fever-in-children/
 * - Very high fever (40 C or more): the Helsenorge fever page above (contact
 *   a doctor when the child is limp, will not drink, or has a rash that does
 *   not fade under pressure; call 113 for serious symptoms).
 * - Wet diapers in newborns: Helsedirektoratet's breastfeeding booklet
 *   "Hvordan du ammer ditt barn" and Ammehjelpen (which uses Helsenorge's
 *   films): from about day 5, 5 to 6 or more wet diapers a day is a good sign.
 *   https://ammehjelpen.no/trotte-barn/
 * - Feeding gaps: newborns feed 8 to 12 times a day, and a newborn who
 *   sleeps more than 5 hours should be woken to feed until weight gain is
 *   confirmed (Ammehjelpen, https://ammehjelpen.no/ammehyppighet/).
 *   Helsenorge: https://www.helsenorge.no/barn/spedbarnsmat-og-amming/alt-om-spedbarnsmat/amming/nok-morsmelk/
 * - Emergency numbers: legevakt 116 117, ambulance 113.
 */

export const HELSENORGE_FEVER_URL = "https://www.helsenorge.no/sykdom/barn/feber-hos-barn/";
export const HELSENORGE_ENOUGH_MILK_URL =
  "https://www.helsenorge.no/barn/spedbarnsmat-og-amming/alt-om-spedbarnsmat/amming/nok-morsmelk/";
export const AMMEHJELPEN_WET_DIAPERS_URL = "https://ammehjelpen.no/trotte-barn/";

/** Fever (rectal measurement) in Celsius. */
export const FEVER_CELSIUS = 38.0;
/** A temperature below this in a baby under 3 months is a reason to contact a doctor. */
export const LOW_TEMPERATURE_CELSIUS = 35.0;
/** Below this (but not below 35.0) in a baby under 3 months gets a milder hint. */
export const COOL_TEMPERATURE_CELSIUS = 36.0;
/** A fever this high at 3 to 6 months is a reason to contact a doctor the same day. */
export const INFANT_HIGH_FEVER_CELSIUS = 39.0;
/** A very high fever at any age. */
export const VERY_HIGH_FEVER_CELSIUS = 40.0;
/** Babies up to and including their 3-month birthday get the strict fever rule. */
export const YOUNG_INFANT_MONTHS = 3;
/** The 39 C rule stops at this age. */
export const HIGH_FEVER_INFANT_UNTIL_MONTHS = 6;
/** A fever hint stays this long after the reading. */
export const FEVER_HINT_HOURS = 24;
/** "Fever for days": fever readings on this many separate Oslo days ... */
export const LONG_FEVER_DAYS = 3;
/** ... within this many hours. */
export const LONG_FEVER_WINDOW_HOURS = 96;

export const NEWBORN_WET_DIAPER_FROM_DAY = 5;
export const NEWBORN_WET_DIAPER_UNTIL_DAY = 28;
/** Wet diapers a day expected on days 5 and 6, and from day 7. */
export const MIN_WET_DIAPERS_DAY_5_TO_6 = 5;
export const MIN_WET_DIAPERS_FROM_DAY_7 = 6;
/** Wet diapers are only counted when this many diapers of any kind were logged, so a gap in logging does not look like a problem. */
export const MIN_LOGGED_DIAPERS_FOR_HINT = 4;

/** Under this age the feeding gap hint also shows at night. */
export const NEWBORN_FEED_GAP_DAYS = 28;
export const FEED_GAP_MAX_AGE_DAYS = 60;
export const FEED_GAP_MIN_HOURS = 4;
export const FEED_GAP_FACTOR = 1.75;
/** A newborn who goes this long without a feed is worth a hint even without a feeding rhythm. */
export const NEWBORN_FEED_GAP_HOURS = 5;
/** For babies of 4 weeks and older the feeding gap hint only shows in the daytime (Oslo). */
const DAY_START = 7 * 60;
const DAY_END = 22 * 60;

const HOUR = 60 * 60 * 1000;

export type HealthHintKind =
  | "feverYoung"
  | "lowTemperatureYoung"
  | "coolTemperatureYoung"
  | "feverInfant"
  | "feverVeryHigh"
  | "feverLong"
  | "wetDiapers"
  | "feedingGap";

export type HealthHintSource = "helsenorge" | "ammehjelpen";

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
  /** Who runs the page at `url`, for the link text */
  source: HealthHintSource;
  /** The text mentions 113, so the card offers a call button for it */
  emergency: boolean;
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

function monthLimit(birthDate: Date, months: number): number {
  return Date.UTC(birthDate.getUTCFullYear(), birthDate.getUTCMonth() + months, birthDate.getUTCDate());
}

function today(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/** Three months old or younger: through the day of the 3-month birthday. */
function isYoungInfant(birthDate: Date, now: Date): boolean {
  return today(now) <= monthLimit(birthDate, YOUNG_INFANT_MONTHS);
}

/** Older than 3 months and younger than 6 months. */
function isOlderInfant(birthDate: Date, now: Date): boolean {
  return (
    !isYoungInfant(birthDate, now) && today(now) < monthLimit(birthDate, HIGH_FEVER_INFANT_UNTIL_MONTHS)
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

const feverBase = { url: HELSENORGE_FEVER_URL, source: "helsenorge" } as const;

function feverHints(input: HealthHintInput): HealthHint[] {
  const { now, birthDate } = input;
  const readings = input.temperatures
    .filter((r) => r.time.getTime() <= now.getTime())
    .sort((a, b) => a.time.getTime() - b.time.getTime());
  if (readings.length === 0) return [];

  const recent = readings.filter((r) => now.getTime() - r.time.getTime() < FEVER_HINT_HOURS * HOUR);
  const expiresOf = (r: TemperatureReading) => new Date(r.time.getTime() + FEVER_HINT_HOURS * HOUR);
  const hints: HealthHint[] = [];

  if (isYoungInfant(birthDate, now)) {
    const fever = recent.filter((r) => r.celsius >= FEVER_CELSIUS).at(-1);
    if (fever) {
      hints.push({
        ...feverBase,
        id: `feverYoung:${fever.id}`,
        kind: "feverYoung",
        severity: "urgent",
        emergency: true,
        params: { temperature: round1(fever.celsius) },
        expiresAt: expiresOf(fever),
      });
    }
    const low = recent.filter((r) => r.celsius < LOW_TEMPERATURE_CELSIUS).at(-1);
    if (low) {
      hints.push({
        ...feverBase,
        id: `lowTemperatureYoung:${low.id}`,
        kind: "lowTemperatureYoung",
        severity: "urgent",
        emergency: true,
        params: { temperature: round1(low.celsius) },
        expiresAt: expiresOf(low),
      });
    } else {
      const cool = recent.filter((r) => r.celsius < COOL_TEMPERATURE_CELSIUS).at(-1);
      if (cool) {
        hints.push({
          ...feverBase,
          id: `coolTemperatureYoung:${cool.id}`,
          kind: "coolTemperatureYoung",
          severity: "info",
          emergency: false,
          params: { temperature: round1(cool.celsius) },
          expiresAt: expiresOf(cool),
        });
      }
    }
    return hints;
  }

  const veryHigh = recent.filter((r) => r.celsius >= VERY_HIGH_FEVER_CELSIUS).at(-1);
  if (veryHigh) {
    hints.push({
      ...feverBase,
      id: `feverVeryHigh:${veryHigh.id}`,
      kind: "feverVeryHigh",
      severity: "info",
      emergency: true,
      params: { temperature: round1(veryHigh.celsius) },
      expiresAt: expiresOf(veryHigh),
    });
  } else if (isOlderInfant(birthDate, now)) {
    const high = recent.filter((r) => r.celsius >= INFANT_HIGH_FEVER_CELSIUS).at(-1);
    if (high) {
      hints.push({
        ...feverBase,
        id: `feverInfant:${high.id}`,
        kind: "feverInfant",
        severity: "info",
        emergency: true,
        params: { temperature: round1(high.celsius) },
        expiresAt: expiresOf(high),
      });
    }
  }

  // Fever readings on three or more separate Oslo days in the last four days,
  // with a fever reading in the last 24 hours. Lower readings in between do
  // not reset it: a fever often dips between doses of medicine.
  const windowStart = now.getTime() - LONG_FEVER_WINDOW_HOURS * HOUR;
  const feverReadings = readings.filter((r) => r.celsius >= FEVER_CELSIUS && r.time.getTime() >= windowStart);
  const latestFever = feverReadings.at(-1);
  if (latestFever && now.getTime() - latestFever.time.getTime() < FEVER_HINT_HOURS * HOUR) {
    const days = new Set(feverReadings.map((r) => osloDayKey(r.time))).size;
    if (days >= LONG_FEVER_DAYS) {
      hints.push({
        ...feverBase,
        id: `feverLong:${latestFever.id}`,
        kind: "feverLong",
        severity: "info",
        emergency: false,
        params: { days },
        expiresAt: expiresOf(latestFever),
      });
    }
  }
  return hints;
}

/** The fewest wet diapers in 24 hours that counts as a good sign at this age in days, or null outside the age range. */
export function minWetDiapersForAge(ageDays: number): number | null {
  if (ageDays < NEWBORN_WET_DIAPER_FROM_DAY || ageDays >= NEWBORN_WET_DIAPER_UNTIL_DAY) return null;
  return ageDays < 7 ? MIN_WET_DIAPERS_DAY_5_TO_6 : MIN_WET_DIAPERS_FROM_DAY_7;
}

function wetDiaperHint(input: HealthHintInput): HealthHint | null {
  const { now, birthDate } = input;
  const min = minWetDiapersForAge(ageInDays(birthDate, now));
  if (min === null) return null;

  const since = now.getTime() - 24 * HOUR;
  const diapers = input.diapers.filter(
    (d) => d.time.getTime() >= since && d.time.getTime() <= now.getTime()
  );
  if (diapers.length < MIN_LOGGED_DIAPERS_FOR_HINT) return null;

  const wet = diapers.filter((d) => d.diaperType === "WET" || d.diaperType === "BOTH").length;
  if (wet >= min) return null;

  return {
    id: `wetDiapers:${osloDayKey(now)}`,
    kind: "wetDiapers",
    severity: "info",
    emergency: false,
    params: { count: wet, min },
    url: AMMEHJELPEN_WET_DIAPERS_URL,
    source: "ammehjelpen",
    expiresAt: null,
  };
}

function feedingGapHint(input: HealthHintInput): HealthHint | null {
  const { now, birthDate } = input;
  if (input.feedingActive) return null;
  const days = ageInDays(birthDate, now);
  if (days >= FEED_GAP_MAX_AGE_DAYS) return null;

  // A newborn is woken to feed day and night, so the hint shows at any hour.
  // Older babies sleep longer at night, so the hint waits for the daytime.
  const newborn = days < NEWBORN_FEED_GAP_DAYS;
  const minuteOfDay = osloMinutesOfDay(now);
  if (!newborn && (minuteOfDay < DAY_START || minuteOfDay >= DAY_END)) return null;

  // Measure from when the latest feed ended if it is known
  const last = input.feeds
    .filter((f) => f.startTime.getTime() <= now.getTime())
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    .at(-1);
  if (!last) return null;
  const lastTime = Math.max(last.startTime.getTime(), last.endTime?.getTime() ?? 0);
  const gapMinutes = (now.getTime() - lastTime) / 60_000;

  const typical = typicalFeedIntervalMinutes(input.feeds, now);
  const longForTheirRhythm =
    typical !== null &&
    gapMinutes > FEED_GAP_MIN_HOURS * 60 &&
    gapMinutes > typical.minutes * FEED_GAP_FACTOR;
  const longForANewborn = newborn && gapMinutes > NEWBORN_FEED_GAP_HOURS * 60;
  if (!longForTheirRhythm && !longForANewborn) return null;

  return {
    id: `feedingGap:${last.startTime.getTime()}`,
    kind: "feedingGap",
    severity: "info",
    emergency: false,
    params: { hours: Math.floor(gapMinutes / 60) },
    url: HELSENORGE_ENOUGH_MILK_URL,
    source: "helsenorge",
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
