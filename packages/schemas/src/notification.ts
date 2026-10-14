import { z } from "zod";
import { idSchema } from "./common";

export const notificationKindSchema = z.enum([
  "TIMER_RUNNING",
  "MEDICINE_NEXT_DOSE",
  "FEED_DUE",
  "NAP_DUE",
  "CHECKUP_REMINDER",
  "VACCINE_REMINDER",
  "WEEKLY_DIGEST",
  "WEEKLY_TIP",
]);
export type NotificationKind = z.infer<typeof notificationKindSchema>;
export const NOTIFICATION_KINDS = notificationKindSchema.options;

/** On unless the parent turns them off. Predictions (feed, nap) are opt-in. */
export const DEFAULT_ENABLED_KINDS: NotificationKind[] = [
  "TIMER_RUNNING",
  "MEDICINE_NEXT_DOSE",
  "CHECKUP_REMINDER",
  "VACCINE_REMINDER",
  "WEEKLY_DIGEST",
  "WEEKLY_TIP",
];

/** Quiet hours as minutes after midnight (Europe/Oslo): 22:00 to 07:00 */
export const DEFAULT_QUIET_START = 22 * 60;
export const DEFAULT_QUIET_END = 7 * 60;

export const notificationLocaleSchema = z.enum(["nb", "en"]);
export type NotificationLocale = z.infer<typeof notificationLocaleSchema>;

/** Timer types that can have their own "forgotten timer" threshold */
export const TIMER_THRESHOLD_KEYS = [
  "nap",
  "nightSleep",
  "breastfeeding",
  "bottle",
  "pumping",
  "activity",
] as const;
export const timerThresholdKeySchema = z.enum(TIMER_THRESHOLD_KEYS);
export type TimerThresholdKey = z.infer<typeof timerThresholdKeySchema>;

/** Minutes per timer type. Missing types use the built-in defaults, {} resets all. */
export const timerThresholdsSchema = z.record(
  timerThresholdKeySchema,
  z.number().int().min(1).max(24 * 60)
);
export type TimerThresholds = z.infer<typeof timerThresholdsSchema>;

const minuteOfDaySchema = z.number().int().min(0).max(1439);

export const updateNotificationSettingsSchema = z.object({
  enabledKinds: z
    .array(notificationKindSchema)
    .max(NOTIFICATION_KINDS.length)
    .refine((kinds) => new Set(kinds).size === kinds.length, {
      message: "Duplicate notification kinds",
    })
    .optional(),
  mutedChildIds: z.array(idSchema).max(50).optional(),
  quietStart: minuteOfDaySchema.nullable().optional(),
  quietEnd: minuteOfDaySchema.nullable().optional(),
  timerThresholds: timerThresholdsSchema.optional(),
  locale: notificationLocaleSchema.optional(),
});
export type UpdateNotificationSettingsInput = z.infer<typeof updateNotificationSettingsSchema>;

/** The parts of PushSubscription.toJSON() the server needs */
export const subscribePushSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
  userAgent: z.string().max(512).optional(),
  locale: notificationLocaleSchema.optional(),
});
export type SubscribePushInput = z.infer<typeof subscribePushSchema>;

export const unsubscribePushSchema = z.object({
  endpoint: z.string().url().max(2048),
});
export type UnsubscribePushInput = z.infer<typeof unsubscribePushSchema>;
