import { TRPCError } from "@trpc/server";
import {
  logPottyReadinessSchema,
  deletePottyReadinessSchema,
  listPottyReadinessSchema,
} from "@baby-atlas/schemas";
import { createTRPCRouter, protectedProcedure, assertChildAccess } from "../trpc";

export const pottyRouter = createTRPCRouter({
  list: protectedProcedure
    .input(listPottyReadinessSchema)
    .query(async ({ ctx, input }) => {
      await assertChildAccess(ctx, input.childId);
      return ctx.prisma.pottyReadinessLog.findMany({
        where: {
          childId: input.childId,
          ...(input.dateRange && {
            time: { gte: input.dateRange.start, lte: input.dateRange.end },
          }),
        },
        orderBy: { time: "desc" },
      });
    }),

  log: protectedProcedure
    .input(logPottyReadinessSchema)
    .mutation(async ({ ctx, input }) => {
      await assertChildAccess(ctx, input.childId, { write: true });
      return ctx.prisma.pottyReadinessLog.create({
        data: {
          childId: input.childId,
          time: input.time,
          signals: [...new Set(input.signals)],
          notes: input.notes,
        },
      });
    }),

  delete: protectedProcedure
    .input(deletePottyReadinessSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.pottyReadinessLog.findUnique({
        where: { id: input.id },
        select: { childId: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await assertChildAccess(ctx, existing.childId, { write: true });

      await ctx.prisma.pottyReadinessLog.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
