"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Hourglass } from "lucide-react";
import { endTimeProblem, parseFixTimerParam, suggestedEndTime, timerRecordType } from "@baby-atlas/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimerAlreadyEndedError, useFixTimer } from "@/hooks/use-fix-timer";
import { useRunningTimers, type RunningTimer } from "@/hooks/use-running-timers";
import { useToast } from "@/hooks/use-toast";
import { useFormatters } from "@/lib/format";
import type { SupportCardProps } from "./types";

const DISMISSED_KEY = "baby-atlas-timer-fix-dismissed";

/** "Still going" answers: record id -> the tier that was dismissed. A higher tier shows the card again. */
function readDismissed(): Record<string, number> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function writeDismissed(value: Record<string, number>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the card simply shows again
  }
}

/** Value of a datetime-local input for a date, in the device's time zone. */
function toInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * A banner for a timer that has run much longer than usual, with "Set end
 * time" and "Still going". Also opens the end time dialog for a link from a
 * notification (`?fixTimer=<type>:<recordId>`).
 */
export function TimerFixCard(props: SupportCardProps) {
  return (
    // useSearchParams needs a Suspense boundary
    <Suspense fallback={null}>
      <TimerFixCardContent {...props} />
    </Suspense>
  );
}

function TimerFixCardContent({ childId }: SupportCardProps) {
  const t = useTranslations("support.timerFix");
  const { toast } = useToast();
  const { dateTime, duration } = useFormatters();
  const { timers: runningTimers, now, canEdit } = useRunningTimers(childId);
  // Viewers cannot stop timers, so the card has nothing to offer them
  const timers = canEdit ? runningTimers : undefined;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [dismissed, setDismissed] = useState<Record<string, number>>({});
  const [fixing, setFixing] = useState<string | null>(null);
  const [target, setTarget] = useState<{ type: string; recordId: string } | null>(null);

  useEffect(() => setDismissed(readDismissed()), []);

  // Take the notification link's target and clean the address bar
  const fixTimerParam = searchParams.get("fixTimer");
  useEffect(() => {
    if (fixTimerParam === null) return;
    const parsed = parseFixTimerParam(fixTimerParam);
    if (parsed) setTarget(parsed);
    const rest = new URLSearchParams(searchParams.toString());
    rest.delete("fixTimer");
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
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
    const running = new Set(timers.map((timer) => timer.recordId));
    const kept = Object.fromEntries(Object.entries(dismissed).filter(([id]) => running.has(id)));
    if (Object.keys(kept).length !== Object.keys(dismissed).length) {
      setDismissed(kept);
      writeDismissed(kept);
    }
  }, [timers, dismissed]);

  const stillGoing = useCallback(
    (timer: RunningTimer) => {
      const next = { ...dismissed, [timer.recordId]: timer.tier };
      setDismissed(next);
      writeDismissed(next);
    },
    [dismissed]
  );

  const forgotten = (timers ?? []).filter(
    (timer) => timer.tier > 0 && (dismissed[timer.recordId] ?? 0) < timer.tier
  );
  const fixingTimer = timers?.find((timer) => timer.recordId === fixing) ?? null;

  return (
    <>
      {forgotten.map((timer) => {
        const type = t(`type.${timer.key}`);
        const minutes = (now.getTime() - timer.startTime.getTime()) / 60_000;
        return (
          <section
            key={timer.recordId}
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
                    type,
                    start: dateTime(timer.startTime),
                    duration: duration(minutes),
                  })}
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button type="button" onClick={() => setFixing(timer.recordId)}>
                {t("actions.setEndTime")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="bg-transparent"
                onClick={() => stillGoing(timer)}
              >
                {t("actions.stillGoing")}
              </Button>
            </div>
          </section>
        );
      })}

      {fixingTimer && (
        <FixTimerDialog
          key={fixingTimer.recordId}
          childId={childId}
          timer={fixingTimer}
          onClose={() => setFixing(null)}
        />
      )}
    </>
  );
}

function FixTimerDialog({
  childId,
  timer,
  onClose,
}: {
  childId: string;
  timer: RunningTimer;
  onClose: () => void;
}) {
  const t = useTranslations("support.timerFix");
  const { toast } = useToast();
  const { dateTime, duration } = useFormatters();
  const fixTimer = useFixTimer(childId);

  // Frozen when the dialog opens, so the limits do not move while typing
  const [openedAt] = useState(() => new Date());
  const [value, setValue] = useState(() =>
    toInputValue(suggestedEndTime(timer.startTime, openedAt, timer.key))
  );
  const [saving, setSaving] = useState(false);

  const endTime = new Date(value);
  const problem = value ? endTimeProblem(timer.startTime, endTime, new Date()) : "invalid";
  const minutes = problem ? null : (endTime.getTime() - timer.startTime.getTime()) / 60_000;

  const save = async () => {
    // The clock moved since the dialog opened: check again against the real time
    if (problem) return;
    setSaving(true);
    try {
      await fixTimer(timer, endTime);
      toast({ title: t("toast.saved") });
      onClose();
    } catch (error) {
      if (error instanceof TimerAlreadyEndedError) {
        toast({ title: t("toast.alreadyEnded") });
        onClose();
        return;
      }
      toast({ title: t("toast.failed"), variant: "destructive" });
      setSaving(false);
    }
  };

  const errorId = `timer-fix-error-${timer.recordId}`;

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("dialog.title")}</DialogTitle>
          <DialogDescription>
            {t("dialog.description", {
              type: t(`type.${timer.key}`),
              start: dateTime(timer.startTime),
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor={`timer-fix-end-${timer.recordId}`}>{t("dialog.endLabel")}</Label>
          <Input
            id={`timer-fix-end-${timer.recordId}`}
            type="datetime-local"
            value={value}
            min={toInputValue(timer.startTime)}
            max={toInputValue(openedAt)}
            onChange={(event) => setValue(event.target.value)}
            aria-invalid={problem !== null}
            aria-describedby={problem ? errorId : undefined}
          />
          {problem ? (
            <p id={errorId} role="alert" className="text-sm text-destructive">
              {t(`errors.${problem}`)}
            </p>
          ) : (
            minutes !== null && (
              <p className="text-sm text-muted-foreground">
                {t("dialog.durationPreview", { duration: duration(minutes) })}
              </p>
            )
          )}
        </div>

        <DialogFooter>
          <Button type="button" onClick={save} disabled={problem !== null || saving}>
            {saving ? t("dialog.saving") : t("dialog.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
