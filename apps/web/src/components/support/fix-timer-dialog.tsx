"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { endTimeProblem, suggestedEndTime } from "@baby-atlas/utils";
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
import type { RunningTimer } from "@/hooks/use-running-timers";
import { useToast } from "@/hooks/use-toast";
import { useFormatters } from "@/lib/format";

/** Value of a datetime-local input for a date, in the device's time zone. */
function toInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function FixTimerDialog({
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
