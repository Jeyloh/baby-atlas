import { describe, it, expect } from "vitest";
import { lastOsloDayKeys, osloDayKey } from "./oslo-day";

describe("osloDayKey", () => {
  it("uses the Oslo calendar day, not UTC", () => {
    // 23:30 UTC on 9 Oct is 01:30 on 10 Oct in Oslo (summer time)
    expect(osloDayKey(new Date("2026-10-09T23:30:00Z"))).toBe("2026-10-10");
  });
});

describe("lastOsloDayKeys", () => {
  it("returns consecutive days ending today", () => {
    expect(lastOsloDayKeys(3, new Date("2026-10-10T10:00:00Z"))).toEqual([
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
    ]);
  });

  it("has no duplicate or missing day across the autumn time change", () => {
    // 23:30 Oslo time on 30 Oct 2026, five days after the 25 Oct change
    const keys = lastOsloDayKeys(14, new Date("2026-10-30T22:30:00Z"));
    expect(new Set(keys).size).toBe(14);
    expect(keys).toContain("2026-10-24");
    expect(keys).toContain("2026-10-25");
    expect(keys.at(-1)).toBe("2026-10-30");
  });

  it("has no missing day across the spring time change", () => {
    // 00:30 Oslo time on 31 Mar 2027
    const keys = lastOsloDayKeys(14, new Date("2027-03-30T22:30:00Z"));
    expect(new Set(keys).size).toBe(14);
    expect(keys).toContain("2027-03-28");
    expect(keys.at(-1)).toBe("2027-03-31");
  });
});
