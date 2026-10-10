import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { prisma, type PrismaClient } from "@baby-atlas/db";

export type TRPCContext = {
  prisma: PrismaClient;
  session: {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  } | null;
  headers: Headers;
};

export const createTRPCContext = async (opts: {
  headers: Headers;
  session?: TRPCContext["session"];
}): Promise<TRPCContext> => {
  return {
    prisma,
    session: opts.session ?? null,
    headers: opts.headers,
  };
};

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;

const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();
  const result = await next();
  const duration = Date.now() - start;

  if (duration > 1000) {
    console.log(`[TRPC] ${path} took ${duration}ms`);
  }

  return result;
});

export const publicProcedure = t.procedure.use(timingMiddleware);

const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(enforceUserIsAuthed);

// Helper to extract household ID from various input formats
async function resolveHouseholdId(
  prisma: TRPCContext["prisma"],
  input: { householdId?: string; childId?: string; id?: string }
): Promise<string | undefined> {
  // Direct householdId takes priority
  if (input.householdId) {
    return input.householdId;
  }

  // Check for childId first (explicit child reference)
  if (input.childId) {
    const child = await prisma.child.findUnique({
      where: { id: input.childId },
      select: { householdId: true },
    });
    if (child?.householdId) {
      return child.householdId;
    }
  }

  // For 'id' field, try as child first, then as household
  if (input.id) {
    // Try as child ID
    const child = await prisma.child.findUnique({
      where: { id: input.id },
      select: { householdId: true },
    });
    if (child?.householdId) {
      return child.householdId;
    }

    // Try as household ID directly (for routes like household.update)
    const household = await prisma.household.findUnique({
      where: { id: input.id },
      select: { id: true },
    });
    if (household) {
      return household.id;
    }
  }

  return undefined;
}

// Helper to get membership and validate access
async function validateHouseholdAccess(
  prisma: TRPCContext["prisma"],
  householdId: string,
  userId: string
) {
  const membership = await prisma.householdMember.findUnique({
    where: {
      householdId_userId: {
        householdId,
        userId,
      },
    },
  });

  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this household",
    });
  }

  return membership;
}

/**
 * Validates that the user is a member of the child's household and returns
 * the membership. Use this for mutations addressed by record id, where
 * householdProcedure cannot resolve the household from the input.
 * Pass `write: true` to also reject VIEWER members.
 */
export async function assertChildAccess(
  ctx: { prisma: TRPCContext["prisma"]; session: { user: { id: string } } },
  childId: string,
  opts: { write?: boolean } = {}
) {
  const child = await ctx.prisma.child.findUnique({
    where: { id: childId },
    select: { householdId: true },
  });
  if (!child) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Child not found" });
  }

  const membership = await validateHouseholdAccess(
    ctx.prisma,
    child.householdId,
    ctx.session.user.id
  );

  if (opts.write && membership.role === "VIEWER") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Viewers cannot change records",
    });
  }

  return membership;
}

// Create a procedure that validates household access using input
// (householdId, childId, or an id that is a child or household id).
// Fails closed: if no household can be resolved, the call is rejected.
// For inputs addressed by a record id, use recordProcedure instead.
// This approach works with tRPC v11's caller factory for testing
export const householdProcedure = protectedProcedure.use(
  async ({ ctx, next, getRawInput }) => {
    const rawInput = await getRawInput();
    const input = (rawInput ?? {}) as { householdId?: string; childId?: string; id?: string };

    const householdId = await resolveHouseholdId(ctx.prisma, input);

    if (!householdId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
    }

    const membership = await validateHouseholdAccess(
      ctx.prisma,
      householdId,
      ctx.session.user.id
    );

    return next({
      ctx: {
        ...ctx,
        householdId,
        memberRole: membership.role,
      },
    });
  }
);

type Prisma = TRPCContext["prisma"];

// Finds the child that owns a record, so access can be checked through the
// child's household.
const recordChildResolvers = {
  sleepRecord: (p: Prisma, id: string) =>
    p.sleepRecord.findUnique({ where: { id }, select: { childId: true } }),
  feedingRecord: (p: Prisma, id: string) =>
    p.feedingRecord.findUnique({ where: { id }, select: { childId: true } }),
  diaperRecord: (p: Prisma, id: string) =>
    p.diaperRecord.findUnique({ where: { id }, select: { childId: true } }),
  pumpingRecord: (p: Prisma, id: string) =>
    p.pumpingRecord.findUnique({ where: { id }, select: { childId: true } }),
  growthRecord: (p: Prisma, id: string) =>
    p.growthRecord.findUnique({ where: { id }, select: { childId: true } }),
  activityRecord: (p: Prisma, id: string) =>
    p.activityRecord.findUnique({ where: { id }, select: { childId: true } }),
  temperatureRecord: (p: Prisma, id: string) =>
    p.temperatureRecord.findUnique({ where: { id }, select: { childId: true } }),
  medicine: (p: Prisma, id: string) =>
    p.medicine.findUnique({ where: { id }, select: { childId: true } }),
  medicineRecord: async (p: Prisma, id: string) => {
    const record = await p.medicineRecord.findUnique({
      where: { id },
      select: { medicine: { select: { childId: true } } },
    });
    return record ? { childId: record.medicine.childId } : null;
  },
} satisfies Record<string, (p: Prisma, id: string) => Promise<{ childId: string } | null>>;

export type RecordModel = keyof typeof recordChildResolvers;

/**
 * A procedure for inputs addressed by a record id. Looks up the record's
 * child and validates household membership before the handler runs.
 * `idKey` names the input field holding the id (default "id").
 */
export function recordProcedure(model: RecordModel, idKey = "id") {
  return protectedProcedure.use(async ({ ctx, next, getRawInput }) => {
    const input = ((await getRawInput()) ?? {}) as Record<string, unknown>;
    const id = input[idKey];

    const record =
      typeof id === "string"
        ? await recordChildResolvers[model](ctx.prisma, id)
        : null;
    if (!record) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
    }

    const membership = await assertChildAccess(ctx, record.childId);

    return next({
      ctx: {
        ...ctx,
        householdId: membership.householdId,
        memberRole: membership.role,
      },
    });
  });
}
