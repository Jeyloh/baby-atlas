import type { SupportCardState } from "./types";

/** Most non-urgent cards shown before the "show more" toggle. */
export const MAX_REGULAR_CARDS = 3;

export interface SupportEntry {
  id: string;
  /** A soft card is a gentle extra: at most one is shown, and it goes last */
  soft?: boolean;
  card: SupportCardState;
}

export interface ArrangedCards {
  /** Always shown first, outside the limit */
  urgent: SupportEntry[];
  /** The first non-urgent cards, up to the limit */
  shown: SupportEntry[];
  /** The rest, behind the toggle */
  extra: SupportEntry[];
  soft: SupportEntry | null;
}

/**
 * Orders the cards. The entries come in priority order. Urgent cards go first
 * (in that order), then at most `limit` non-urgent cards, the rest are extra.
 * Of the soft cards only the first one that has something to show is kept,
 * and it comes last.
 */
export function arrangeCards(entries: SupportEntry[], limit = MAX_REGULAR_CARDS): ArrangedCards {
  const visible = entries.filter((entry) => entry.card.visible);
  const regular = visible.filter((entry) => !entry.card.urgent && !entry.soft);
  return {
    urgent: visible.filter((entry) => entry.card.urgent),
    shown: regular.slice(0, limit),
    extra: regular.slice(limit),
    soft: visible.find((entry) => entry.soft && !entry.card.urgent) ?? null,
  };
}
