"use client";

import { useEffect, useState } from "react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Hourglass } from "lucide-react";
import { parseFixTimerParam, timerRecordType } from "@baby-atlas/utils";
import { Button } from "@/components/ui/button";
import { useRunningTimers, type RunningTimer } from "@/hooks/use-running-timers";
import { useToast } from "@/hooks/use-toast";
import { useFormatters } from "@/lib/format";
import { browserStorage } from "@/lib/support/browser-storage";
import {
  pruneTimerFixDismissals,
  readTimerFixDismissals,
  writeTimerFixDismissals,
  type TimerFixDismissals,
} from "@/lib/support/timer-fix-dismissed";
import { FixTimerDialog } from "./fix-timer-dialog";
import { HIDDEN_CARD, type SupportCardProps, type SupportCardState } from "./types";

/**
 * Banners for timers that have run much longer than usual, with "Set end
 * time" and "Still going". A timer at twice its threshold is the urgent card,
 * one past the threshold is a regular card. Also opens the end time dialog
 * for a link from a notification (`?fixTimer=<type>:<recordId>`); the dialog
 * is the `overlay` of the regular card. Needs a Suspense boundary
 * (useSearchParams).
 */
export function useTimerFixCards({ childId }: SupportCardProps): {
  urgent: SupportCardState;
  regular: SupportCardState;
} {
  const t = useTranslations("support.timerFix");
  const { toast } = useToast();
  const { timers: runningTimers, now, canEdit } = useRunningTimers(childId);
  // Viewers cannot stop timers, so the card has nothing to offer them
  const timers = canEdit ? runningTimers : undefined;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The home screen remounts this per child, so the saved answers are read once
  const [dismissed, setDismissed] = useState<TimerFixDismissals>(() =>
    readTimerFixDismissals(browserStorage(), new Date())
  );
  const [fixing, setFixing] = useState<string | null>(null);
  const [target, setTarget] = useState<{ type: string; recordId: string } | null>(null);

  // Take the notification link's target and clean the address bar
  const fixTimerParam = searchParams.get("fixTimer");
  useEffect(() => {
    if (fixTimerParam === null) return;
    const parsed = parseFixTimerParam(fixTimerParam);
    if (parsed) setTarget(parsed);
    const rest = new URLSearchParams(searchParams.toString());
    rest.delete("fixTimer");
    const query = rest.toString();
    router.replace((query ? `${pathname}?${query}` : pathname) as Route, { scroll: false });
  }, [fixTimerParam, searchParams, pathname, router]);

  // Open the dialog once the running timers are known
  useEffect(() => {
    if (!target || !timers) return;
    const match = timers.find(
      (timer) => timer.recordId === target.recordId && timerRecordType(timer.kind) === target.type
    );
    if (match) setFixing(match.recordId);
    else toast({ title: t("toast.alreadyEnded") });
    setTarget(null);
  }, [target, timers, toast, t]);

  // Forget answers for timers that have ended
  useEffect(() => {
    if (!timers) return;
    const kept = pruneTimerFixDismissals(dismissed, new Set(timers.map((timer) => timer.recordId)));
    if (Object.keys(kept).length !== Object.keys(dismissed).length) {
      setDismissed(kept);
      writeTimerFixDismissals(browserStorage(), kept);
    }
  }, [timers, dismissed]);

  const stillGoing = (timer: RunningTimer) => {
    const next = {
      ...dismissed,
      [timer.recordId]: { tier: timer.tier, at: new Date().toISOString() },
    };
    setDismissed(next);
    writeTimerFixDismissals(browserStorage(), next);
  };

  const forgotten = (timers ?? []).filter(
    (timer) => timer.tier > 0 && (dismissed[timer.recordId]?.tier ?? 0) < timer.tier
  );
  const fixingTimer = timers?.find((timer) => timer.recordId === fixing) ?? null;

  const group = (urgent: boolean): SupportCardState => {
    const shown = forgotten.filter((timer) => (timer.tier === 2) === urgent);
    if (shown.length === 0) return HIDDEN_CARD;
    return {
      visible: true,
      urgent,
      element: (
        <>
          {shown.map((timer) => (
            <TimerBanner
              key={timer.recordId}
              timer={timer}
              now={now}
              onFix={() => setFixing(timer.recordId)}
              onStillGoing={() => stillGoing(timer)}
            />
          ))}
        </>
      ),
    };
  };

  const overlay = fixingTimer ? (
    <FixTimerDialog
      key={fixingTimer.recordId}
      childId={childId}
      timer={fixingTimer}
      onClose={() => setFixing(null)}
    />
  ) : undefined;

  return { urgent: group(true), regular: { ...group(false), overlay } };
}

function TimerBanner({
  timer,
  now,
  onFix,
  onStillGoing,
}: {
  timer: RunningTimer;
  now: Date;
  onFix: () => void;
  onStillGoing: () => void;
}) {
  const t = useTranslations("support.timerFix");
  const { dateTime, duration } = useFormatters();
  const minutes = (now.getTime() - timer.startTime.getTime()) / 60_000;
  return (
    <section
      aria-labelledby={`timer-fix-${timer.recordId}`}
      className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-50"
    >
      <div className="flex items-start gap-3">
        <Hourglass className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <h2 id={`timer-fix-${timer.recordId}`} className="font-semibold leading-tight">
            {t("title")}
          </h2>
          <p className="text-sm">
            {t("description", {
              type: t(`type.${timer.key}`),
              start: dateTime(timer.startTime),
              duration: duration(minutes),
            })}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button type="button" onClick={onFix}>
          {t("actions.setEndTime")}
        </Button>
        <Button type="button" variant="outline" className="bg-transparent" onClick={onStillGoing}>
          {t("actions.stillGoing")}
        </Button>
      </div>
    </section>
  );
}
