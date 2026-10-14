import { TRPCError } from "@trpc/server";
import {
  startPumpingSchema,
  endPumpingSchema,
  logPumpingSchema,
  updatePumpingSchema,
  deletePumpingSchema,
  getPumpingRecordsSchema,
  pumpingSummarySchema,
  getActivePumpingSchema,
} from "@baby-atlas/schemas";
import { getDateRange, calculateDurationMinutes } from "@baby-atlas/utils";
import { createTRPCRouter, householdProcedure, recordProcedure } from "../trpc";
import { rethrowIfAlreadyEnded } from "../errors";
import { assertEndTime, assertUpdatedTimes, endTimeOrNow } from "../end-time";
import { findReplayedRecord } from "../replay";

export const pumpingRouter = createTRPCRouter({
  list: householdProcedure
    .input(getPumpingRecordsSchema)
    .query(async ({ ctx, input }) => {
      const dateFilter = input.dateRange
        ? { gte: input.dateRange.start, lte: input.dateRange.end }
        : input.period
          ? { gte: getDateRange(input.period).start, lte: getDateRange(input.period).end }
          : undefined;

      const records = await ctx.prisma.pumpingRecord.findMany({
        where: {
          childId: input.childId,
          ...(dateFilter && { startTime: dateFilter }),
        },
        orderBy: { startTime: "desc" },
      });

      return records;
    }),

  start: householdProcedure
    .input(startPumpingSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.memberRole === "VIEWER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Viewers cannot log activities",
        });
      }

      const replayed = await findReplayedRecord(input.recordId, input.childId, (id) =>
        ctx.prisma.pumpingRecord.findUnique({ where: { id } })
      );
      if (replayed) return replayed;

      const pumping = await ctx.prisma.pumpingRecord.create({
        data: {
          id: input.recordId,
          childId: input.childId,
          startTime: input.startTime ?? new Date(),
          side: input.side,
        },
      });

      return pumping;
    }),

  end: recordProcedure("pumpingRecord")
    .input(endPumpingSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.memberRole === "VIEWER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Viewers cannot log activities",
        });
      }

      const stored = await ctx.prisma.pumpingRecord.findUnique({
        where: { id: input.id },
        select: { startTime: true },
      });
      if (!stored) throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });

      const pumping = await ctx.prisma.pumpingRecord
        .update({
          where: { id: input.id, endTime: null },
          data: {
            endTime: endTimeOrNow(stored.startTime, input.endTime),
            amountMl: input.amountMl,
            notes: input.notes,
          },
        })
        .catch(rethrowIfAlreadyEnded);

      return pumping;
    }),

  log: householdProcedure
    .input(logPumpingSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.memberRole === "VIEWER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Viewers cannot log activities",
        });
      }

      const pumping = await ctx.prisma.pumpingRecord.create({
        data: {
          childId: input.childId,
          startTime: input.startTime,
          // A manual log is a finished event. Only the start procedures leave a timer open.
          endTime: assertEndTime(input.startTime, input.endTime) ?? input.startTime,
          amountMl: input.amountMl,
          side: input.side,
          notes: input.notes,
        },
      });

      return pumping;
    }),

  update: recordProcedure("pumpingRecord")
    .input(updatePumpingSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.memberRole === "VIEWER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Viewers cannot update activities",
        });
      }

      const stored = await ctx.prisma.pumpingRecord.findUnique({
        where: { id: input.id },
        select: { startTime: true, endTime: true },
      });
      if (!stored) throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
      const endTime = assertUpdatedTimes(stored, input);

      const pumping = await ctx.prisma.pumpingRecord.update({
        where: { id: input.id },
        data: {
          startTime: input.startTime,
          endTime,
          amountMl: input.amountMl,
          side: input.side,
          notes: input.notes,
        },
      });

      return pumping;
    }),

  delete: recordProcedure("pumpingRecord")
    .input(deletePumpingSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.memberRole === "VIEWER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Viewers cannot delete activities",
        });
      }

      await ctx.prisma.pumpingRecord.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  summary: householdProcedure
    .input(pumpingSummarySchema)
    .query(async ({ ctx, input }) => {
      const { start, end } = getDateRange(input.period);

      const records = await ctx.prisma.pumpingRecord.findMany({
        where: {
          childId: input.childId,
          startTime: { gte: start, lte: end },
        },
      });

      const totalMinutes = records.reduce((sum, r) => {
        if (!r.endTime) return sum;
        return sum + calculateDurationMinutes(r.startTime, r.endTime);
      }, 0);

      const totalMl = records.reduce((sum, r) => sum + (r.amountMl ?? 0), 0);

      return {
        totalSessions: records.length,
        totalMinutes,
        totalMl,
        averageMl: records.length > 0 ? totalMl / records.length : 0,
      };
    }),

  getActive: householdProcedure
    .input(getActivePumpingSchema)
    .query(async ({ ctx, input }) => {
      // Find active pumping session (no end time)
      const activePumping = await ctx.prisma.pumpingRecord.findFirst({
        where: {
          childId: input.childId,
          endTime: null,
        },
        orderBy: { startTime: "desc" },
      });

      return activePumping;
    }),
});
