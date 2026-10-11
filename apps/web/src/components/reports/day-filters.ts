import type {
  SleepRecord,
  FeedingRecord,
  DiaperRecord,
  PumpingRecord,
  MedicineRecord,
  GrowthRecord,
  TemperatureRecord,
  ActivityRecord,
} from "@/components/reports/timeline/track";

export type DayFilter =
  | "sleep"
  | "nursing"
  | "bottle"
  | "solids"
  | "diaper"
  | "pumping"
  | "medicine"
  | "temperature"
  | "growth"
  | "activity";

export interface DayRecords {
  sleepRecords: SleepRecord[];
  feedingRecords: FeedingRecord[];
  diaperRecords: DiaperRecord[];
  pumpingRecords: PumpingRecord[];
  medicineRecords: MedicineRecord[];
  growthRecords: GrowthRecord[];
  temperatureRecords: TemperatureRecord[];
  activityRecords: ActivityRecord[];
}

export type DaySummaryValue =
  | { kind: "minutes"; value: number }
  | { kind: "ml"; value: number }
  | { kind: "count"; value: number };

export interface DaySummaryItem {
  filter: DayFilter;
  summary: DaySummaryValue;
  count: number;
}

// Always shown, so the row keeps its shape on quiet days
const CORE: DayFilter[] = ["sleep", "nursing", "bottle", "solids", "diaper"];
// Shown only on days they were logged
const EXTRA: DayFilter[] = ["pumping", "medicine", "temperature", "growth", "activity"];

export interface DayWindow {
  start: Date;
  end: Date;
}

// Only the part inside the day counts: a night sleep from 19:30 to 08:30
// spans the 08:00 boundary and must not be counted in full on both days
const minutes = (records: { startTime: Date; endTime: Date | null }[], window: DayWindow) =>
  Math.round(
    records.reduce((sum, r) => {
      if (!r.endTime) return sum;
      const start = Math.max(new Date(r.startTime).getTime(), window.start.getTime());
      const end = Math.min(new Date(r.endTime).getTime(), window.end.getTime());
      return end > start ? sum + (end - start) / 60000 : sum;
    }, 0)
  );

const ml = (records: { amountMl?: number | null }[]) =>
  records.reduce((sum, r) => sum + (r.amountMl ?? 0), 0);

const feedingsOf = (records: FeedingRecord[], type: string) =>
  records.filter((r) => r.feedingType === type);

export function summarizeDay(day: DayRecords, window: DayWindow): DaySummaryItem[] {
  const breast = feedingsOf(day.feedingRecords, "BREAST");
  const bottle = feedingsOf(day.feedingRecords, "BOTTLE");
  const solids = feedingsOf(day.feedingRecords, "SOLIDS");

  const all: Record<DayFilter, DaySummaryItem> = {
    sleep: { filter: "sleep", summary: { kind: "minutes", value: minutes(day.sleepRecords, window) }, count: day.sleepRecords.length },
    nursing: { filter: "nursing", summary: { kind: "minutes", value: minutes(breast, window) }, count: breast.length },
    bottle: { filter: "bottle", summary: { kind: "ml", value: ml(bottle) }, count: bottle.length },
    solids: { filter: "solids", summary: { kind: "count", value: solids.length }, count: solids.length },
    diaper: { filter: "diaper", summary: { kind: "count", value: day.diaperRecords.length }, count: day.diaperRecords.length },
    pumping: { filter: "pumping", summary: { kind: "ml", value: ml(day.pumpingRecords) }, count: day.pumpingRecords.length },
    medicine: { filter: "medicine", summary: { kind: "count", value: day.medicineRecords.length }, count: day.medicineRecords.length },
    temperature: { filter: "temperature", summary: { kind: "count", value: day.temperatureRecords.length }, count: day.temperatureRecords.length },
    growth: { filter: "growth", summary: { kind: "count", value: day.growthRecords.length }, count: day.growthRecords.length },
    activity: { filter: "activity", summary: { kind: "count", value: day.activityRecords.length }, count: day.activityRecords.length },
  };

  return [...CORE.map((f) => all[f]), ...EXTRA.filter((f) => all[f].count > 0).map((f) => all[f])];
}

/** Keeps only the selected activity types. An empty selection shows everything. */
export function filterDay(day: DayRecords, selected: ReadonlySet<DayFilter>): DayRecords {
  if (selected.size === 0) return day;
  const has = (f: DayFilter) => selected.has(f);
  const feedingTypes = new Set(
    [has("nursing") && "BREAST", has("bottle") && "BOTTLE", has("solids") && "SOLIDS"].filter(Boolean)
  );
  return {
    sleepRecords: has("sleep") ? day.sleepRecords : [],
    feedingRecords: day.feedingRecords.filter((r) => feedingTypes.has(r.feedingType)),
    diaperRecords: has("diaper") ? day.diaperRecords : [],
    pumpingRecords: has("pumping") ? day.pumpingRecords : [],
    medicineRecords: has("medicine") ? day.medicineRecords : [],
    growthRecords: has("growth") ? day.growthRecords : [],
    temperatureRecords: has("temperature") ? day.temperatureRecords : [],
    activityRecords: has("activity") ? day.activityRecords : [],
  };
}
