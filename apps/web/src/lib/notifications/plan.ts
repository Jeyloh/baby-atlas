import { isInQuietHours } from "@baby-atlas/utils";
import { DEFAULT_QUIET_END, DEFAULT_QUIET_START } from "@baby-atlas/schemas";
import { defaultLocale, type Locale } from "@/i18n/config";
import { defaultEnabledKinds } from "./registry";
import type { Candidate, NotificationKind } from "./types";

export interface RecipientSettings {
  enabledKinds: NotificationKind[];
  mutedChildIds: string[];
  quietStart: number | null;
  quietEnd: number | null;
  locale: Locale;
}

export interface HouseholdMemberRef {
  userId: string;
  role: "OWNER" | "ADMIN" | "CAREGIVER" | "VIEWER";
}

export interface Delivery {
  userId: string;
  candidate: Candidate;
}

/** What a user gets before they have saved any settings. */
export function defaultRecipientSettings(): RecipientSettings {
  return {
    enabledKinds: defaultEnabledKinds(),
    mutedChildIds: [],
    quietStart: DEFAULT_QUIET_START,
    quietEnd: DEFAULT_QUIET_END,
    locale: defaultLocale,
  };
}

/** The key used in the "already sent" set. */
export function logKey(userId: string, dedupeKey: string): string {
  return `${userId}\u0000${dedupeKey}`;
}

/**
 * Who a candidate is meant for: the explicit audience, or every household
 * member, always without viewers. An audience is cut down to current members,
 * so a user who left the household stops getting its notices.
 */
export function resolveAudience(candidate: Candidate, members: HouseholdMemberRef[]): string[] {
  const eligible = new Set(members.filter((m) => m.role !== "VIEWER").map((m) => m.userId));
  if (candidate.audience) return [...new Set(candidate.audience)].filter((id) => eligible.has(id));
  return [...eligible];
}

export interface PlanInput {
  candidates: Candidate[];
  membersByChild: Map<string, HouseholdMemberRef[]>;
  settingsByUser: Map<string, RecipientSettings>;
  /** Users with at least one push subscription */
  subscribedUsers: Set<string>;
  /** logKey() of every notice already sent */
  logged: Set<string>;
  now: Date;
}

/**
 * Decides who gets what in this run. A notice that is held back (quiet hours,
 * no subscription yet) is simply not planned and logged nowhere, so the next
 * run looks at it again; whether it is still relevant is up to the evaluator.
 */
export function planDeliveries(input: PlanInput): Delivery[] {
  const planned = new Set<string>();
  const deliveries: Delivery[] = [];

  for (const candidate of input.candidates) {
    const members = input.membersByChild.get(candidate.childId);
    if (!members) continue;

    for (const userId of resolveAudience(candidate, members)) {
      if (!input.subscribedUsers.has(userId)) continue;

      const key = logKey(userId, candidate.dedupeKey);
      if (input.logged.has(key) || planned.has(key)) continue;

      const settings = input.settingsByUser.get(userId) ?? defaultRecipientSettings();
      if (!settings.enabledKinds.includes(candidate.kind)) continue;
      if (settings.mutedChildIds.includes(candidate.childId)) continue;
      if (isInQuietHours(input.now, settings.quietStart, settings.quietEnd)) continue;

      planned.add(key);
      deliveries.push({ userId, candidate });
    }
  }

  return deliveries;
}
