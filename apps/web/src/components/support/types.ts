import type { ReactNode } from "react";

/** Props shared by every card on the home screen's support area. */
export interface SupportCardProps {
  childId: string;
  /** The child's birth date (a calendar date) */
  birthDate: Date;
}

/**
 * What a card tells the support area: whether it has something to show (so
 * the parent can count and order the cards), whether it is urgent, and what
 * to render. The card's data and decision live in its `use...Card` hook.
 */
export interface SupportCardState {
  visible: boolean;
  /** Always shown first, outside the limit */
  urgent: boolean;
  /** What to render in the list; null when not visible */
  element: ReactNode;
  /** Rendered whether or not the card is in the list, e.g. a dialog opened from a link */
  overlay?: ReactNode;
}

export const HIDDEN_CARD: SupportCardState = { visible: false, urgent: false, element: null };
