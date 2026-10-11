import { TRPCError } from "@trpc/server";

/**
 * Offline clients pick the id of a new record and resend the create until a
 * response gets through. When the first attempt was stored but its response
 * was lost, the retry finds the stored record and returns it instead of
 * creating a duplicate or failing on an active timer. An id that belongs to
 * another child is rejected.
 */
export async function findReplayedRecord<T extends { childId: string }>(
  recordId: string | undefined,
  childId: string,
  find: (id: string) => Promise<T | null>
): Promise<T | null> {
  if (!recordId) return null;
  const existing = await find(recordId);
  if (existing && existing.childId !== childId) {
    throw new TRPCError({ code: "CONFLICT", message: "Record id already in use" });
  }
  return existing;
}
