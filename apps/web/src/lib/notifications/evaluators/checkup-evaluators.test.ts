import { describe, it, expect, vi } from "vitest";
import type { PrismaClient } from "@baby-atlas/db";
import { checkupCandidates, evaluate as evaluateCheckups } from "./checkup-reminder";
import { vaccineCandidates, evaluate as evaluateVaccines } from "./vaccine-reminder";
import { translatePush } from "../translate";

const birthDate = new Date("2026-01-01T00:00:00Z");
const base = { id: "child1", name: "Mia", birthDate };
const row = (over: Partial<Parameters<typeof checkupCandidates>[0]> = {}) => ({
  ...base,
  checkupRecords: [],
  vaccinationRecords: [],
  ...over,
});
const atAge = (days: number, hour = 12) =>
  new Date(birthDate.getTime() + days * 86_400_000 + hour * 3_600_000);

describe("checkup evaluator", () => {
  it("asks to book once an age window is open and nothing is booked", () => {
    const out = checkupCandidates(row(), atAge(90));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      kind: "CHECKUP_REMINDER",
      dedupeKey: "checkup:book:child1:month_3",
      bodyKey: "push.checkupReminder.book.body",
      url: "/dashboard/child1/vaccines?tab=checkups",
    });
  });

  it("is silent between windows, after booking and after it is done", () => {
    expect(checkupCandidates(row(), atAge(70))).toEqual([]);
    const booked = row({
      checkupRecords: [{ checkupKey: "month_3", scheduledAt: atAge(100), completedAt: null }],
    });
    expect(checkupCandidates(booked, atAge(90))).toEqual([]);
    const done = row({
      checkupRecords: [{ checkupKey: "month_3", scheduledAt: null, completedAt: atAge(88) }],
    });
    expect(checkupCandidates(done, atAge(90))).toEqual([]);
  });

  it("reminds the evening before a booked time, with a key per booked time", () => {
    const scheduledAt = new Date("2026-04-10T07:30:00Z"); // 09:30 Oslo
    const child = row({
      checkupRecords: [{ checkupKey: "month_3", scheduledAt, completedAt: null }],
    });
    expect(checkupCandidates(child, new Date("2026-04-09T14:00:00Z"))).toEqual([]); // 16:00
    const out = checkupCandidates(child, new Date("2026-04-09T15:30:00Z")); // 17:30
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      params: { child: "Mia", time: "09:30" },
      dedupeKey: `checkup:booked:child1:month_3:${scheduledAt.getTime()}`,
    });
  });

  it("has push texts in both languages", () => {
    for (const locale of ["nb", "en"] as const) {
      expect(translatePush(locale, "push.checkupReminder.booked.body", { child: "Mia", time: "09:30" })).toContain("09:30");
      expect(translatePush(locale, "push.checkupReminder.book.body", { child: "Mia" })).toContain("Mia");
    }
  });

  it("queries only children in households with push subscriptions", async () => {
    const findMany = vi.fn().mockResolvedValue([row()]);
    const prisma = { child: { findMany } } as unknown as PrismaClient;
    const out = await evaluateCheckups({ prisma, now: atAge(90) });
    expect(out).toHaveLength(1);
    expect(findMany.mock.calls[0]![0].where.household.members.some.user.pushSubscriptions).toEqual({ some: {} });
  });
});

describe("vaccine evaluator", () => {
  const now = new Date("2026-04-02T12:00:00Z"); // 3 months and a day old

  it("reminds once per unrecorded dose that is due", () => {
    const out = vaccineCandidates(
      row({ vaccinationRecords: [{ vaccineKey: "rotavirus-1" }, { vaccineKey: "six-in-one-1" }] }),
      now
    );
    expect(out.map((c) => c.dedupeKey)).toEqual(["vaccine:child1:rotavirus-2", "vaccine:child1:pneumococcal-1"]);
    expect(out[0]).toMatchObject({ kind: "VACCINE_REMINDER", bodyKey: "push.vaccineReminder.body.rotavirus" });
    expect(out[0]!.replaceKey).toBe(out[1]!.replaceKey);
  });

  it("is silent when a checkup covering the dose is booked ahead", () => {
    const out = vaccineCandidates(
      row({
        vaccinationRecords: [{ vaccineKey: "rotavirus-1" }],
        checkupRecords: [
          { checkupKey: "month_3", scheduledAt: new Date("2026-04-20T08:00:00Z"), completedAt: null },
        ],
      }),
      now
    );
    expect(out).toEqual([]);
  });

  it("still reminds when the booked time has already passed", () => {
    const out = vaccineCandidates(
      row({
        vaccinationRecords: [{ vaccineKey: "rotavirus-1" }],
        checkupRecords: [
          { checkupKey: "month_3", scheduledAt: new Date("2026-04-01T08:00:00Z"), completedAt: null },
        ],
      }),
      now
    );
    expect(out).toHaveLength(3);
  });

  it("has a text for every vaccine in both languages", () => {
    for (const locale of ["nb", "en"] as const) {
      for (const v of ["rotavirus", "sixInOne", "pneumococcal", "mmr"]) {
        const text = translatePush(locale, `push.vaccineReminder.body.${v}`, { child: "Mia" });
        expect(text).toContain("Mia");
        expect(text).not.toContain("notifications.");
      }
    }
  });

  it("evaluates through prisma", async () => {
    const findMany = vi.fn().mockResolvedValue([row({ vaccinationRecords: [{ vaccineKey: "rotavirus-1" }] })]);
    const prisma = { child: { findMany } } as unknown as PrismaClient;
    expect(await evaluateVaccines({ prisma, now })).toHaveLength(3);
  });
});
