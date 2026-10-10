import { describe, it, expect } from "vitest";
import { groupByMonth, photoTiles, photoUrl, singlePhotoAspect } from "./journal-utils";

const entry = (id: string, date: string) => ({ id, date: new Date(`${date}T00:00:00.000Z`) });

describe("groupByMonth", () => {
  it("groups consecutive entries by month and keeps their order", () => {
    const groups = groupByMonth([
      entry("a", "2026-10-09"),
      entry("b", "2026-10-02"),
      entry("c", "2026-09-30"),
      entry("d", "2025-10-01"),
    ]);

    expect(groups.map((g) => [g.key, g.items.map((i) => i.id)])).toEqual([
      ["2026-10", ["a", "b"]],
      ["2026-09", ["c"]],
      ["2025-10", ["d"]],
    ]);
    expect(groups[0]!.month.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("returns nothing for no entries", () => {
    expect(groupByMonth([])).toEqual([]);
  });
});

describe("photoTiles", () => {
  it.each([
    [1, 1, 0],
    [2, 2, 0],
    [3, 3, 0],
    [4, 3, 1],
    [6, 3, 3],
  ])("%i photos show %i tiles and hide %i", (count, visible, hidden) => {
    expect(photoTiles(count)).toEqual({ visible, hidden });
  });
});

describe("singlePhotoAspect", () => {
  it("clamps tall and wide photos", () => {
    expect(singlePhotoAspect(1000, 4000)).toBe(0.75);
    expect(singlePhotoAspect(4000, 1000)).toBe(1.6);
    expect(singlePhotoAspect(4, 3)).toBeCloseTo(1.333, 2);
  });
});

describe("photoUrl", () => {
  it("points at the access-checked route", () => {
    expect(photoUrl("abc", "thumb")).toBe("/api/journal/photos/abc?size=thumb");
    expect(photoUrl("abc", "full")).toBe("/api/journal/photos/abc?size=full");
  });
});
