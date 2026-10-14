import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@baby-atlas/api";
import type { DiaperEvent, SleepEvent, TemperatureReading } from "@baby-atlas/utils";
import type { LastActivities } from "@/lib/offline/pending";

export type RecentActivity = inferRouterOutputs<AppRouter>["timeline"]["getRecentActivity"];

export interface SupportFeed {
  id: string;
  startTime: Date;
  endTime: Date | null;
}

export interface SupportSleep extends SleepEvent {
  id: string;
}

/** The records the "what's next" and health hint cards work from. */
export interface SupportData {
  feeds: SupportFeed[];
  sleeps: SupportSleep[];
  diapers: DiaperEvent[];
  temperatures: TemperatureReading[];
  /** Breastfeeding is running right now */
  feedingActive: boolean;
  /** A sleep is running right now */
  sleepActive: boolean;
}

function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

/**
 * Combines the last few days of records with the home screen's latest
 * activities. The latter include taps not yet synced (the offline outbox), so
 * a sleep just ended or a feed just logged counts straight away, and a timer
 * that was stopped or deleted offline no longer counts as running.
 */
export function mergeSupportData(recent: RecentActivity, last: LastActivities | undefined): SupportData {
  const feeds = byId<SupportFeed>(recent.feeds);
  const sleeps = byId<SupportSleep>(recent.sleeps);
  const diapers = new Map<string, DiaperEvent>(
    recent.diapers.map((d) => [d.id, { time: d.time, diaperType: d.diaperType }])
  );
  const temperatures = new Map<string, TemperatureReading>(
    recent.temperatures.map((t) => [t.id, { id: t.id, time: t.time, celsius: t.temperatureCelsius }])
  );

  if (last) {
    // Without the latest word from the home data, a running timer in the recent list may be stale
    for (const [id, sleep] of sleeps) {
      if (sleep.endTime === null && last.activeSleep?.id !== id) sleeps.delete(id);
    }
    for (const feed of recent.feeds) {
      if (feed.feedingType === "BREAST" && feed.endTime === null && last.activeFeeding?.id !== feed.id) {
        feeds.delete(feed.id);
      }
    }

    for (const sleep of [last.lastSleep, last.activeSleep]) {
      if (sleep) sleeps.set(sleep.id, sleep);
    }
    for (const feed of [last.lastBreastfeeding, last.activeFeeding, last.lastBottle]) {
      if (feed) feeds.set(feed.id, feed);
    }
    if (last.lastDiaper) {
      diapers.set(last.lastDiaper.id, { time: last.lastDiaper.time, diaperType: last.lastDiaper.diaperType });
    }
    if (last.lastTemperature) {
      temperatures.set(last.lastTemperature.id, {
        id: last.lastTemperature.id,
        time: last.lastTemperature.time,
        celsius: last.lastTemperature.temperatureCelsius,
      });
    }
  }

  const sleepList = [...sleeps.values()];
  const feedList = [...feeds.values()];
  return {
    feeds: feedList,
    sleeps: sleepList,
    diapers: [...diapers.values()],
    temperatures: [...temperatures.values()],
    feedingActive: last
      ? !!last.activeFeeding
      : recent.feeds.some((f) => f.feedingType === "BREAST" && f.endTime === null),
    sleepActive: sleepList.some((s) => s.endTime === null),
  };
}
