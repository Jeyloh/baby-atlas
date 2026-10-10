import { z } from "zod";
import { idSchema, dateRangeSchema } from "./common";

export const pottySignalSchema = z.enum([
  "DRY_TWO_HOURS",
  "HIDES_TO_POOP",
  "DISCOMFORT_DIRTY_DIAPER",
  "INTEREST_IN_TOILET",
  "PULLS_PANTS_UP_DOWN",
  "ANNOUNCES_NEED",
]);
export type PottySignal = z.infer<typeof pottySignalSchema>;

export const POTTY_SIGNALS = pottySignalSchema.options;

export const logPottyReadinessSchema = z.object({
  childId: idSchema,
  time: z.coerce.date(),
  signals: z.array(pottySignalSchema).min(1),
  notes: z.string().max(500).optional(),
});
export type LogPottyReadinessInput = z.infer<typeof logPottyReadinessSchema>;

export const deletePottyReadinessSchema = z.object({
  id: idSchema,
});

export const listPottyReadinessSchema = z.object({
  childId: idSchema,
  dateRange: dateRangeSchema.optional(),
});
