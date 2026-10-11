import { z } from "zod";

export const idSchema = z.string().cuid();

// An id the client picks for a new record, so it can log offline and refer to
// the record (stop, undo) before the server has seen it. Not called "id",
// because householdProcedure reads "id" as a child or household id.
export const recordIdSchema = idSchema.optional();

export const paginationSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export const dateRangeSchema = z.object({
  start: z.coerce.date(),
  end: z.coerce.date(),
});

export const periodSchema = z.enum(["today", "week", "month"]);
export type Period = z.infer<typeof periodSchema>;

export const timestampSchema = z.coerce.date();
