"use client";

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { BookHeart, Plus } from "lucide-react";
import { JOURNAL_TAGS, JOURNAL_PAGE_SIZE, type JournalTagValue } from "@baby-atlas/schemas";
import { trpc } from "@/lib/trpc/provider";
import { sharedFreshness } from "@/lib/shared-freshness";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import type { ToddlerChild } from "@/components/dashboard/child-page";
import { ConfirmDialog } from "@/components/toddler/confirm-dialog";
import { useErrorToast } from "@/components/toddler/use-error-toast";
import { EntryCard } from "./entry-card";
import { EntrySheet } from "./entry-sheet";
import { groupByMonth, type JournalListItem } from "./journal-utils";
import { TagFilterChips } from "./tag-chips";

type SheetState = { mode: "closed" } | { mode: "create" } | { mode: "edit"; entry: JournalListItem };

export function JournalView({ child }: { child: ToddlerChild }) {
  const t = useTranslations("journal");
  const tc = useTranslations("common");
  const format = useFormatter();
  const { toast } = useToast();
  const onError = useErrorToast(t("errors.title"));
  const utils = trpc.useUtils();

  const [selected, setSelected] = useState<ReadonlySet<JournalTagValue>>(new Set());
  const [sheet, setSheet] = useState<SheetState>({ mode: "closed" });
  const [deleting, setDeleting] = useState<JournalListItem | null>(null);

  // Tags in a fixed order keep the query key stable however the user taps
  const tags = useMemo(() => JOURNAL_TAGS.filter((tag) => selected.has(tag)), [selected]);

  const list = trpc.journal.list.useInfiniteQuery(
    { childId: child.id, tags: tags.length > 0 ? tags : undefined, limit: JOURNAL_PAGE_SIZE },
    { getNextPageParam: (page) => page.nextCursor, ...sharedFreshness }
  );

  const remove = trpc.journal.delete.useMutation({
    onSuccess: async () => {
      await utils.journal.list.invalidate({ childId: child.id });
      toast({ title: t("delete.deleted") });
      setDeleting(null);
    },
    onError,
  });

  const entries = useMemo(
    () => list.data?.pages.flatMap((page) => page.items) ?? [],
    [list.data]
  );
  const canWrite = list.data?.pages[0]?.canWrite ?? false;
  const groups = useMemo(() => groupByMonth(entries), [entries]);

  const toggleTag = (tag: JournalTagValue) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });

  return (
    <div className="space-y-6">
      <TagFilterChips selected={selected} onToggle={toggleTag} onClear={() => setSelected(new Set())} />

      {list.isLoading ? (
        <div className="animate-pulse py-8 text-center text-muted-foreground" aria-busy="true">
          {tc("loading")}
        </div>
      ) : list.isError ? (
        <div className="space-y-3 py-8 text-center">
          <p className="text-muted-foreground">{t("loadError")}</p>
          <Button variant="outline" className="min-h-12" onClick={() => void list.refetch()}>
            {t("retry")}
          </Button>
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          filtered={tags.length > 0}
          canWrite={canWrite}
          onWrite={() => setSheet({ mode: "create" })}
        />
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`journal-month-${group.key}`} className="space-y-3">
              <h2
                id={`journal-month-${group.key}`}
                className="font-display text-xl font-semibold first-letter:uppercase"
              >
                {format.dateTime(group.month, { month: "long", year: "numeric", timeZone: "UTC" })}
              </h2>
              <ul className="space-y-3">
                {group.items.map((entry) => (
                  <li key={entry.id}>
                    <EntryCard
                      entry={entry}
                      onEdit={(item) => setSheet({ mode: "edit", entry: item })}
                      onDelete={setDeleting}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {list.hasNextPage && (
            <Button
              variant="outline"
              className="min-h-12 w-full"
              disabled={list.isFetchingNextPage}
              onClick={() => void list.fetchNextPage()}
            >
              {t("loadMore")}
            </Button>
          )}
        </div>
      )}

      {canWrite && (
        <Button
          type="button"
          size="xl"
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 h-14 rounded-full px-6 shadow-lg"
          onClick={() => setSheet({ mode: "create" })}
        >
          <Plus className="!size-5" aria-hidden />
          {t("newEntry")}
        </Button>
      )}

      {sheet.mode !== "closed" && (
        <EntrySheet
          key={sheet.mode === "edit" ? sheet.entry.id : "new"}
          childId={child.id}
          entry={sheet.mode === "edit" ? sheet.entry : undefined}
          onClose={() => setSheet({ mode: "closed" })}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={t("delete.title")}
        description={t("delete.description")}
        pending={remove.isPending}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={() => deleting && remove.mutate({ id: deleting.id })}
      />
    </div>
  );
}

function EmptyState({
  filtered,
  canWrite,
  onWrite,
}: {
  filtered: boolean;
  canWrite: boolean;
  onWrite: () => void;
}) {
  const t = useTranslations("journal.empty");
  const tj = useTranslations("journal");

  if (filtered) {
    return <p className="py-10 text-center text-muted-foreground">{t("filtered")}</p>;
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-primary">
        <BookHeart className="h-7 w-7" aria-hidden />
      </span>
      <h2 className="font-display text-xl font-semibold">{t("title")}</h2>
      <p className="max-w-xs text-muted-foreground">
        {canWrite ? t("description") : t("descriptionViewer")}
      </p>
      {canWrite && (
        <Button className="mt-1 min-h-12" onClick={onWrite}>
          <Plus aria-hidden />
          {tj("newEntry")}
        </Button>
      )}
    </div>
  );
}
