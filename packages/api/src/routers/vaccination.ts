import { TRPCError } from "@trpc/server";
import {
  markVaccinationSchema,
  unmarkVaccinationSchema,
  listVaccinationsSchema,
} from "@baby-atlas/schemas";
import { isKnownVaccineKey } from "@baby-atlas/utils";
import { createTRPCRouter, protectedProcedure, assertChildAccess } from "../trpc";

export const vaccinationRouter = createTRPCRouter({
  list: protectedProcedure
    .input(listVaccinationsSchema)
    .query(async ({ ctx, input }) => {
      await assertChildAccess(ctx, input.childId);
      return ctx.prisma.vaccinationRecord.findMany({
        where: { childId: input.childId },
      });
    }),

  mark: protectedProcedure
    .input(markVaccinationSchema)
    .mutation(async ({ ctx, input }) => {
      if (!isKnownVaccineKey(input.vaccineKey)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown vaccine" });
      }
      await assertChildAccess(ctx, input.childId, { write: true });

      return ctx.prisma.vaccinationRecord.upsert({
        where: {
          childId_vaccineKey: {
            childId: input.childId,
            vaccineKey: input.vaccineKey,
          },
        },
        create: {
          childId: input.childId,
          vaccineKey: input.vaccineKey,
          givenAt: input.givenAt,
          notes: input.notes,
        },
        update: { givenAt: input.givenAt, notes: input.notes },
      });
    }),

  unmark: protectedProcedure
    .input(unmarkVaccinationSchema)
    .mutation(async ({ ctx, input }) => {
      await assertChildAccess(ctx, input.childId, { write: true });
      await ctx.prisma.vaccinationRecord.deleteMany({
        where: { childId: input.childId, vaccineKey: input.vaccineKey },
      });
      return { success: true };
    }),
});
