import { TRPCError } from "@trpc/server";
import { protectedProcedure, type TRPCContext } from "./trpc";

export const PREMIUM_REQUIRED_MESSAGE = "premium_required";

function parseEmailList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isPremiumAccount(
  user: { isPremium: boolean; email?: string | null },
  premiumEmails: string | undefined = process.env.PREMIUM_EMAILS
): boolean {
  if (user.isPremium) return true;
  if (!user.email) return false;
  return parseEmailList(premiumEmails).includes(user.email.toLowerCase());
}

export async function assertPremium(ctx: {
  prisma: TRPCContext["prisma"];
  session: { user: { id: string } };
}) {
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.session.user.id },
    select: { isPremium: true, email: true },
  });

  if (!user || !isPremiumAccount(user)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: PREMIUM_REQUIRED_MESSAGE,
    });
  }
}

export const premiumProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  await assertPremium(ctx);
  return next();
});
