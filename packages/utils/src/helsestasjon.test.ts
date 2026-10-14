import { describe, it, expect } from "vitest";
import {
  HELSESTASJON_PROGRAMME,
  buildCheckupViews,
  checkupStatus,
  checkupsForVaccine,
  childAgeInDays,
  formatOsloTime,
  getCheckup,
  isBookedReminderDue,
  isSameDayReminderDue,
  isKnownCheckupKey,
  isTimeToBook,
  nextCheckup,
  osloLocalToInstant,
  upcomingCheckups,
  vaccinesToRemind,
} from "./helsestasjon";
import { NORWEGIAN_VACCINE_PROGRAMME } from "./vaccination";

const birth = new Date("2026-01-01T00:00:00Z");
const atAge = (days: number, hour = 12) =>
  new Date(birth.getTime() + days * 86_400_000 + hour * 3_600_000);

describe("programme", () => {
  it("has unique keys, sorted by age, with sane windows", () => {
    const keys = HELSESTASJON_PROGRAMME.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const [i, c] of HELSESTASJON_PROGRAMME.entries()) {
      expect(c.windowStartDays).toBeLessThanOrEqual(c.ageDays);
      expect(c.windowEndDays).toBeGreaterThanOrEqual(c.ageDays);
      if (i > 0) {
        expect(c.ageDays).toBeGreaterThan(HELSESTASJON_PROGRAMME[i - 1]!.ageDays);
        expect(c.windowStartDays).toBeGreaterThan(HELSESTASJON_PROGRAMME[i - 1]!.windowEndDays);
      }
    }
    expect(isKnownCheckupKey("year_4")).toBe(false);
    expect(isKnownCheckupKey("year_2")).toBe(true);
  });

  it("links only to doses in the vaccine programme, each dose exactly once", () => {
    const known = new Set(NORWEGIAN_VACCINE_PROGRAMME.map((d) => d.key));
    const linked = HELSESTASJON_PROGRAMME.flatMap((c) => c.vaccineKeys);
    for (const key of linked) expect(known.has(key)).toBe(true);
    expect([...linked].sort()).toEqual([...known].sort());
    expect(checkupsForVaccine("mmr-1").map((c) => c.key)).toEqual(["month_15"]);
  });
});

describe("status by age", () => {
  const month3 = getCheckup("month_3")!;

  it("is upcoming before, due in and overdue after the window", () => {
    expect(checkupStatus(month3, birth, null, atAge(83))).toBe("upcoming");
    expect(checkupStatus(month3, birth, null, atAge(84))).toBe("due");
    expect(checkupStatus(month3, birth, null, atAge(105))).toBe("due");
    expect(checkupStatus(month3, birth, null, atAge(106))).toBe("overdue");
  });

  it("is done when completed, whatever the age", () => {
    const record = { completedAt: new Date("2026-04-02T00:00:00Z") };
    expect(checkupStatus(month3, birth, record, atAge(300))).toBe("done");
  });

  it("counts age in Oslo days", () => {
    // 23:30 UTC on day 10 is already day 11 in Oslo
    expect(childAgeInDays(birth, new Date("2026-01-11T23:30:00Z"))).toBe(11);
    expect(childAgeInDays(birth, new Date("2026-01-11T12:00:00Z"))).toBe(10);
  });
});

describe("upcoming and next", () => {
  it("returns open and coming visits, skipping done and overdue ones", () => {
    const views = buildCheckupViews(
      birth,
      [{ checkupKey: "week_6", scheduledAt: null, completedAt: new Date("2026-02-12T00:00:00Z") }],
      atAge(60)
    );
    const upcoming = upcomingCheckups(views).map((v) => v.contact.key);
    expect(upcoming[0]).toBe("month_3");
    expect(upcoming).not.toContain("week_6");
    expect(upcoming).not.toContain("home_visit");
    expect(nextCheckup(views)?.contact.key).toBe("month_3");
  });

  it("prefers an open window over later visits", () => {
    const views = buildCheckupViews(birth, [], atAge(90));
    expect(nextCheckup(views)?.contact.key).toBe("month_3");
    expect(nextCheckup(views)?.status).toBe("due");
  });

  it("is null after the programme", () => {
    expect(nextCheckup(buildCheckupViews(birth, [], atAge(1000)))).toBeNull();
  });

  it("marks a future booking as booked but not a past one", () => {
    const now = atAge(90);
    const views = buildCheckupViews(
      birth,
      [
        { checkupKey: "month_3", scheduledAt: new Date(now.getTime() + 86_400_000), completedAt: null },
        { checkupKey: "week_6", scheduledAt: new Date(now.getTime() - 86_400_000), completedAt: null },
      ],
      now
    );
    expect(views.find((v) => v.contact.key === "month_3")?.booked).toBe(true);
    expect(views.find((v) => v.contact.key === "week_6")?.booked).toBe(false);
  });
});

describe("osloLocalToInstant", () => {
  it("converts winter and summer time", () => {
    expect(osloLocalToInstant("2026-01-15", "09:30").toISOString()).toBe("2026-01-15T08:30:00.000Z");
    expect(osloLocalToInstant("2026-07-15", "09:30").toISOString()).toBe("2026-07-15T07:30:00.000Z");
  });

  it("round-trips across the autumn change", () => {
    const d = osloLocalToInstant("2026-10-26", "08:00");
    expect(formatOsloTime(d)).toBe("08:00");
    expect(d.toISOString()).toBe("2026-10-26T07:00:00.000Z");
  });
});

