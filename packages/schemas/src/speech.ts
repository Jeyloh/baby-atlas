import { z } from "zod";
import { idSchema } from "./common";

export const speechCategorySchema = z.enum(["WORD", "SOUND", "SIGN"]);
export type SpeechCategory = z.infer<typeof speechCategorySchema>;

export const addSpeechWordSchema = z.object({
  childId: idSchema,
  word: z.string().trim().min(1).max(100),
  category: speechCategorySchema.default("WORD"),
  firstSaidAt: z.coerce.date(),
  notes: z.string().max(500).optional(),
});
export type AddSpeechWordInput = z.infer<typeof addSpeechWordSchema>;

export const updateSpeechWordSchema = z.object({
  id: idSchema,
  word: z.string().trim().min(1).max(100).optional(),
  category: speechCategorySchema.optional(),
  firstSaidAt: z.coerce.date().optional(),
  notes: z.string().max(500).optional().nullable(),
});
export type UpdateSpeechWordInput = z.infer<typeof updateSpeechWordSchema>;

export const deleteSpeechWordSchema = z.object({
  id: idSchema,
});

export const listSpeechWordsSchema = z.object({
  childId: idSchema,
});
