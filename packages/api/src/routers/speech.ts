import { TRPCError } from "@trpc/server";
import {
  addSpeechWordSchema,
  updateSpeechWordSchema,
  deleteSpeechWordSchema,
  listSpeechWordsSchema,
} from "@baby-atlas/schemas";
import { createTRPCRouter, protectedProcedure, assertChildAccess } from "../trpc";

export const speechRouter = createTRPCRouter({
  list: protectedProcedure
    .input(listSpeechWordsSchema)
    .query(async ({ ctx, input }) => {
      await assertChildAccess(ctx, input.childId);
      return ctx.prisma.speechWord.findMany({
        where: { childId: input.childId },
        orderBy: [{ firstSaidAt: "desc" }, { createdAt: "desc" }],
      });
    }),

  add: protectedProcedure
    .input(addSpeechWordSchema)
    .mutation(async ({ ctx, input }) => {
      await assertChildAccess(ctx, input.childId, { write: true });
      return ctx.prisma.speechWord.create({
        data: {
          childId: input.childId,
          word: input.word,
          category: input.category,
          firstSaidAt: input.firstSaidAt,
          notes: input.notes,
        },
      });
    }),

  update: protectedProcedure
    .input(updateSpeechWordSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.speechWord.findUnique({
        where: { id: input.id },
        select: { childId: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await assertChildAccess(ctx, existing.childId, { write: true });

      return ctx.prisma.speechWord.update({
        where: { id: input.id },
        data: {
          word: input.word,
          category: input.category,
          firstSaidAt: input.firstSaidAt,
          notes: input.notes,
        },
      });
    }),

  delete: protectedProcedure
    .input(deleteSpeechWordSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.speechWord.findUnique({
        where: { id: input.id },
        select: { childId: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await assertChildAccess(ctx, existing.childId, { write: true });

      await ctx.prisma.speechWord.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
