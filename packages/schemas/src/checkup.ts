import { z } from "zod";
import { idSchema } from "./common";

const DAY_MS = 86_400_000;

/** A booked time is at most a day ago (a visit running now) and at most 2 years ahead. */
export function isBookableTime(date: Date, now: Date = new Date()): boolean {
  return (
    date.getTime() >= now.getTime() - DAY_MS && date.getTime() <= now.getTime() + 2 * 365 * DAY_MS
  );
}

const checkupKeySchema = z.string().min(1).max(50);

export const listCheckupsSchema = z.object({ childId: idSchema });

/** `scheduledAt: null` removes the booking. */
export const setCheckupScheduledSchema = z.object({
  childId: idSchema,
  checkupKey: checkupKeySchema,
  scheduledAt: z.coerce
    .date()
    .refine((d) => isBookableTime(d), { message: "Appointment time is out of range" })
    .nullable(),
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
