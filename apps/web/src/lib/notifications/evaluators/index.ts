import type { Evaluate, NotificationKind } from "../types";
import { evaluate as timerRunning } from "./timer-running";
import { evaluate as medicineNextDose } from "./medicine-next-dose";
import { evaluate as feedDue } from "./feed-due";
import { evaluate as napDue } from "./nap-due";
import { evaluate as checkupReminder } from "./checkup-reminder";
import { evaluate as vaccineReminder } from "./vaccine-reminder";
import { evaluate as weeklyDigest } from "./weekly-digest";
import { evaluate as weeklyTip } from "./weekly-tip";

/** One evaluator per kind. A new kind fails type-check until it is added here. */
export const evaluators: Record<NotificationKind, Evaluate> = {
  TIMER_RUNNING: timerRunning,
  MEDICINE_NEXT_DOSE: medicineNextDose,
  FEED_DUE: feedDue,
  NAP_DUE: napDue,
  CHECKUP_REMINDER: checkupReminder,
  VACCINE_REMINDER: vaccineReminder,
  WEEKLY_DIGEST: weeklyDigest,
  WEEKLY_TIP: weeklyTip,
};
