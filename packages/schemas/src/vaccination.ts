import { z } from "zod";
import { idSchema } from "./common";

export const markVaccinationSchema = z.object({
  childId: idSchema,
  vaccineKey: z.string().min(1).max(100),
  givenAt: z.coerce.date(),
  notes: z.string().max(500).optional(),
});
export type MarkVaccinationInput = z.infer<typeof markVaccinationSchema>;

export const unmarkVaccinationSchema = z.object({
  childId: idSchema,
  vaccineKey: z.string().min(1).max(100),
});

export const listVaccinationsSchema = z.object({
  childId: idSchema,
});
