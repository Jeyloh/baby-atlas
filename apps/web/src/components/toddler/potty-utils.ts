import { POTTY_SIGNALS, type PottySignal } from "@baby-atlas/schemas";

export interface PottyLogLike {
  time: Date;
  signals: PottySignal[];
}

export interface SignalSummary {
  signal: PottySignal;
  count: number;
  seen: boolean;
}

export interface ReadinessSummary {
  windowDays: number;
  signals: SignalSummary[];
  seenCount: number;
  totalCount: number;
}

const DAY_MS = 86_400_000;

export function readinessWindowStart(now: Date, windowDays = 14): Date {
  return new Date(now.getTime() - windowDays * DAY_MS);
}

/** Counts how many logs in the last `windowDays` days included each signal. */
export function summarizeReadiness(
  logs: PottyLogLike[],
  now: Date = new Date(),
  windowDays = 14
): ReadinessSummary {
  const start = readinessWindowStart(now, windowDays).getTime();
  const counts = new Map<PottySignal, number>();
  for (const log of logs) {
    const t = log.time.getTime();
    if (t < start || t > now.getTime()) continue;
    for (const signal of new Set(log.signals)) {
      counts.set(signal, (counts.get(signal) ?? 0) + 1);
    }
  }
  const signals = POTTY_SIGNALS.map((signal) => {
    const count = counts.get(signal) ?? 0;
    return { signal, count, seen: count > 0 };
  });
  return {
    windowDays,
    signals,
    seenCount: signals.filter((s) => s.seen).length,
    totalCount: signals.length,
  };
}

export type ReadinessLevel = "none" | "few" | "some" | "many";

export function readinessLevel(seenCount: number): ReadinessLevel {
  if (seenCount === 0) return "none";
  if (seenCount <= 2) return "few";
  if (seenCount <= 4) return "some";
  return "many";
}

/** Whole months between birth and now, ignoring day of month rounding errors. */
export function ageInMonths(birthDate: Date, now: Date = new Date()): number {
  let months =
    (now.getUTCFullYear() - birthDate.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - birthDate.getUTCMonth());
  if (now.getUTCDate() < birthDate.getUTCDate()) months -= 1;
  return Math.max(0, months);
}
