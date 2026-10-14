import type { PrismaClient } from "@baby-atlas/db";
import type { NotificationKind } from "../types";

export interface EligibleChild {
  id: string;
  name: string;
  birthDate: Date;
}

/**
 * Children that could produce a notice of this kind: at least one household
 * member who is not a viewer has a push subscription and has switched the
 * kind on. Evaluators for opt-in kinds start here so they only read records
 * for children somebody will actually be told about. The dispatcher still
 * filters per recipient (muted child, quiet hours).
 */
export async function findEligibleChildren(
  prisma: PrismaClient,
  kind: NotificationKind
): Promise<EligibleChild[]> {
  return prisma.child.findMany({
    where: {
      household: {
        members: {
          some: {
            role: { not: "VIEWER" },
            user: {
              pushSubscriptions: { some: {} },
              notificationSettings: { is: { enabledKinds: { has: kind } } },
            },
          },
        },
      },
    },
    select: { id: true, name: true, birthDate: true },
  });
}
