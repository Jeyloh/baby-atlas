import type { PrismaClient } from "@baby-atlas/db";

/** A user keeps at most this many devices; registering another drops the oldest. */
export const MAX_SUBSCRIPTIONS_PER_USER = 10;

interface SubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}

/**
 * Stores a browser's push subscription for a user. A browser profile that
 * signs in as someone else keeps one endpoint, so an existing row is moved to
 * the new user. Registering counts as the newest device; the oldest ones
 * beyond the cap are removed.
 */
export async function storePushSubscription(
  prisma: PrismaClient,
  userId: string,
  input: SubscriptionInput
) {
  const fields = {
    userId,
    p256dh: input.keys.p256dh,
    auth: input.keys.auth,
    userAgent: input.userAgent ?? null,
    failureCount: 0,
    createdAt: new Date(),
  };

  await prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: { endpoint: input.endpoint, ...fields },
    update: fields,
  });

  const excess = await prisma.pushSubscription.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    skip: MAX_SUBSCRIPTIONS_PER_USER,
    select: { id: true },
  });
  if (excess.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { id: { in: excess.map((row) => row.id) }, userId },
    });
  }
}
