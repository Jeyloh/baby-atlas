import { TRPCError } from "@trpc/server";

/**
 * Use as `.catch(rethrowIfAlreadyEnded)` on an update filtered by
 * `endTime: null`. Prisma throws P2025 when no row matched, which here means
 * the timer was already stopped (for example by another caregiver).
 */
export function rethrowIfAlreadyEnded(error: unknown): never {
  if ((error as { code?: unknown } | null)?.code === "P2025") {
    throw new TRPCError({ code: "CONFLICT", message: "Already ended" });
  }
  throw error;
}
