import { describe, it, expect } from "vitest";
import { mergeSupportData, type RecentActivity } from "./support-data";
import type { LastActivities } from "@/lib/offline/pending";

const t = (iso: string) => new Date(iso);

function recent(overrides: Partial<RecentActivity> = {}): RecentActivity {
  return { feeds: [], sleeps: [], diapers: [], temperatures: [], ...overrides };
}

function last(overrides: Partial<LastActivities> = {}): LastActivities {
  return {
    lastSleep: null,
    activeSleep: null,
    lastBreastfeeding: null,
    activeFeeding: null,
    lastBottle: null,
    lastSolids: null,
    lastDiaper: null,
    lastPumping: null,
    activePumping: null,
    lastMedicine: null,
    lastGrowth: null,
    lastTemperature: null,
    lastActivity: null,
    ...overrides,
  } as LastActivities;
}

describe("mergeSupportData", () => {
  it("maps temperatures and diapers from the recent data", () => {
    const data = mergeSupportData(
      recent({
        temperatures: [{ id: "t1", time: t("2026-01-15T10:00:00Z"), temperatureCelsius: 38.2 }],
        diapers: [{ id: "d1", time: t("2026-01-15T09:00:00Z"), diaperType: "WET" }],
      }),
      undefined
    );
    expect(data.temperatures).toEqual([{ id: "t1", time: t("2026-01-15T10:00:00Z"), celsius: 38.2 }]);
    expect(data.diapers).toEqual([{ time: t("2026-01-15T09:00:00Z"), diaperType: "WET" }]);
  });

  it("adds the home data's latest records without duplicating", () => {
    const sleep = {
      id: "s1",
      sleepType: "NAP" as const,
      startTime: t("2026-01-15T08:00:00Z"),
      endTime: t("2026-01-15T09:00:00Z"),
    };
    const data = mergeSupportData(
      recent({ sleeps: [sleep] }),
      last({ lastSleep: { ...sleep, childId: "c" } as never })
    );
    expect(data.sleeps).toHaveLength(1);
  });

  it("uses a sleep ended offline instead of the running one from the server", () => {
    const running = { id: "s1", sleepType: "NAP" as const, startTime: t("2026-01-15T08:00:00Z"), endTime: null };
    const data = mergeSupportData(
      recent({ sleeps: [running] }),
      last({ lastSleep: { ...running, endTime: t("2026-01-15T09:00:00Z") } as never, activeSleep: null })
    );
    expect(data.sleepActive).toBe(false);
    expect(data.sleeps[0]!.endTime).toEqual(t("2026-01-15T09:00:00Z"));
  });

  it("drops a running sleep the home data no longer shows (deleted offline)", () => {
    const running = { id: "s1", sleepType: "NAP" as const, startTime: t("2026-01-15T08:00:00Z"), endTime: null };
    const data = mergeSupportData(recent({ sleeps: [running] }), last());
    expect(data.sleeps).toEqual([]);
    expect(data.sleepActive).toBe(false);
  });

  it("knows a sleep is running from the home data", () => {
    const running = {
      id: "s2",
      sleepType: "NAP" as const,
      startTime: t("2026-01-15T10:00:00Z"),
      endTime: null,
      childId: "c",
    };
    const data = mergeSupportData(recent(), last({ activeSleep: running as never }));
    expect(data.sleepActive).toBe(true);
  });

  it("reports breastfeeding as running only from the home data", () => {
    const active = {
      id: "f1",
      feedingType: "BREAST" as const,
      startTime: t("2026-01-15T10:00:00Z"),
      endTime: null,
    };
    expect(mergeSupportData(recent({ feeds: [active] }), last()).feedingActive).toBe(false);
    expect(mergeSupportData(recent({ feeds: [active] }), last({ activeFeeding: active as never })).feedingActive).toBe(true);
    expect(mergeSupportData(recent({ feeds: [active] }), undefined).feedingActive).toBe(true);
  });

  it("keeps a bottle feed without an end time", () => {
    const bottle = {
      id: "b1",
      feedingType: "BOTTLE" as const,
      startTime: t("2026-01-15T10:00:00Z"),
      endTime: null,
    };
    const data = mergeSupportData(recent({ feeds: [bottle] }), last());
    expect(data.feeds).toHaveLength(1);
    expect(data.feedingActive).toBe(false);
  });
});
