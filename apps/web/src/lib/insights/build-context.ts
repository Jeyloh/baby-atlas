const TIME_ZONE = "Europe/Oslo";
const DAY_MS = 24 * 60 * 60 * 1000;
export const FEVER_THRESHOLD_CELSIUS = 38;

export interface SleepInput {
  startTime: Date;
  endTime: Date | null;
  sleepType: "NAP" | "NIGHT";
}

export interface FeedingInput {
  startTime: Date;
  feedingType: "BREAST" | "BOTTLE" | "SOLIDS";
  amountMl: number | null;
}

export interface DiaperInput {
  time: Date;
  diaperType: "WET" | "DIRTY" | "BOTH" | "DRY";
}

export interface TemperatureInput {
  time: Date;
  temperatureCelsius: number;
}

export interface GrowthInput {
  date: Date;
  weightKg: number | null;
  heightCm: number | null;
  headCircumferenceCm: number | null;
}

export interface PottyInput {
  time: Date;
  signals: string[];
}

export interface WordInput {
  word: string;
  firstSaidAt: Date;
}

export interface MedicineInput {
  time: Date;
  name: string;
  skipped: boolean;
}

export interface InsightsData {
  now: Date;
  birthDate: Date;
  days?: number;
  sleep: SleepInput[];
  feedings: FeedingInput[];
  diapers: DiaperInput[];
  temperatures: TemperatureInput[];
  growth: GrowthInput[];
  potty: PottyInput[];
  words: WordInput[];
  medicines: MedicineInput[];
}

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("nb-NO", {
  timeZone: TIME_ZONE,
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function dayKey(date: Date): string {
  return dayFormatter.format(date);
}

export function lastDayKeys(days: number, now: Date): string[] {
  return Array.from({ length: days }, (_, i) =>
    dayKey(new Date(now.getTime() - (days - 1 - i) * DAY_MS))
  );
}

export function ageInMonths(birthDate: Date, now: Date): number {
  let months =
    (now.getUTCFullYear() - birthDate.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - birthDate.getUTCMonth());
  if (now.getUTCDate() < birthDate.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

function hm(minutes: number): string {
  return `${Math.floor(minutes / 60)}t${String(minutes % 60).padStart(2, "0")}`;
}

function groupByDay<T>(
  items: T[],
  keys: string[],
  getDate: (item: T) => Date
): Map<string, T[]> {
  const groups = new Map<string, T[]>(keys.map((key) => [key, []]));
  for (const item of items) {
    groups.get(dayKey(getDate(item)))?.push(item);
  }
  return groups;
}

export function summarizeSleep(records: SleepInput[], keys: string[]): string[] {
  const byDay = groupByDay(records, keys, (r) => r.startTime);
  const lines = keys.flatMap((key) => {
    const day = byDay.get(key) ?? [];
    if (day.length === 0) return [];
    const finished = day.filter((r) => r.endTime);
    const total = (type: "NAP" | "NIGHT") =>
      finished
        .filter((r) => r.sleepType === type)
        .reduce((sum, r) => sum + minutesBetween(r.startTime, r.endTime!), 0);
    const naps = day.filter((r) => r.sleepType === "NAP").length;
    return [
      `${key}: naps=${naps} (${hm(total("NAP"))}), night=${hm(total("NIGHT"))}`,
    ];
  });
  return lines.length ? ["Sleep per day (start date, hours t minutes):", ...lines] : [];
}

export function summarizeFeedings(records: FeedingInput[], keys: string[]): string[] {
  const byDay = groupByDay(records, keys, (r) => r.startTime);
  const lines = keys.flatMap((key) => {
    const day = (byDay.get(key) ?? []).sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );
    if (day.length === 0) return [];
    const count = (type: FeedingInput["feedingType"]) =>
      day.filter((r) => r.feedingType === type).length;
    const bottles = day.filter(
      (r) => r.feedingType === "BOTTLE" && r.amountMl != null
    );
    const ml = bottles.reduce((sum, r) => sum + r.amountMl!, 0);
    const gaps = day
      .slice(1)
      .map((r, i) => minutesBetween(day[i]!.startTime, r.startTime));
    const avgGap = gaps.length
      ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)
      : null;
    const parts = [
      `breast=${count("BREAST")}`,
      `bottle=${count("BOTTLE")}${bottles.length ? ` (${ml} ml total)` : ""}`,
      `solids=${count("SOLIDS")}`,
    ];
    if (avgGap !== null) parts.push(`avg interval=${hm(avgGap)}`);
    return [`${key}: ${parts.join(", ")}`];
  });
  return lines.length ? ["Feeds per day:", ...lines] : [];
}

export function summarizeDiapers(records: DiaperInput[], keys: string[]): string[] {
  const byDay = groupByDay(records, keys, (r) => r.time);
  const lines = keys.flatMap((key) => {
    const day = byDay.get(key) ?? [];
    if (day.length === 0) return [];
    const count = (...types: DiaperInput["diaperType"][]) =>
      day.filter((r) => types.includes(r.diaperType)).length;
    return [
      `${key}: wet=${count("WET", "BOTH")}, dirty=${count("DIRTY", "BOTH")}, dry=${count("DRY")}`,
    ];
  });
  return lines.length ? ["Diapers per day (wet and dirty include both):", ...lines] : [];
}

export function summarizeTemperatures(records: TemperatureInput[]): string[] {
  if (records.length === 0) return [];
  const sorted = [...records].sort((a, b) => a.time.getTime() - b.time.getTime());
  const fevers = sorted.filter(
    (r) => r.temperatureCelsius >= FEVER_THRESHOLD_CELSIUS
  );
  const lines = [
    `Temperature: ${sorted.length} readings, max ${Math.max(
      ...sorted.map((r) => r.temperatureCelsius)
    ).toFixed(1)} C, fever readings (>= ${FEVER_THRESHOLD_CELSIUS} C): ${fevers.length}`,
  ];
  for (const r of sorted.slice(-6)) {
    lines.push(`  ${timeFormatter.format(r.time)}: ${r.temperatureCelsius.toFixed(1)} C`);
  }
  if (fevers.length > 0) {
    const days = new Set(fevers.map((r) => dayKey(r.time)));
    lines.push(`  Fever on ${days.size} separate day(s)`);
  }
  return lines;
}

export function summarizeGrowth(records: GrowthInput[]): string[] {
  if (records.length === 0) return [];
  const sorted = [...records].sort((a, b) => a.date.getTime() - b.date.getTime());
  return [
    "Growth measurements:",
    ...sorted.map((r) => {
      const parts = [
        r.weightKg != null ? `weight=${r.weightKg} kg` : null,
        r.heightCm != null ? `height=${r.heightCm} cm` : null,
        r.headCircumferenceCm != null ? `head=${r.headCircumferenceCm} cm` : null,
      ].filter(Boolean);
      return `${dayKey(r.date)}: ${parts.join(", ")}`;
    }),
  ];
}

export function summarizePotty(records: PottyInput[]): string[] {
  if (records.length === 0) return [];
  const counts = new Map<string, number>();
  for (const record of records) {
    for (const signal of record.signals) {
      counts.set(signal, (counts.get(signal) ?? 0) + 1);
    }
  }
  const signals = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([signal, n]) => `${signal}=${n}`)
    .join(", ");
  return [`Potty readiness: ${records.length} log(s). Signals: ${signals || "none"}`];
}

export function summarizeWords(records: WordInput[]): string[] {
  if (records.length === 0) return [];
  const sorted = [...records].sort(
    (a, b) => a.firstSaidAt.getTime() - b.firstSaidAt.getTime()
  );
  return [
    `New words: ${sorted.map((r) => `${r.word} (${dayKey(r.firstSaidAt)})`).join(", ")}`,
  ];
}

export function summarizeMedicines(records: MedicineInput[]): string[] {
  const given = records.filter((r) => !r.skipped);
  if (given.length === 0) return [];
  const counts = new Map<string, number>();
  for (const record of given) {
    counts.set(record.name, (counts.get(record.name) ?? 0) + 1);
  }
  return [
    `Medicine given: ${[...counts.entries()].map(([name, n]) => `${name} x${n}`).join(", ")}`,
  ];
}

export function buildInsightsContext(data: InsightsData): string {
  const days = data.days ?? 14;
  const keys = lastDayKeys(days, data.now);
  const sections = [
    summarizeSleep(data.sleep, keys),
    summarizeFeedings(data.feedings, keys),
    summarizeDiapers(data.diapers, keys),
    summarizeTemperatures(data.temperatures),
    summarizeGrowth(data.growth),
    summarizePotty(data.potty),
    summarizeWords(data.words),
    summarizeMedicines(data.medicines),
  ].filter((lines) => lines.length > 0);

  const header = [
    `Child age: ${ageInMonths(data.birthDate, data.now)} months`,
    `Period: last ${days} days (${keys[0]} to ${keys[keys.length - 1]}), dates in Europe/Oslo`,
  ].join("\n");

  if (sections.length === 0) {
    return `${header}\nNo records were logged in this period.`;
  }
  return [header, ...sections.map((lines) => lines.join("\n"))].join("\n\n");
}
