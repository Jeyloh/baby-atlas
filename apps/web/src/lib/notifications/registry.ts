import { DEFAULT_ENABLED_KINDS, type NotificationKind } from "@baby-atlas/schemas";

export { evaluators } from "./evaluators";

export interface KindMeta {
  /** How long the push service keeps the notice for a device that is offline */
  ttlSeconds: number;
  urgency: "very-low" | "low" | "normal" | "high";
}

const HOUR = 60 * 60;

/** Delivery settings per kind. Digests and tips are fine to arrive late. */
export const KIND_META: Record<NotificationKind, KindMeta> = {
  TIMER_RUNNING: { ttlSeconds: HOUR, urgency: "normal" },
  MEDICINE_NEXT_DOSE: { ttlSeconds: HOUR, urgency: "normal" },
  FEED_DUE: { ttlSeconds: HOUR, urgency: "normal" },
  NAP_DUE: { ttlSeconds: HOUR, urgency: "normal" },
  CHECKUP_REMINDER: { ttlSeconds: 6 * HOUR, urgency: "normal" },
  VACCINE_REMINDER: { ttlSeconds: 6 * HOUR, urgency: "normal" },
  WEEKLY_DIGEST: { ttlSeconds: 24 * HOUR, urgency: "low" },
  WEEKLY_TIP: { ttlSeconds: 24 * HOUR, urgency: "low" },
};

export function defaultEnabledKinds(): NotificationKind[] {
  return [...DEFAULT_ENABLED_KINDS];
}
