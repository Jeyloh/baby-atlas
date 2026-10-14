export type Direction = "up" | "down" | "same" | "none";

export interface Comparison {
  direction: Direction;
  /** Absolute difference, only for up and down */
  amount: number;
}

/**
 * How this week compares with the week before. `none` when either side has no
 * number. Differences smaller than `tolerance` count as the same.
 */
export function compareValues(
  current: number | null,
  previous: number | null,
  tolerance = 0.05
): Comparison {
  if (current === null || previous === null) return { direction: "none", amount: 0 };
  const diff = current - previous;
  if (Math.abs(diff) < tolerance) return { direction: "same", amount: 0 };
  return { direction: diff > 0 ? "up" : "down", amount: Math.abs(diff) };
}

/** A week as a link parameter, only when it looks like a date. */
export function parseWeekParam(value: string | string[] | undefined): string | undefined {
  const text = Array.isArray(value) ? value[0] : value;
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : undefined;
}
