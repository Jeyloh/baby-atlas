import {
  HELSESTASJON_PROGRAMME,
  formatOsloTime,
  isBookedReminderDue,
  isSameDayReminderDue,
  isTimeToBook,
} from "@baby-atlas/utils";
import type { Candidate, EvaluatorContext } from "../types";
import { loadChildrenForCheckups } from "./checkup-data";

type ChildRow = Awaited<ReturnType<typeof loadChildrenForCheckups>>[number];

/**
 * Pure part: the notices for one child at `now`. A booked appointment tomorrow
 * (from 17:00 Oslo the day before, once per booked time), and "time to book"
 * once when an age window is open and nothing is booked or done.
 */
export function checkupCandidates(child: ChildRow, now: Date): Candidate[] {
  const url = `/dashboard/${child.id}/vaccines?tab=checkups`;
  const candidates: Candidate[] = [];

  for (const contact of HELSESTASJON_PROGRAMME) {
    const record = child.checkupRecords.find((r) => r.checkupKey === contact.key);

    const scheduledAt = record?.scheduledAt;
    if (scheduledAt && !record.completedAt) {
      // One notice per booked time: the evening before, or on the day itself
      // when that one was missed. Both share a dedupeKey.
      const evening = isBookedReminderDue(scheduledAt, now);
      if (evening || isSameDayReminderDue(scheduledAt, now)) {
        candidates.push({
          kind: "CHECKUP_REMINDER",
          childId: child.id,
          dedupeKey: `checkup:booked:${child.id}:${contact.key}:${scheduledAt.getTime()}`,
          url,
          titleKey: evening
            ? "push.checkupReminder.booked.title"
            : "push.checkupReminder.today.title",
          bodyKey: evening ? "push.checkupReminder.booked.body" : "push.checkupReminder.today.body",
          params: { child: child.name, time: formatOsloTime(scheduledAt) },
          replaceKey: `checkup:${child.id}:${contact.key}`,
        });
      }
    } else if (isTimeToBook(contact, child.birthDate, record, now)) {
      candidates.push({
        kind: "CHECKUP_REMINDER",
        childId: child.id,
        dedupeKey: `checkup:book:${child.id}:${contact.key}`,
        url,
        titleKey: "push.checkupReminder.book.title",
        bodyKey: "push.checkupReminder.book.body",
        params: { child: child.name },
        replaceKey: `checkup:${child.id}:${contact.key}`,
      });
    }
  }
  return candidates;
}

export async function evaluate(ctx: EvaluatorContext): Promise<Candidate[]> {
  const { now } = ctx;
  const children = await loadChildrenForCheckups(ctx);
  return children.flatMap((child) => checkupCandidates(child, now));
}
