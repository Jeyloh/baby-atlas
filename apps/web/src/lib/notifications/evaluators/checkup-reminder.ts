import {
  HELSESTASJON_PROGRAMME,
  formatOsloTime,
  isBookedReminderDue,
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

    if (record?.scheduledAt && !record.completedAt && isBookedReminderDue(record.scheduledAt, now)) {
      candidates.push({
        kind: "CHECKUP_REMINDER",
        childId: child.id,
        dedupeKey: `checkup:booked:${child.id}:${contact.key}:${record.scheduledAt.getTime()}`,
        url,
        titleKey: "push.checkupReminder.booked.title",
        bodyKey: "push.checkupReminder.booked.body",
        params: { child: child.name, time: formatOsloTime(record.scheduledAt) },
        replaceKey: `checkup:${child.id}:${contact.key}`,
      });
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

export async function evaluate({ prisma, now }: EvaluatorContext): Promise<Candidate[]> {
  const children = await loadChildrenForCheckups(prisma, now);
  return children.flatMap((child) => checkupCandidates(child, now));
}
