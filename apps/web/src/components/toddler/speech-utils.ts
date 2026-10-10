import type { SpeechCategory } from "@baby-atlas/schemas";

export interface SpeechWordLike {
  id: string;
  word: string;
  category: SpeechCategory;
  firstSaidAt: Date;
  createdAt: Date;
}

export interface VocabularyPoint {
  date: string;
  count: number;
}

export const SPEECH_CATEGORIES: SpeechCategory[] = ["WORD", "SOUND", "SIGN"];

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** One point per day with new words, holding the running total up to that day. */
export function cumulativeVocabulary(
  words: Pick<SpeechWordLike, "firstSaidAt">[]
): VocabularyPoint[] {
  const perDay = new Map<string, number>();
  for (const { firstSaidAt } of words) {
    const key = dayKey(firstSaidAt);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }
  let total = 0;
  return [...perDay.keys()].sort().map((date) => {
    total += perDay.get(date) ?? 0;
    return { date, count: total };
  });
}

export function sortNewestFirst<T extends SpeechWordLike>(words: T[]): T[] {
  return [...words].sort(
    (a, b) =>
      b.firstSaidAt.getTime() - a.firstSaidAt.getTime() ||
      b.createdAt.getTime() - a.createdAt.getTime()
  );
}

export function filterByCategory<T extends SpeechWordLike>(
  words: T[],
  category: SpeechCategory | "ALL"
): T[] {
  return category === "ALL" ? words : words.filter((w) => w.category === category);
}

export function countByCategory(
  words: Pick<SpeechWordLike, "category">[]
): Record<SpeechCategory, number> {
  const counts: Record<SpeechCategory, number> = { WORD: 0, SOUND: 0, SIGN: 0 };
  for (const { category } of words) counts[category] += 1;
  return counts;
}
