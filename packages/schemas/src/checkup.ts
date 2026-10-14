import { z } from "zod";
import { idSchema } from "./common";

const checkupKeySchema = z.string().min(1).max(50);

export const listCheckupsSchema = z.object({ childId: idSchema });

/** `scheduledAt: null` removes the booking. */
export const setCheckupScheduledSchema = z.object({
  childId: idSchema,
  checkupKey: checkupKeySchema,
  scheduledAt: z.coerce.date().nullable(),
});
export type SetCheckupScheduledInput = z.infer<typeof setCheckupScheduledSchema>;

export const markCheckupDoneSchema = z.object({
  childId: idSchema,
  checkupKey: checkupKeySchema,
  completedAt: z.coerce.date(),
  notes: z.string().max(1000).optional(),
});
export type MarkCheckupDoneInput = z.infer<typeof markCheckupDoneSchema>;

export const undoCheckupDoneSchema = z.object({
  childId: idSchema,
  checkupKey: checkupKeySchema,
});

/** An empty string clears the notes. */
export const setCheckupNotesSchema = z.object({
  childId: idSchema,
  checkupKey: checkupKeySchema,
  notes: z.string().max(1000),
});
