import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createMedicineSchema,
  updateMedicineSchema,
  deleteMedicineSchema,
  getMedicinesSchema,
  logMedicineRecordSchema,
  updateMedicineRecordSchema,
  deleteMedicineRecordSchema,
  getMedicineRecordsSchema,
  idSchema,
} from "@baby-atlas/schemas";
import { createTRPCRouter, householdProcedure, recordProcedure } from "../trpc";

const DOSE_STATUS_LOOKBACK_MS = 50 * 60 * 60 * 1000;

export const medicineRouter = createTRPCRouter({
  list: householdProcedure
    .input(getMedicinesSchema)
    .query(async ({ ctx, input }) => {
      const medicines = await ctx.prisma.medicine.findMany({
        where: {
          childId: input.childId,
          ...(input.activeOnly && { isActive: true }),
        },
        orderBy: { name: "asc" },
      });

      return medicines;
    }),

  /**
   * Active medicines with the doses logged in the last 50 hours (enough for
   * the longest interval setting plus a margin), for dose status in the UI.
   */
  doseStatus: householdProcedure
    .input(z.object({ childId: idSchema }))
    .query(async ({ ctx, input }) => {
      const since = new Date(Date.now() - DOSE_STATUS_LOOKBACK_MS);
      return ctx.prisma.medicine.findMany({
        where: { childId: input.childId, isActive: true },
        orderBy: { name: "asc" },
        include: {
          records: {
            where: { time: { gte: since } },
            orderBy: { time: "desc" },
            select: { id: true, time: true, skipped: true },
          },
        },
      });
    }),

  get: recordProcedure("medicine")
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const medicine = await ctx.prisma.medicine.findUnique({
        where: { id: input.id },
        include: {
          records: {
            orderBy: { time: "desc" },
            take: 10,
          },
        },
      });

      if (!medicine) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return medicine;
    }),

  create: householdProcedure
    .input(createMedicineSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.memberRole === "VIEWER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Viewers cannot add medicines",
        });
      }

      const medicine = await ctx.prisma.medicine.create({
        data: {
          childId: input.childId,
          name: input.name,
          dosage: input.dosage,
          frequency: input.frequency,
          notes: input.notes,
          minIntervalHours: input.minIntervalHours ?? null,
          maxDosesPer24h: input.maxDosesPer24h ?? null,
          remindNextDose: input.remindNextDose ?? false,
        },
      });

      return medicine;
    }),

  update: recordProcedure("medicine")
    .input(updateMedicineSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.memberRole === "VIEWER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Viewers cannot update medicines",
        });
      }

      const medicine = await ctx.prisma.medicine.update({
        where: { id: input.id },
        data: {
          name: input.name,
          dosage: input.dosage,
          frequency: input.frequency,
          notes: input.notes,
          isActive: input.isActive,
          minIntervalHours: input.minIntervalHours,
          maxDosesPer24h: input.maxDosesPer24h,
          remindNextDose: input.remindNextDose,
        },
      });

      return medicine;
    }),

  delete: recordProcedure("medicine")
    .input(deleteMedicineSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.memberRole !== "OWNER" && ctx.memberRole !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only owners and admins can delete medicines",
        });
      }

      await ctx.prisma.medicine.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  logRecord: recordProcedure("medicine", "medicineId")
    .input(logMedicineRecordSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.memberRole === "VIEWER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Viewers cannot log medicine records",
        });
      }

      const record = await ctx.prisma.medicineRecord.create({
        data: {
          medicineId: input.medicineId,
          time: input.time ?? new Date(),
          dosageGiven: input.dosageGiven,
          skipped: input.skipped,
          notes: input.notes,
        },
      });

      return record;
    }),

  updateRecord: recordProcedure("medicineRecord")
    .input(updateMedicineRecordSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.memberRole === "VIEWER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Viewers cannot update medicine records",
        });
      }

      const record = await ctx.prisma.medicineRecord.update({
        where: { id: input.id },
        data: {
          time: input.time,
          dosageGiven: input.dosageGiven,
          skipped: input.skipped,
          notes: input.notes,
        },
      });

      return record;
    }),

  deleteRecord: recordProcedure("medicineRecord")
    .input(deleteMedicineRecordSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.memberRole === "VIEWER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Viewers cannot delete medicine records",
        });
      }

      await ctx.prisma.medicineRecord.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  getRecords: recordProcedure("medicine", "medicineId")
    .input(getMedicineRecordsSchema)
    .query(async ({ ctx, input }) => {
      const records = await ctx.prisma.medicineRecord.findMany({
        where: {
          medicineId: input.medicineId,
          ...(input.dateRange && {
            time: {
              gte: input.dateRange.start,
              lte: input.dateRange.end,
            },
          }),
        },
        orderBy: { time: "desc" },
      });

      return records;
    }),
});
