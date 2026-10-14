import { describe, it, expect } from "vitest";
import { medicineDoseStatus, type MedicineDoseRecord } from "./medicine";

const H = 60 * 60 * 1000;
const NOW = new Date("2026-03-10T12:00:00Z");
const ago = (hours: number) => new Date(NOW.getTime() - hours * H);
const rec = (id: string, hours: number, skipped = false): MedicineDoseRecord => ({
  id,
  time: ago(hours),
  skipped,
});

describe("medicineDoseStatus", () => {
  it("is empty without records", () => {
    const s = medicineDoseStatus([], { minIntervalHours: 6, maxDosesPer24h: 4 }, NOW);
    expect(s).toEqual({
      lastDose: null,
      dosesLast24h: 0,
      nextByInterval: null,
      nextByMax: null,
      nextAllowedAt: null,
      tooSoon: false,
      maxReached: false,
    });
  });

  it("finds the last dose regardless of order", () => {
    const s = medicineDoseStatus([rec("a", 10), rec("c", 2), rec("b", 5)], {}, NOW);
    expect(s.lastDose?.id).toBe("c");
    expect(s.dosesLast24h).toBe(3);
    expect(s.nextAllowedAt).toBeNull();
    expect(s.tooSoon).toBe(false);
  });

  it("ignores skipped records for last dose, count and interval", () => {
    const s = medicineDoseStatus(
      [rec("given", 8), rec("skip", 1, true)],
      { minIntervalHours: 6, maxDosesPer24h: 1 },
      NOW
    );
    expect(s.lastDose?.id).toBe("given");
    expect(s.dosesLast24h).toBe(1);
    expect(s.tooSoon).toBe(false);
    expect(s.maxReached).toBe(true);
  });

  it("flags too soon before the interval has passed", () => {
    const s = medicineDoseStatus([rec("a", 2)], { minIntervalHours: 6 }, NOW);
    expect(s.tooSoon).toBe(true);
    expect(s.nextByInterval).toEqual(ago(-4));
    expect(s.nextAllowedAt).toEqual(ago(-4));
  });

  it("is not too soon exactly at the interval boundary", () => {
    expect(medicineDoseStatus([rec("a", 6)], { minIntervalHours: 6 }, NOW).tooSoon).toBe(false);
    const justBefore = new Date(NOW.getTime() - 1);
    expect(medicineDoseStatus([rec("a", 6)], { minIntervalHours: 6 }, justBefore).tooSoon).toBe(true);
  });

  it("supports fractional intervals", () => {
    const s = medicineDoseStatus([rec("a", 0.25)], { minIntervalHours: 0.5 }, NOW);
    expect(s.tooSoon).toBe(true);
    expect(s.nextByInterval).toEqual(new Date(NOW.getTime() + 0.25 * H));
  });

  it("counts a dose just inside the 24 h window and not one exactly at 24 h", () => {
    expect(medicineDoseStatus([rec("a", 23.99)], {}, NOW).dosesLast24h).toBe(1);
    const boundary = medicineDoseStatus([rec("a", 24)], {}, NOW);
    expect(boundary.dosesLast24h).toBe(0);
    expect(boundary.lastDose?.id).toBe("a");
  });

  it("reports max reached and when the oldest dose rolls out", () => {
    const s = medicineDoseStatus(
      [rec("d1", 20), rec("d2", 14), rec("d3", 8), rec("d4", 2)],
      { maxDosesPer24h: 4 },
      NOW
    );
    expect(s.dosesLast24h).toBe(4);
    expect(s.maxReached).toBe(true);
    expect(s.nextByMax).toEqual(ago(-4)); // d1 + 24 h
    expect(s.nextAllowedAt).toEqual(ago(-4));
  });

  it("is not at the max one dose below the limit", () => {
    const s = medicineDoseStatus([rec("d1", 20), rec("d2", 2)], { maxDosesPer24h: 3 }, NOW);
    expect(s.maxReached).toBe(false);
    expect(s.nextByMax).toBeNull();
  });

  it("when over the max, waits until enough doses have rolled out", () => {
    const s = medicineDoseStatus(
      [rec("d1", 22), rec("d2", 18), rec("d3", 4)],
      { maxDosesPer24h: 1 },
      NOW
    );
    expect(s.maxReached).toBe(true);
    expect(s.nextByMax).toEqual(ago(-20)); // d3 + 24 h: only then are fewer than 1 left
  });

  it("takes the later of the interval and the max constraint", () => {
    const s = medicineDoseStatus(
      [rec("d1", 23), rec("d2", 1)],
      { minIntervalHours: 8, maxDosesPer24h: 2 },
      NOW
    );
    expect(s.nextByInterval).toEqual(ago(-7));
    expect(s.nextByMax).toEqual(ago(-1));
    expect(s.nextAllowedAt).toEqual(ago(-7));
  });

  it("ignores doses dated after the moment asked about", () => {
    const s = medicineDoseStatus([rec("future", -2), rec("past", 3)], { minIntervalHours: 4 }, NOW);
    expect(s.lastDose?.id).toBe("past");
    expect(s.dosesLast24h).toBe(1);
  });

  it("evaluates a dose at a chosen time", () => {
    const later = new Date(NOW.getTime() + 2 * H);
    expect(medicineDoseStatus([rec("a", 3)], { minIntervalHours: 4 }, later).tooSoon).toBe(false);
  });

  it("treats null settings as not set", () => {
    const s = medicineDoseStatus([rec("a", 1)], { minIntervalHours: null, maxDosesPer24h: null }, NOW);
    expect(s.tooSoon).toBe(false);
    expect(s.maxReached).toBe(false);
    expect(s.nextAllowedAt).toBeNull();
  });
});
