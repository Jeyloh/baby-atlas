import { z } from "zod";
import { idSchema } from "./common";

export const JOURNAL_TAGS = [
  "SICKNESS",
  "MILESTONE",
  "FIRST_TIME",
  "CLINIC",
  "FUNNY",
  "EVERYDAY",
] as const;
export const journalTagSchema = z.enum(JOURNAL_TAGS);
export type JournalTagValue = z.infer<typeof journalTagSchema>;

export const MAX_JOURNAL_TEXT_LENGTH = 5000;
export const MAX_JOURNAL_PHOTOS = 6;
export const JOURNAL_PAGE_SIZE = 20;

const tagsSchema = z
  .array(journalTagSchema)
  .min(1)
  .max(JOURNAL_TAGS.length)
  .transform((tags) => [...new Set(tags)]);

const textSchema = z.string().trim().min(1).max(MAX_JOURNAL_TEXT_LENGTH);

export const listJournalSchema = z.object({
  childId: idSchema,
  tags: z.array(journalTagSchema).max(JOURNAL_TAGS.length).optional(),
  cursor: idSchema.optional(),
  limit: z.number().int().min(1).max(50).default(JOURNAL_PAGE_SIZE),
});

export const createJournalEntrySchema = z.object({
  childId: idSchema,
  date: z.coerce.date(),
  text: textSchema,
  tags: tagsSchema,
});

export const updateJournalEntrySchema = z.object({
  id: idSchema,
  date: z.coerce.date().optional(),
  text: textSchema.optional(),
  tags: tagsSchema.optional(),
});

export const deleteJournalEntrySchema = z.object({ id: idSchema });

export const deleteJournalPhotoSchema = z.object({ photoId: idSchema });

export const reorderJournalPhotosSchema = z.object({
  entryId: idSchema,
  photoIds: z.array(idSchema).min(1).max(MAX_JOURNAL_PHOTOS),
});
