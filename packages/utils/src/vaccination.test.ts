import { describe, it, expect } from "vitest";
import {
  NORWEGIAN_VACCINE_PROGRAMME,
  isKnownVaccineKey,
  vaccineDueDate,
  vaccineStatus,
} from "./vaccination";

// Date-only values arrive from Prisma as UTC midnight
const birth = new Date(Date.UTC(2026, 0, 15));
const dose = (key: string) => NORWEGIAN_VACCINE_PROGRAMME.find((d) => d.key === key)!;

describe("vaccination programme", () => {
  it("has unique keys", () => {
    const keys = NORWEGIAN_VACCINE_PROGRAMME.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("recognises known keys only", () => {
    expect(isKnownVaccineKey("mmr-1")).toBe(true);
    expect(isKnownVaccineKey("mmr-9")).toBe(false);
  });

  const iso = (date: Date) => date.toISOString().slice(0, 10);

  it("computes week and month based due dates", () => {
    expect(iso(vaccineDueDate(birth, dose("rotavirus-1")))).toBe("2026-02-26");
    expect(iso(vaccineDueDate(birth, dose("mmr-1")))).toBe("2027-04-15");
  });

  it("keeps the calendar day across a daylight saving change", () => {
    // 15 Jan + 5 months used to come out as 14 June in Oslo
    expect(iso(vaccineDueDate(birth, dose("six-in-one-2")))).toBe("2026-06-15");
  });

  it("clamps to the end of shorter months", () => {
    const endOfMonth = new Date(Date.UTC(2026, 0, 31));
    // 31 Jan + 3 months = 30 April
    expect(iso(vaccineDueDate(endOfMonth, dose("six-in-one-1")))).toBe("2026-04-30");
  });
});

describe("vaccineStatus", () => {
  const due = new Date("2026-06-01T00:00:00Z");

  it("is given when a date is recorded", () => {
    expect(vaccineStatus(due, new Date(), new Date("2027-01-01"))).toBe("given");
  });

  it("is upcoming more than 14 days ahead", () => {
    expect(vaccineStatus(due, null, new Date("2026-05-01"))).toBe("upcoming");
  });

  it("is due from 14 days before until 30 days after", () => {
    expect(vaccineStatus(due, null, new Date("2026-05-20"))).toBe("due");
    expect(vaccineStatus(due, null, new Date("2026-06-25"))).toBe("due");
  });

  it("is overdue more than 30 days after", () => {
    expect(vaccineStatus(due, null, new Date("2026-07-15"))).toBe("overdue");
  });
});
