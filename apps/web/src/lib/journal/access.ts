import { prisma } from "@baby-atlas/db";

/** The user's membership in the child's household, or null when there is none. */
export async function getChildMembership(userId: string, childId: string) {
  const child = await prisma.child.findUnique({
    where: { id: childId },
    select: { householdId: true },
  });
  if (!child) return null;

  return prisma.householdMember.findUnique({
    where: { householdId_userId: { householdId: child.householdId, userId } },
  });
}
