"use client";

import { Fragment, Suspense, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { arrangeCards, type SupportEntry } from "./arrange-cards";
import { useHandoverCard } from "./handover-card";
import { useHealthHintsCards } from "./health-hints-card";
import { useMedicineStatusCard } from "./medicine-status-card";
import { useTimerFixCards } from "./timer-fix-card";
import type { SupportCardProps } from "./types";
import { useWeeklyTipCard } from "./weekly-tip-card";
import { useWellbeingCard } from "./wellbeing-card";
import { useWhatsNextCard } from "./whats-next-card";

/**
 * The cards under the home screen's latest activity that help the parents: a
 * forgotten timer, health hints, what comes next, medicine status, handover,
 * the weekly tip and wellbeing. Every card decides in its own hook whether it
 * has something to say; this arranges them. Urgent cards (an urgent health
 * hint, a timer at twice its limit) come first. Then at most three others in
 * a fixed order, the rest behind a toggle, and one soft card last.
 */
export function SupportCards(props: SupportCardProps) {
  return (
    // useSearchParams (timer link) needs a Suspense boundary. The key resets
    // the cards' saved state when the child changes.
    <Suspense fallback={null}>
      <SupportCardList key={props.childId} {...props} />
    </Suspense>
  );
}

function SupportCardList(props: SupportCardProps) {
  const t = useTranslations("support.cards");
  const [expanded, setExpanded] = useState(false);

  const hints = useHealthHintsCards(props);
  const timers = useTimerFixCards(props);
  const entries: SupportEntry[] = [
    { id: "hints-urgent", card: hints.urgent },
    { id: "timer-urgent", card: timers.urgent },
    { id: "handover", card: useHandoverCard(props) },
    { id: "timer", card: timers.regular },
    { id: "medicine", card: useMedicineStatusCard(props) },
    { id: "whats-next", card: useWhatsNextCard(props) },
    { id: "hints", card: hints.regular },
    { id: "wellbeing", soft: true, card: useWellbeingCard() },
    { id: "tip", soft: true, card: useWeeklyTipCard(props) },
  ];

  const { urgent, shown, extra, soft } = arrangeCards(entries);
  const renderEntry = (entry: SupportEntry) => <div key={entry.id}>{entry.card.element}</div>;

  return (
    <>
      <div className="space-y-3 empty:hidden">
        {urgent.map(renderEntry)}
        {shown.map(renderEntry)}
        {expanded && extra.map(renderEntry)}
        {extra.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 w-full text-muted-foreground"
            aria-expanded={expanded}
            onClick={() => setExpanded((open) => !open)}
          >
            {expanded ? t("showLess") : t("showMore", { count: extra.length })}
            <ChevronDown
              className={expanded ? "ml-1 h-4 w-4 rotate-180" : "ml-1 h-4 w-4"}
              aria-hidden
            />
          </Button>
        )}
        {soft && renderEntry(soft)}
      </div>
      {/* Dialogs opened from a link must exist whatever the card list shows */}
      {entries.map((entry) => (
        <Fragment key={entry.id}>{entry.card.overlay}</Fragment>
      ))}
    </>
  );
}
