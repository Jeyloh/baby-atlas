"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, Lightbulb, X } from "lucide-react";
import { tipKeyForAge } from "@baby-atlas/utils";
import { useStoredValue } from "@/hooks/use-stored-value";
import { tipDismissKey } from "@/lib/support/tip-dismissed";
import { HIDDEN_CARD, type SupportCardProps, type SupportCardState } from "./types";

/** The tip for the child's age this week. Dismissal is remembered per child and tip. */
export function useWeeklyTipCard({ childId, birthDate }: SupportCardProps): SupportCardState {
  const tipKey = tipKeyForAge(birthDate, new Date());
  const [dismissedAt, setDismissedAt] = useStoredValue(
    tipKey ? tipDismissKey(childId, tipKey) : undefined
  );

  if (!tipKey || dismissedAt !== null) return HIDDEN_CARD;
  return {
    visible: true,
    urgent: false,
    element: (
      <WeeklyTip tipKey={tipKey} onDismiss={() => setDismissedAt(new Date().toISOString())} />
    ),
  };
}

export function WeeklyTipCard(props: SupportCardProps) {
  return useWeeklyTipCard(props).element;
}

function WeeklyTip({ tipKey, onDismiss }: { tipKey: string; onDismiss: () => void }) {
  const t = useTranslations("tips");
  const headingId = useId();

  const [kind, index] = tipKey.split(".") as ["week" | "month", string];
  const age = kind === "week" ? t("card.weekLabel", { n: index }) : t("card.monthLabel", { n: index });
  // Keys are built from the child's age, so they are not in the typed key union
  const text = t as unknown as (key: string) => string;

  return (
    <aside
      aria-labelledby={headingId}
      className="flex items-start gap-3 rounded-2xl border bg-card p-4 text-card-foreground"
    >
      <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-medium text-muted-foreground">
          {t("card.label")} · {age}
        </p>
        <h2 id={headingId} className="font-semibold leading-tight">
          {text(`${tipKey}.title`)}
        </h2>
        <p className="text-sm text-muted-foreground">{text(`${tipKey}.body`)}</p>
        <a
          href={text(`${tipKey}.url`)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("card.readMore")}
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("card.dismiss")}
        title={t("card.dismiss")}
        className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-5 w-5" />
      </button>
    </aside>
  );
}
