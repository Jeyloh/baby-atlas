"use client";

import { useTranslations } from "next-intl";
import { JOURNAL_TAGS, type JournalTagValue } from "@baby-atlas/schemas";
import { journalTags } from "@/lib/journal-tags";
import { cn } from "@/lib/utils";

/** A small read-only tag on an entry card. */
export function TagBadge({ tag }: { tag: JournalTagValue }) {
  const t = useTranslations("journal.tags");
  const { icon: Icon, tint } = journalTags[tag];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        tint
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {t(tag)}
    </span>
  );
}

/** A tag button with a 48 px touch target. Selected tags use the solid color. */
function TagButton({
  tag,
  selected,
  onToggle,
  disabled,
}: {
  tag: JournalTagValue;
  selected: boolean;
  onToggle: (tag: JournalTagValue) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("journal.tags");
  const { icon: Icon, solid, iconColor } = journalTags[tag];
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => onToggle(tag)}
      className={cn(
        "flex min-h-12 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
        selected ? cn("border-transparent", solid) : "bg-card hover:bg-muted"
      )}
    >
      <Icon className={cn("h-4 w-4", !selected && iconColor)} aria-hidden />
      {t(tag)}
    </button>
  );
}

/**
 * Multi-select tags that filter the timeline. Tap to show only that tag, tap
 * more to combine, "Vis alt" to clear. Same pattern as the day filters.
 */
export function TagFilterChips({
  selected,
  onToggle,
  onClear,
}: {
  selected: ReadonlySet<JournalTagValue>;
  onToggle: (tag: JournalTagValue) => void;
  onClear: () => void;
}) {
  const t = useTranslations("journal.filters");

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {selected.size === 0 ? t("hint") : t("filtered", { count: selected.size })}
        </p>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="-mr-2 min-h-12 rounded-full px-3 text-sm font-medium text-primary hover:bg-muted"
          >
            {t("showAll")}
          </button>
        )}
      </div>

      {/* Full-bleed horizontal scroller on phones, wraps on wider screens */}
      <div
        role="group"
        aria-label={t("label")}
        className="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {JOURNAL_TAGS.map((tag) => (
          <div key={tag} className="snap-start">
            <TagButton tag={tag} selected={selected.has(tag)} onToggle={onToggle} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** The tag picker in the entry sheet. */
export function TagToggles({
  value,
  onToggle,
  disabled,
}: {
  value: ReadonlySet<JournalTagValue>;
  onToggle: (tag: JournalTagValue) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {JOURNAL_TAGS.map((tag) => (
        <TagButton
          key={tag}
          tag={tag}
          selected={value.has(tag)}
          onToggle={onToggle}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
