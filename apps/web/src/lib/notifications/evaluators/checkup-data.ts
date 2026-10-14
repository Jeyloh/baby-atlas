import type { PrismaClient } from "@baby-atlas/db";

/** Only the first three years matter, plus a margin for the last window. */
const MAX_AGE_DAYS = 800;

/**
 * Children up to about three years old that belong to a household where at
 * least one member has a push subscription, with the records the checkup and
 * vaccine evaluators need.
 */
export async function loadChildrenForCheckups(prisma: PrismaClient, now: Date) {
  const oldest = new Date(now.getTime() - MAX_AGE_DAYS * 86_400_000);
  return prisma.child.findMany({
    where: {
      birthDate: { gte: oldest },
      household: { members: { some: { user: { pushSubscriptions: { some: {} } } } } },
    },
    select: {
      id: true,
      name: true,
      birthDate: true,
      checkupRecords: { select: { checkupKey: true, scheduledAt: true, completedAt: true } },
      vaccinationRecords: { select: { vaccineKey: true } },
    },
  });
}
