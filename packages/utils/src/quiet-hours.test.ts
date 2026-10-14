import { describe, it, expect } from "vitest";
import {
  formatMinutesOfDay,
  isInQuietHours,
  osloMinutesOfDay,
  parseMinutesOfDay,
} from "./quiet-hours";

describe("osloMinutesOfDay", () => {
  it("uses summer time (UTC+2)", () => {
    expect(osloMinutesOfDay(new Date("2026-07-01T10:30:00Z"))).toBe(12 * 60 + 30);
  });

  it("uses winter time (UTC+1)", () => {
    expect(osloMinutesOfDay(new Date("2026-01-15T10:30:00Z"))).toBe(11 * 60 + 30);
  });

  it("wraps past midnight and returns 0 at midnight", () => {
    expect(osloMinutesOfDay(new Date("2026-07-01T22:00:00Z"))).toBe(0);
    expect(osloMinutesOfDay(new Date("2026-07-01T21:59:00Z"))).toBe(23 * 60 + 59);
  });
});

describe("isInQuietHours", () => {
  const start = 22 * 60;
  const end = 7 * 60;
  // Winter time: Oslo is UTC+1
  const at = (hhmmUtc: string) => new Date(`2026-01-15T${hhmmUtc}:00Z`);

  it("covers a range over midnight", () => {
    expect(isInQuietHours(at("21:00"), start, end)).toBe(true); // 22:00 Oslo
    expect(isInQuietHours(at("23:30"), start, end)).toBe(true); // 00:30 Oslo
    expect(isInQuietHours(at("05:59"), start, end)).toBe(true); // 06:59 Oslo
  });

  it("includes the start and excludes the end", () => {
    expect(isInQuietHours(at("20:59"), start, end)).toBe(false); // 21:59 Oslo
    expect(isInQuietHours(at("06:00"), start, end)).toBe(false); // 07:00 Oslo
  });

  it("is awake during the day", () => {
    expect(isInQuietHours(at("11:00"), start, end)).toBe(false);
  });

  it("covers a range inside one day", () => {
    expect(isInQuietHours(at("12:30"), 13 * 60, 15 * 60)).toBe(true); // 13:30 Oslo
    expect(isInQuietHours(at("15:00"), 13 * 60, 15 * 60)).toBe(false); // 16:00 Oslo
  });

  it("means no quiet hours when off or empty", () => {
    expect(isInQuietHours(at("23:30"), null, null)).toBe(false);
    expect(isInQuietHours(at("23:30"), start, null)).toBe(false);
    expect(isInQuietHours(at("23:30"), 600, 600)).toBe(false);
  });

  it("follows Oslo time across the summer time change", () => {
    // 22 Oct 2026 21:30 UTC is 23:30 in Oslo (summer time), 25 Oct is winter time
    expect(isInQuietHours(new Date("2026-10-22T21:30:00Z"), start, end)).toBe(true);
    expect(isInQuietHours(new Date("2026-10-22T20:30:00Z"), start, end)).toBe(true); // 22:30
    expect(isInQuietHours(new Date("2026-10-22T19:30:00Z"), start, end)).toBe(false); // 21:30
    expect(isInQuietHours(new Date("2026-10-26T20:30:00Z"), start, end)).toBe(false); // 21:30 winter
    expect(isInQuietHours(new Date("2026-10-26T21:30:00Z"), start, end)).toBe(true); // 22:30 winter
  });
});

describe("minutes of day text", () => {
  it("formats and parses 24-hour times", () => {
    expect(formatMinutesOfDay(1320)).toBe("22:00");
    expect(formatMinutesOfDay(7 * 60 + 5)).toBe("07:05");
    expect(parseMinutesOfDay("22:00")).toBe(1320);
    expect(parseMinutesOfDay("00:00")).toBe(0);
  });

  it("rejects invalid times", () => {
    expect(parseMinutesOfDay("24:00")).toBeNull();
    expect(parseMinutesOfDay("7:00")).toBeNull();
    expect(parseMinutesOfDay("")).toBeNull();
    expect(parseMinutesOfDay("12:60")).toBeNull();
  });
});
