import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@baby-atlas/db";
import { evaluate } from "./weekly-tip";
import { translatePush } from "../translate";
import nb from "../../../../messages/nb";
import en from "../../../../messages/en";

function prismaWith(children: { id: string; birthDate: Date }[]) {
  const findMany = vi.fn().mockResolvedValue(children);
  return { prisma: { child: { findMany } } as unknown as PrismaClient, findMany };
}

const BIRTH = new Date("2026-01-10T00:00:00.000Z");
// Week 1 starts 2026-01-17 (Oslo, UTC+1)
const AT_1000 = new Date("2026-01-17T09:00:00Z");

describe("WEEKLY_TIP evaluator", () => {
  it("makes one candidate on the day a new week starts, from 10:00 Oslo", async () => {
    const { prisma } = prismaWith([{ id: "c1", birthDate: BIRTH }]);
    const result = await evaluate({ prisma, now: AT_1000 });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: "WEEKLY_TIP",
      childId: "c1",
      dedupeKey: "tip:c1:week.1",
      url: "/dashboard/c1",
      titleKey: "push.weeklyTip.title",
    });
  });

  it("waits until 10:00 Oslo and does not query before", async () => {
    const { prisma, findMany } = prismaWith([{ id: "c1", birthDate: BIRTH }]);
    expect(await evaluate({ prisma, now: new Date("2026-01-17T08:59:00Z") })).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("keeps the same dedupe key on later days, up to 3 days late", async () => {
    const { prisma } = prismaWith([{ id: "c1", birthDate: BIRTH }]);
    const day3 = await evaluate({ prisma, now: new Date("2026-01-20T12:00:00Z") });
    expect(day3[0]?.dedupeKey).toBe("tip:c1:week.1");
    expect(await evaluate({ prisma, now: new Date("2026-01-21T12:00:00Z") })).toEqual([]);
  });

  it("skips children with no tip for their age", async () => {
    const { prisma } = prismaWith([{ id: "c1", birthDate: new Date("2020-01-01T00:00:00Z") }]);
    expect(await evaluate({ prisma, now: AT_1000 })).toEqual([]);
  });

  it("uses month tips after the first year", async () => {
    const { prisma } = prismaWith([{ id: "c1", birthDate: BIRTH }]);
    const result = await evaluate({ prisma, now: new Date("2027-03-10T12:00:00Z") });
    expect(result[0]?.dedupeKey).toBe("tip:c1:month.14");
  });
});

describe("tip push texts", () => {
  it("quotes the tip from the tips namespace in the recipient's locale", async () => {
    const { prisma } = prismaWith([{ id: "c1", birthDate: BIRTH }]);
    const [candidate] = await evaluate({ prisma, now: AT_1000 });
    const title = translatePush("nb", candidate!.titleKey, candidate!.params);
    expect(title).toBe(`Nytt tips: ${nb.tips.week[1].title}`);
    expect(translatePush("en", candidate!.bodyKey, candidate!.params)).toBe(en.tips.week[1].body);
  });
});

describe("translatePush params", () => {
  it("keeps plain strings literal, even when they look like a reference", () => {
    const name = "@tips:week.1.body";
    expect(translatePush("nb", "push.weeklyTip.title", { tip: name })).toBe(`Nytt tips: ${name}`);
  });

  it("rejects refs to keys outside the allowlist", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(translatePush("nb", "push.weeklyTip.title", { tip: { ref: "tips", key: "card.readMore" } })).toBe(
      "Nytt tips: "
    );
    spy.mockRestore();
  });
});

describe("tips content", () => {
  it("covers weeks 0-52 and months 13-36 in both languages with a helsenorge link", () => {
    for (const catalog of [nb, en]) {
      expect(Object.keys(catalog.tips.week)).toHaveLength(53);
      expect(Object.keys(catalog.tips.month)).toHaveLength(24);
      const all = [
        ...Object.values(catalog.tips.week),
        ...Object.values(catalog.tips.month),
      ] as { title: string; body: string; url: string }[];
      for (const tip of all) {
        expect(tip.title).not.toBe("");
        expect(tip.body).not.toBe("");
        expect(tip.url).toMatch(/^https:\/\/www\.helsenorge\.no\//);
      }
    }
  });
});
