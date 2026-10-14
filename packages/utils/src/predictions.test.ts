import { describe, it, expect } from "vitest";
import {
  predictNextFeed,
  predictNextNap,
  predictionPhase,
  recentFeedStarts,
  wakeWindowForAge,
  ownWakeWindows,
  type SleepEvent,
} from "./predictions";

const NOW = new Date("2026-01-15T11:00:00Z"); // 12:00 in Oslo (winter, UTC+1)
const min = (n: number) => n * 60_000;
const ago = (minutes: number) => new Date(NOW.getTime() - min(minutes));

/** Feeds every `step` minutes, the newest `lastAgo` minutes before NOW. */
function feedsEvery(step: number, count: number, lastAgo = 30) {
  return Array.from({ length: count }, (_, i) => ({ startTime: ago(lastAgo + i * step) }));
}

describe("predictNextFeed", () => {
  it("returns null with fewer than four feeds", () => {
    expect(predictNextFeed(feedsEvery(180, 3), NOW)).toBeNull();
    expect(predictNextFeed([], NOW)).toBeNull();
  });

  it("predicts the last feed plus the median interval", () => {
    const result = predictNextFeed(feedsEvery(150, 5, 30), NOW);
    expect(result).not.toBeNull();
    expect(result!.intervalMinutes).toBe(150);
    expect(result!.lastFeedAt).toEqual(ago(30));
    expect(result!.at).toEqual(new Date(ago(30).getTime() + min(150)));
  });

  it("uses the median so one odd interval does not move it", () => {
    const feeds = [
      { startTime: ago(30) },
      { startTime: ago(30 + 120) },
      { startTime: ago(30 + 240) },
      { startTime: ago(30 + 360) },
      { startTime: ago(30 + 360 + 400) },
    ];
    expect(predictNextFeed(feeds, NOW)!.intervalMinutes).toBe(120);
  });

  it("ignores feeds older than 48 hours", () => {
    expect(predictNextFeed(feedsEvery(120, 6, 60 * 49), NOW)).toBeNull();
  });

  it("merges feeds that follow within 20 minutes (side switch, cluster)", () => {
    const starts = recentFeedStarts(
      [{ startTime: ago(10) }, { startTime: ago(25) }, { startTime: ago(200) }],
      NOW
    );
    expect(starts).toHaveLength(2);
    expect(starts[1]).toEqual(ago(25));
  });

  it("leaves out night gaps when enough daytime gaps exist", () => {
    // Oslo times on 14 January: daytime feeds every 150 minutes, then a long night gap
    const at = (h: number, m = 0, d = 14) => new Date(Date.UTC(2026, 0, d, h - 1, m));
    const feeds = [
      { startTime: at(7) },
      { startTime: at(9, 30) },
      { startTime: at(12) },
      { startTime: at(14, 30) },
      { startTime: at(17) },
      { startTime: at(22, 30) }, // 5.5 h gap starts at 17:00 (day); this one starts at 22:30
      { startTime: at(4, 30, 15) }, // night gap of 6 h that starts at night
    ];
    const result = predictNextFeed(feeds, NOW);
    expect(result).not.toBeNull();
    expect(result!.intervalMinutes).toBe(150);
  });

  it("ignores gaps over 8 hours", () => {
    const feeds = [...feedsEvery(120, 4, 30), { startTime: ago(30 + 3 * 120 + 600) }];
    expect(predictNextFeed(feeds, NOW)!.intervalMinutes).toBe(120);
  });
});

describe("wakeWindowForAge", () => {
  it("grows with age", () => {
    expect(wakeWindowForAge(0.5)).toBeLessThan(wakeWindowForAge(2));
    expect(wakeWindowForAge(2)).toBeLessThan(wakeWindowForAge(5));
    expect(wakeWindowForAge(5)).toBeLessThan(wakeWindowForAge(9));
    expect(wakeWindowForAge(9)).toBeLessThan(wakeWindowForAge(20));
  });

  it("is 30-60 minutes for the youngest, as Helsenorge says", () => {
    expect(wakeWindowForAge(0.2)).toBeGreaterThanOrEqual(30);
    expect(wakeWindowForAge(0.2)).toBeLessThanOrEqual(60);
  });
});

