import { TRPCError } from "@trpc/server";
import {
  listJournalSchema,
  createJournalEntrySchema,
  updateJournalEntrySchema,
  deleteJournalEntrySchema,
  deleteJournalPhotoSchema,
  reorderJournalPhotosSchema,
} from "@baby-atlas/schemas";
import { canEditJournalEntry, journalThumbKey } from "@baby-atlas/utils";
import {
  createTRPCRouter,
  householdProcedure,
  recordProcedure,
  type TRPCContext,
} from "../trpc";

type Role = Parameters<typeof canEditJournalEntry>[0];

function assertCanEdit(role: Role, authorId: string | null, userId: string) {
  if (!canEditJournalEntry(role, authorId, userId)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        role === "VIEWER"
          ? "Viewers cannot change the journal"
          : "Only the author, owners and admins can change this entry",
    });
  }
}

/**
 * The database rows are already gone when this runs. A storage failure must
 * not fail the request, so it is logged and the files are left for cleanup.
 */
async function removeStoredFiles(ctx: Pick<TRPCContext, "storage">, photoKeys: string[]) {
  const keys = photoKeys.flatMap((key) => [key, journalThumbKey(key)]);
  const results = await Promise.allSettled(keys.map((key) => ctx.storage.delete(key)));
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`[journal] could not delete stored file ${keys[index]}`, result.reason);
    }
  });
}

export const journalRouter = createTRPCRouter({
  list: householdProcedure.input(listJournalSchema).query(async ({ ctx, input }) => {
    const rows = await ctx.prisma.journalEntry.findMany({
      where: {
        childId: input.childId,
        ...(input.tags?.length && { tags: { hasSome: input.tags } }),
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
      ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
      select: {
        id: true,
        date: true,
        text: true,
        tags: true,
        authorId: true,
        createdAt: true,
        updatedAt: true,
        author: { select: { name: true, email: true } },
        photos: {
          orderBy: { position: "asc" },
          select: { id: true, width: true, height: true, sizeBytes: true },
        },
      },
    });

    const page = rows.slice(0, input.limit);
    const next = rows[input.limit];

    return {
      canWrite: ctx.memberRole !== "VIEWER",
      items: page.map(({ author, authorId, ...entry }) => ({
        ...entry,
        authorName: author?.name ?? author?.email ?? null,
        canEdit: canEditJournalEntry(ctx.memberRole, authorId, ctx.session.user.id),
      })),
      nextCursor: next ? page[page.length - 1]?.id : undefined,
    };
  }),

  create: householdProcedure.input(createJournalEntrySchema).mutation(async ({ ctx, input }) => {
    if (ctx.memberRole === "VIEWER") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Viewers cannot write in the journal" });
    }

    return ctx.prisma.journalEntry.create({
      data: {
        childId: input.childId,
        authorId: ctx.session.user.id,
        date: input.date,
        text: input.text,
        tags: input.tags,
      },
      select: { id: true },
    });
  }),

  update: recordProcedure("journalEntry")
    .input(updateJournalEntrySchema)
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.prisma.journalEntry.findUnique({
        where: { id: input.id },
        select: { authorId: true },
      });
      if (!entry) throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
      assertCanEdit(ctx.memberRole, entry.authorId, ctx.session.user.id);

      return ctx.prisma.journalEntry.update({
        where: { id: input.id },
        data: { date: input.date, text: input.text, tags: input.tags },
        select: { id: true },
      });
    }),

  delete: recordProcedure("journalEntry")
    .input(deleteJournalEntrySchema)
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.prisma.journalEntry.findUnique({
        where: { id: input.id },
        select: { authorId: true, photos: { select: { storageKey: true } } },
      });
      if (!entry) throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
      assertCanEdit(ctx.memberRole, entry.authorId, ctx.session.user.id);

      await ctx.prisma.journalEntry.delete({ where: { id: input.id } });
      await removeStoredFiles(ctx, entry.photos.map((photo) => photo.storageKey));

      return { success: true };
    }),

  deletePhoto: recordProcedure("journalPhoto", "photoId")
    .input(deleteJournalPhotoSchema)
    .mutation(async ({ ctx, input }) => {
      const photo = await ctx.prisma.journalPhoto.findUnique({
        where: { id: input.photoId },
        select: { storageKey: true, entry: { select: { authorId: true } } },
      });
      if (!photo) throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
      assertCanEdit(ctx.memberRole, photo.entry.authorId, ctx.session.user.id);

      await ctx.prisma.journalPhoto.delete({ where: { id: input.photoId } });
      await removeStoredFiles(ctx, [photo.storageKey]);

      return { success: true };
    }),

  reorderPhotos: recordProcedure("journalEntry", "entryId")
    .input(reorderJournalPhotosSchema)
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.prisma.journalEntry.findUnique({
        where: { id: input.entryId },
        select: { authorId: true, photos: { select: { id: true } } },
      });
      if (!entry) throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
      assertCanEdit(ctx.memberRole, entry.authorId, ctx.session.user.id);

      const existing = new Set(entry.photos.map((photo) => photo.id));
      const requested = new Set(input.photoIds);
      const sameSet =
        requested.size === input.photoIds.length &&
        requested.size === existing.size &&
        input.photoIds.every((id) => existing.has(id));
      if (!sameSet) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The photo list must contain exactly the photos of this entry",
        });
      }

      await ctx.prisma.$transaction(
        input.photoIds.map((id, position) =>
          ctx.prisma.journalPhoto.update({ where: { id }, data: { position } })
        )
      );

      return { success: true };
    }),
});
