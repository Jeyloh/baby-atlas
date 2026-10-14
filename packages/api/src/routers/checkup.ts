import { TRPCError } from "@trpc/server";
import {
  listCheckupsSchema,
  setCheckupScheduledSchema,
  markCheckupDoneSchema,
  undoCheckupDoneSchema,
  setCheckupNotesSchema,
} from "@baby-atlas/schemas";
import { buildCheckupViews, isKnownCheckupKey, osloDayKey } from "@baby-atlas/utils";
import { createTRPCRouter, householdProcedure } from "../trpc";

function assertCanWrite(role: string) {
  if (role === "VIEWER") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Viewers cannot change checkups" });
  }
}

function assertKnownKey(key: string) {
  if (!isKnownCheckupKey(key)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown checkup" });
  }
}

export const checkupRouter = createTRPCRouter({
  /** The whole health station programme with this child's bookings and records. */
  list: householdProcedure.input(listCheckupsSchema).query(async ({ ctx, input }) => {
    const child = await ctx.prisma.child.findUnique({
      where: { id: input.childId },
      select: { birthDate: true },
    });
    if (!child) throw new TRPCError({ code: "NOT_FOUND" });

    const records = await ctx.prisma.checkupRecord.findMany({
      where: { childId: input.childId },
    });
    const notes = new Map(records.map((r) => [r.checkupKey, r.notes]));

    const items = buildCheckupViews(child.birthDate, records, new Date()).map((view) => ({
      ...view,
      notes: notes.get(view.contact.key) ?? null,
    }));
    return { canEdit: ctx.memberRole !== "VIEWER", items };
  }),

  /** Books a time (date and time), or removes the booking with `null`. */
  setScheduled: householdProcedure
    .input(setCheckupScheduledSchema)
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.memberRole);
      assertKnownKey(input.checkupKey);
      const where = { childId_checkupKey: { childId: input.childId, checkupKey: input.checkupKey } };

      if (input.scheduledAt === null) {
        await ctx.prisma.checkupRecord.updateMany({
          where: { childId: input.childId, checkupKey: input.checkupKey },
          data: { scheduledAt: null },
        });
        return { success: true };
      }

      return ctx.prisma.checkupRecord.upsert({
        where,
        create: {
          childId: input.childId,
          checkupKey: input.checkupKey,
          scheduledAt: input.scheduledAt,
        },
        update: { scheduledAt: input.scheduledAt },
      });
    }),

  markDone: householdProcedure.input(markCheckupDoneSchema).mutation(async ({ ctx, input }) => {
    assertCanWrite(ctx.memberRole);
    assertKnownKey(input.checkupKey);
    if (input.completedAt.toISOString().slice(0, 10) > osloDayKey(new Date())) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "The date cannot be in the future" });
    }
    const child = await ctx.prisma.child.findUnique({
      where: { id: input.childId },
      select: { birthDate: true },
    });
    if (!child) throw new TRPCError({ code: "NOT_FOUND" });
    if (input.completedAt < child.birthDate) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "The date cannot be before birth" });
    }
    const notes = input.notes?.trim() ? input.notes.trim() : undefined;

    return ctx.prisma.checkupRecord.upsert({
      where: { childId_checkupKey: { childId: input.childId, checkupKey: input.checkupKey } },
      create: {
        childId: input.childId,
        checkupKey: input.checkupKey,
        completedAt: input.completedAt,
        notes,
      },
      update: {
        completedAt: input.completedAt,
        ...(notes !== undefined && { notes }),
      },
    });
  }),

  /** Removes the done mark but keeps the booking and notes. */
  undoDone: householdProcedure.input(undoCheckupDoneSchema).mutation(async ({ ctx, input }) => {
    assertCanWrite(ctx.memberRole);
    assertKnownKey(input.checkupKey);
    await ctx.prisma.checkupRecord.updateMany({
      where: { childId: input.childId, checkupKey: input.checkupKey },
      data: { completedAt: null },
    });
    return { success: true };
  }),

  setNotes: householdProcedure.input(setCheckupNotesSchema).mutation(async ({ ctx, input }) => {
    assertCanWrite(ctx.memberRole);
    assertKnownKey(input.checkupKey);
    const notes = input.notes.trim() === "" ? null : input.notes.trim();
    return ctx.prisma.checkupRecord.upsert({
      where: { childId_checkupKey: { childId: input.childId, checkupKey: input.checkupKey } },
      create: { childId: input.childId, checkupKey: input.checkupKey, notes },
      update: { notes },
    });
  }),
});
