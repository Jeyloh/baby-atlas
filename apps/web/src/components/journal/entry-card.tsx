"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { JournalListItem } from "./journal-utils";
import { PhotoGrid } from "./photo-grid";
import { PhotoViewer } from "./photo-viewer";
import { TagBadge } from "./tag-chips";

export function EntryCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: JournalListItem;
  onEdit: (entry: JournalListItem) => void;
  onDelete: (entry: JournalListItem) => void;
}) {
  const t = useTranslations("journal.entry");
  const format = useFormatter();
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  // Only offer "Vis mer" when the clamp actually hides something
  useLayoutEffect(() => {
    const element = textRef.current;
    if (element && !expanded) setOverflows(element.scrollHeight > element.clientHeight + 1);
  }, [entry.text, expanded]);

  return (
    <article className="space-y-3 rounded-2xl border bg-card p-4 text-card-foreground">
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <time dateTime={entry.date.toISOString().slice(0, 10)} className="font-display text-lg font-semibold leading-tight">
              {format.dateTime(entry.date, {
                weekday: "short",
                day: "numeric",
                month: "short",
                timeZone: "UTC",
              })}
            </time>
            <p className="truncate text-sm text-muted-foreground">
              {entry.authorName ? t("by", { name: entry.authorName }) : t("unknownAuthor")}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {entry.tags.map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>
        </div>

        {entry.canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-lg"
                className="-mr-2 -mt-2 h-12 w-12 shrink-0 rounded-full"
                aria-label={t("menu")}
              >
                <MoreVertical className="!size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              <DropdownMenuItem className="min-h-12 gap-2 text-base" onSelect={() => onEdit(entry)}>
                <Pencil className="h-4 w-4" aria-hidden />
                {t("edit")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-h-12 gap-2 text-base text-destructive focus:text-destructive"
                onSelect={() => onDelete(entry)}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                {t("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      <div>
        <p
          ref={textRef}
          className={cn("whitespace-pre-wrap break-words text-base leading-relaxed", !expanded && "line-clamp-6")}
        >
          {entry.text}
        </p>
        {(overflows || expanded) && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="-ml-3 min-h-12 rounded-full px-3 text-sm font-medium text-primary hover:bg-muted"
          >
            {expanded ? t("showLess") : t("showMore")}
          </button>
        )}
      </div>

      <PhotoGrid photos={entry.photos} onOpen={setViewerIndex} />

      {viewerIndex !== null && (
        <PhotoViewer
          photos={entry.photos}
          startIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </article>
  );
}