const BIRTH_5_MONTHS = new Date("2025-08-15T00:00:00Z");

function sleep(startAgo: number, endAgo: number | null, sleepType: "NAP" | "NIGHT" = "NAP"): SleepEvent {
  return { startTime: ago(startAgo), endTime: endAgo === null ? null : ago(endAgo), sleepType };
}

describe("predictNextNap", () => {
  it("uses the age table when there is no own history", () => {
    const result = predictNextNap({ birthDate: BIRTH_5_MONTHS, now: NOW, sleeps: [sleep(100, 60)] });
    expect(result).not.toBeNull();
    expect(result!.basis).toBe("age");
    expect(result!.wakeWindowMinutes).toBe(120);
    expect(result!.lastWakeAt).toEqual(ago(60));
    expect(result!.at).toEqual(new Date(ago(60).getTime() + min(120)));
  });

  it("blends in the child's own wake windows", () => {
    // Own wake windows of 30 minutes before each nap
    const sleeps = [
      sleep(60 * 20, 60 * 19, "NIGHT"),
      sleep(60 * 18.5, 60 * 18),
      sleep(60 * 17, 60 * 16.5),
      sleep(60 * 15, 60 * 14.5),
      sleep(60 * 13, 60 * 12.5),
      sleep(100, 60),
    ];
    expect(ownWakeWindows(sleeps, NOW).length).toBeGreaterThanOrEqual(3);
    const result = predictNextNap({ birthDate: BIRTH_5_MONTHS, now: NOW, sleeps });
    expect(result!.basis).toBe("blend");
    // Pulled towards the child's own short windows but never below 60 percent of the age figure
    expect(result!.wakeWindowMinutes).toBeLessThan(120);
    expect(result!.wakeWindowMinutes).toBeGreaterThanOrEqual(72);
  });

  it("returns null while a sleep is running", () => {
    expect(
      predictNextNap({ birthDate: BIRTH_5_MONTHS, now: NOW, sleeps: [sleep(100, 60), sleep(20, null)] })
    ).toBeNull();
  });

  it("returns null without any completed sleep", () => {
    expect(predictNextNap({ birthDate: BIRTH_5_MONTHS, now: NOW, sleeps: [] })).toBeNull();
  });

  it("returns null for children of 3 years or older", () => {
    expect(
      predictNextNap({
        birthDate: new Date("2023-01-01T00:00:00Z"),
        now: NOW,
        sleeps: [sleep(100, 60)],
      })
    ).toBeNull();
  });

  it("returns null when the predicted time is bedtime (older than 3 months)", () => {
    const evening = new Date("2026-01-15T17:00:00Z"); // 18:00 Oslo, nap ended 17:55, window lands at 19:55
    const sleeps: SleepEvent[] = [
      {
        startTime: new Date(evening.getTime() - min(100)),
        endTime: new Date(evening.getTime() - min(5)),
        sleepType: "NAP",
      },
    ];
    expect(predictNextNap({ birthDate: BIRTH_5_MONTHS, now: evening, sleeps })).toBeNull();
  });

  it("still predicts at night for a newborn", () => {
    const night = new Date("2026-01-15T23:00:00Z");
    const result = predictNextNap({
      birthDate: new Date("2026-01-05T00:00:00Z"),
      now: night,
      sleeps: [
        {
          startTime: new Date(night.getTime() - min(90)),
          endTime: new Date(night.getTime() - min(30)),
          sleepType: "NAP",
        },
      ],
    });
    expect(result).not.toBeNull();
  });
});

describe("predictionPhase", () => {
  it("covers upcoming, now, late and stale", () => {
    expect(predictionPhase(new Date(NOW.getTime() + min(40)), NOW)).toBe("upcoming");
    expect(predictionPhase(new Date(NOW.getTime() + min(10)), NOW)).toBe("now");
    expect(predictionPhase(NOW, NOW)).toBe("now");
    expect(predictionPhase(ago(10), NOW)).toBe("now");
    expect(predictionPhase(ago(40), NOW)).toBe("late");
    expect(predictionPhase(ago(120), NOW)).toBe("stale");
  });
});
