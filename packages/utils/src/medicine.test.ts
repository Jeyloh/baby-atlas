import { describe, it, expect } from "vitest";
import { medicineDoseStatus, medicineDoseCheck, type MedicineDoseRecord } from "./medicine";

const at = (iso: string) => new Date(iso);
const given = (id: string, iso: string): MedicineDoseRecord => ({ id, time: at(iso), skipped: false });

const H = 60 * 60 * 1000;
const NOW = new Date("2026-03-10T12:00:00Z");
const ago = (hours: number) => new Date(NOW.getTime() - hours * H);
const rec = (id: string, hours: number, skipped = false): MedicineDoseRecord => ({
  id,
  time: ago(hours),
  skipped,
});

describe("medicineDoseCheck", () => {
  const settings = { minIntervalHours: 6, maxDosesPer24h: 3 };

  it("needs no confirmation when nothing conflicts", () => {
    const c = medicineDoseCheck([rec("a", 7)], settings, NOW);
    expect(c.needsConfirm).toBe(false);
    expect(c.previousDose?.id).toBe("a");
  });

  it("flags a dose too soon after the previous one, not exactly at the boundary", () => {
    expect(medicineDoseCheck([rec("a", 5.9)], settings, NOW).tooSoonAfterPrevious).toBe(true);
    expect(medicineDoseCheck([rec("a", 6)], settings, NOW).tooSoonAfterPrevious).toBe(false);
  });

  it("flags a back-dated dose that is too close to a later one", () => {
    const c = medicineDoseCheck([given("ten", "2026-03-10T10:00:00Z")], settings, at("2026-03-10T08:00:00Z"));
    expect(c.tooCloseToLater).toBe(true);
    expect(c.laterDose?.id).toBe("ten");
    expect(c.needsConfirm).toBe(true);
  });

  it("allows a back-dated dose exactly one interval before a later one", () => {
    const c = medicineDoseCheck([given("x", "2026-03-10T14:00:00Z")], settings, at("2026-03-10T08:00:00Z"));
    expect(c.tooCloseToLater).toBe(false);
  });

  it("ignores skipped records on both sides", () => {
    const c = medicineDoseCheck([rec("s", 1, true), rec("t", -1, true)], settings, NOW);
    expect(c.needsConfirm).toBe(false);
    expect(c.previousDose).toBeNull();
    expect(c.laterDose).toBeNull();
  });

  it("flags the max when the last 24 h are full", () => {
    const c = medicineDoseCheck([rec("a", 20), rec("b", 14), rec("c", 8)], settings, NOW);
    expect(c.overMax).toBe(true);
    expect(c.maxInWindow).toBe(3);
  });

  it("does not flag the max when old doses have rolled out", () => {
    const c = medicineDoseCheck([rec("a", 25), rec("b", 14), rec("c", 8)], settings, NOW);
    expect(c.overMax).toBe(false);
  });

  it("flags the max in a later window that includes a back-dated dose", () => {
    const logged = [
      given("a", "2026-03-10T02:00:00Z"),
      given("b", "2026-03-10T08:00:00Z"),
      given("c", "2026-03-10T20:00:00Z"),
    ];
    const c = medicineDoseCheck(logged, { maxDosesPer24h: 3 }, at("2026-03-09T21:00:00Z"));
    expect(c.overMax).toBe(true);
  });

  it("treats doses exactly 24 h apart as separate windows", () => {
    const logged = [given("a", "2026-03-09T12:00:00Z"), given("b", "2026-03-09T13:00:00Z")];
    const c = medicineDoseCheck(logged, { maxDosesPer24h: 2 }, at("2026-03-10T12:00:00Z"));
    expect(c.maxInWindow).toBe(1);
    expect(c.overMax).toBe(false);
  });

  it("needs no confirmation without settings", () => {
    expect(medicineDoseCheck([rec("a", 0.1)], {}, NOW).needsConfirm).toBe(false);
  });
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
