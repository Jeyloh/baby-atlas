import type { EvaluatorContext } from "../types";

/** Only the first three years matter, plus a margin for the last window. */
const MAX_AGE_DAYS = 800;

/**
 * Children up to about three years old that belong to a household where at
 * least one member has a push subscription, with the records the checkup and
 * vaccine evaluators need.
 */
async function queryChildren({ prisma, now }: EvaluatorContext) {
  const oldest = new Date(now.getTime() - MAX_AGE_DAYS * 86_400_000);
  return prisma.child.findMany({
    where: {
      birthDate: { gte: oldest },
      household: {
        members: {
          some: { role: { not: "VIEWER" }, user: { pushSubscriptions: { some: {} } } },
        },
      },
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

const MEMO_KEY = "checkup-children";

/** Loaded once per dispatcher run: the checkup and vaccine evaluators share the memo. */
export function loadChildrenForCheckups(ctx: EvaluatorContext): ReturnType<typeof queryChildren> {
  if (!ctx.memo) return queryChildren(ctx);
  let loaded = ctx.memo.get(MEMO_KEY) as ReturnType<typeof queryChildren> | undefined;
  if (!loaded) {
    loaded = queryChildren(ctx);
    ctx.memo.set(MEMO_KEY, loaded);
  }
  return loaded;
}
