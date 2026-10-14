import { z } from "zod";
import { lastOsloDayKeys, osloDayKey } from "@baby-atlas/utils";
import { createTRPCRouter, protectedProcedure } from "../trpc";

// Private data: every query is keyed on the session user. No procedure takes
// a user id, and nothing here is shared with the household.

const RECENT_DAYS = 14;

/** A calendar day (YYYY-MM-DD) as the UTC-midnight Date stored in a @db.Date column. */
function dayKeyToDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

function toEntry(entry: {
  date: Date;
  mood: number;
  sleepHours: number | null;
  note: string | null;
}) {
  return {
    date: entry.date.toISOString().slice(0, 10),
    mood: entry.mood,
    sleepHours: entry.sleepHours,
    note: entry.note,
  };
}

export const wellbeingRouter = createTRPCRouter({
  /** Saves today's check-in (today in Europe/Oslo), replacing an earlier one. */
  upsertToday: protectedProcedure
    .input(
      z.object({
        mood: z.number().int().min(1).max(5),
        sleepHours: z.number().min(0).max(24).nullish(),
        note: z.string().max(500).nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const date = dayKeyToDate(osloDayKey(new Date()));
      const data = {
        mood: input.mood,
        sleepHours: input.sleepHours ?? null,
        note: input.note?.trim() || null,
      };
      const entry = await ctx.prisma.parentCheckIn.upsert({
        where: { userId_date: { userId: ctx.session.user.id, date } },
        create: { userId: ctx.session.user.id, date, ...data },
        update: data,
      });
      return toEntry(entry);
    }),

  /** The caller's check-ins from the last 14 days, newest first. */
  recent: protectedProcedure.query(async ({ ctx }) => {
    const [oldest] = lastOsloDayKeys(RECENT_DAYS, new Date());
    const entries = await ctx.prisma.parentCheckIn.findMany({
      where: { userId: ctx.session.user.id, date: { gte: dayKeyToDate(oldest!) } },
      orderBy: { date: "desc" },
      take: RECENT_DAYS,
    });
    return entries.map(toEntry);
  }),

  /** Deletes the caller's own check-in for a day (YYYY-MM-DD). */
  delete: protectedProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .mutation(async ({ ctx, input }) => {
      const { count } = await ctx.prisma.parentCheckIn.deleteMany({
        where: { userId: ctx.session.user.id, date: dayKeyToDate(input.date) },
      });
      return { deleted: count };
    }),
});
