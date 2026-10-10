import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@baby-atlas/api";

export type JournalListItem = inferRouterOutputs<AppRouter>["journal"]["list"]["items"][number];
export type JournalPhotoItem = JournalListItem["photos"][number];

export function photoUrl(photoId: string, size: "thumb" | "full"): string {
  return `/api/journal/photos/${photoId}?size=${size}`;
}

export interface MonthGroup<T> {
  key: string;
  /** The first day of the month at UTC midnight, like the date-only values from the database. */
  month: Date;
  items: T[];
}

/** Groups entries that are already sorted newest first into consecutive months. */
export function groupByMonth<T extends { date: Date }>(items: T[]): MonthGroup<T>[] {
  const groups: MonthGroup<T>[] = [];
  for (const item of items) {
    const key = item.date.toISOString().slice(0, 7);
    const last = groups[groups.length - 1];
    if (last?.key === key) {
      last.items.push(item);
    } else {
      groups.push({ key, month: new Date(`${key}-01T00:00:00.000Z`), items: [item] });
    }
  }
  return groups;
}

/** Height over width for a single photo, kept between a tall portrait and a wide landscape. */
export function singlePhotoAspect(width: number, height: number): number {
  return Math.min(Math.max(width / height, 0.75), 1.6);
}

/** How many photo tiles to draw, and how many photos hide behind the last tile. */
export function photoTiles(count: number): { visible: number; hidden: number } {
  if (count <= 3) return { visible: count, hidden: 0 };
  return { visible: 3, hidden: count - 3 };
}
