import { prisma } from "@baby-atlas/db";
import { isPremiumAccount } from "@baby-atlas/api";

// RevenueCat (iOS) or Stripe (web) should later set User.isPremium via webhook.
// Until payments exist, PREMIUM_EMAILS (comma-separated) grants Premium for testing.
export async function checkUserSubscription(
  userId: string
): Promise<{ isPremium: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPremium: true, email: true },
  });

  return { isPremium: user ? isPremiumAccount(user) : false };
}