describe("isBookedReminderDue", () => {
  const appointment = new Date("2026-10-15T07:30:00Z"); // 09:30 Oslo

  it("is due from 17:00 Oslo the day before", () => {
    expect(isBookedReminderDue(appointment, new Date("2026-10-14T14:59:00Z"))).toBe(false); // 16:59
    expect(isBookedReminderDue(appointment, new Date("2026-10-14T15:00:00Z"))).toBe(true); // 17:00
    expect(isBookedReminderDue(appointment, new Date("2026-10-14T21:00:00Z"))).toBe(true);
  });

  it("is not due two days before or on the day itself", () => {
    expect(isBookedReminderDue(appointment, new Date("2026-10-13T18:00:00Z"))).toBe(false);
    expect(isBookedReminderDue(appointment, new Date("2026-10-15T05:00:00Z"))).toBe(false);
  });

  it("uses the Oslo calendar day for late appointments", () => {
    const late = new Date("2026-10-15T22:30:00Z"); // 00:30 on the 16th in Oslo
    expect(isBookedReminderDue(late, new Date("2026-10-15T16:00:00Z"))).toBe(true);
    expect(isBookedReminderDue(late, new Date("2026-10-14T16:00:00Z"))).toBe(false);
  });
});

describe("isSameDayReminderDue", () => {
  const appointment = new Date("2026-10-15T07:30:00Z"); // 09:30 Oslo

  it("is due on the day, at least 60 minutes ahead", () => {
    expect(isSameDayReminderDue(appointment, new Date("2026-10-15T05:00:00Z"))).toBe(true);
    expect(isSameDayReminderDue(appointment, new Date("2026-10-15T06:30:00Z"))).toBe(true);
    expect(isSameDayReminderDue(appointment, new Date("2026-10-15T06:31:00Z"))).toBe(false);
    expect(isSameDayReminderDue(appointment, new Date("2026-10-14T20:00:00Z"))).toBe(false);
  });
});

describe("isTimeToBook", () => {
  const month3 = getCheckup("month_3")!;

  it("is true in an open window with nothing booked or done", () => {
    expect(isTimeToBook(month3, birth, null, atAge(90))).toBe(true);
  });

  it("is false when booked, done, before or after the window", () => {
    expect(isTimeToBook(month3, birth, { scheduledAt: atAge(95), completedAt: null }, atAge(90))).toBe(false);
    expect(isTimeToBook(month3, birth, { scheduledAt: null, completedAt: atAge(88) }, atAge(90))).toBe(false);
    expect(isTimeToBook(month3, birth, null, atAge(70))).toBe(false);
    expect(isTimeToBook(month3, birth, null, atAge(120))).toBe(false);
  });

  it("only asks in the first 14 days of the window", () => {
    expect(isTimeToBook(month3, birth, null, atAge(84 + 14))).toBe(true);
    expect(isTimeToBook(month3, birth, null, atAge(84 + 15))).toBe(false);
  });

  it("never asks to book the home visit", () => {
    expect(isTimeToBook(getCheckup("home_visit")!, birth, null, atAge(9))).toBe(false);
  });
});

describe("vaccinesToRemind", () => {
  const none = new Set<string>();

  it("reminds about doses that reached their due age and are not recorded", () => {
    // 3 months after 2026-01-01 is 2026-04-01
    const now = new Date("2026-04-02T12:00:00Z");
    const keys = vaccinesToRemind(birth, new Set(["rotavirus-1"]), none, now).map((d) => d.key);
    expect(keys).toEqual(["rotavirus-2", "six-in-one-1", "pneumococcal-1"]);
  });

  it("skips recorded doses, doses not yet due and old ones", () => {
    const now = new Date("2026-04-02T12:00:00Z");
    const given = new Set(["rotavirus-1", "rotavirus-2", "six-in-one-1"]);
    expect(vaccinesToRemind(birth, given, none, now).map((d) => d.key)).toEqual(["pneumococcal-1"]);
    expect(vaccinesToRemind(birth, none, none, new Date("2026-01-10T12:00:00Z"))).toEqual([]);
    expect(vaccinesToRemind(birth, none, none, new Date("2026-10-01T12:00:00Z"))).toEqual([]);
    // 45 days after the 3 month dose date (2026-04-01)
    const rotaGiven = new Set(["rotavirus-1", "rotavirus-2"]);
    expect(vaccinesToRemind(birth, rotaGiven, none, new Date("2026-05-16T12:00:00Z"))).toHaveLength(2);
    expect(vaccinesToRemind(birth, rotaGiven, none, new Date("2026-05-17T12:00:00Z"))).toEqual([]);
  });

  it("stops reminding about rotavirus past its age limit", () => {
    // Born 2026-01-01: dose 2 limit is 112 days (2026-04-23), dose 1 limit 84 days
    const keysAt = (d: string) =>
      vaccinesToRemind(birth, none, none, new Date(d)).map((x) => x.key);
    expect(keysAt("2026-04-20T12:00:00Z")).toContain("rotavirus-2");
    expect(keysAt("2026-04-25T12:00:00Z")).not.toContain("rotavirus-2");
    expect(keysAt("2026-04-25T12:00:00Z")).toContain("six-in-one-1");
    expect(keysAt("2026-04-02T12:00:00Z")).not.toContain("rotavirus-1");
  });

  it("skips doses covered by a checkup booked in the future", () => {
    const now = new Date("2026-04-02T12:00:00Z");
    const keys = vaccinesToRemind(birth, new Set(["rotavirus-1"]), new Set(["month_3"]), now);
    expect(keys).toEqual([]);
  });
});
