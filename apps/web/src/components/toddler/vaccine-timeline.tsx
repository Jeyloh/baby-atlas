"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { trpc } from "@/lib/trpc/provider";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
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
import { fromDateInputValue, toDateInputValue, todayInputValue } from "./date-input";
import { useErrorToast } from "./use-error-toast";
import type { VaccineDoseView, VaccineGroup } from "./vaccine-utils";

const STATUS_STYLES: Record<VaccineDoseView["status"], string> = {
  given: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  overdue: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  due: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  upcoming: "bg-muted text-muted-foreground",
};

interface VaccineTimelineProps {
  childId: string;
  groups: VaccineGroup[];
}

export function VaccineTimeline({ childId, groups }: VaccineTimelineProps) {
  const t = useTranslations("vaccines");
  const format = useFormatter();
  const [selected, setSelected] = useState<VaccineDoseView | null>(null);

  const formatDate = (date: Date) =>
    format.dateTime(date, { dateStyle: "medium", timeZone: "UTC" });

  return (
    <>
      <ol className="space-y-6">
        {groups.map((group) => (
          <li key={group.id} className="relative border-l-2 border-primary/30 pl-5">
            <span
              aria-hidden
              className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-primary"
            />
            <h2 className="mb-2 text-lg font-semibold">{t(`groups.${group.id}`)}</h2>
            <ul className="space-y-2">
              {group.doses.map((view) => (
                <li key={view.dose.key}>
                  <button
                    type="button"
                    onClick={() => setSelected(view)}
                    className="flex min-h-14 w-full items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-colors hover:bg-muted"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        {t(`names.${view.dose.vaccine}`)}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t("dose", { dose: view.dose.dose })}
                        {" · "}
                        {view.givenAt
                          ? t("givenOn", { date: formatDate(view.givenAt) })
                          : t("dueOn", { date: formatDate(view.dueDate) })}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                        STATUS_STYLES[view.status]
                      )}
                    >
                      {view.status === "given" && <Check className="h-3 w-3" />}
                      {t(`status.${view.status}`)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      {selected && (
        <DoseDialog
          key={selected.dose.key}
          childId={childId}
          view={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function DoseDialog({
  childId,
  view,
  onClose,
}: {
  childId: string;
  view: VaccineDoseView;
  onClose: () => void;
}) {
  const t = useTranslations("vaccines");
  const tc = useTranslations("common");
  const { toast } = useToast();
  const onError = useErrorToast(t("errorTitle"));
  const utils = trpc.useUtils();
  const [date, setDate] = useState(
    view.givenAt ? toDateInputValue(view.givenAt) : todayInputValue()
  );

  const done = (message: string) => {
    utils.vaccination.list.invalidate({ childId });
    toast({ title: message });
    onClose();
  };

  const mark = trpc.vaccination.mark.useMutation({
    onSuccess: () => done(t("dialog.marked")),
    onError,
  });
  const unmark = trpc.vaccination.unmark.useMutation({
    onSuccess: () => done(t("dialog.unmarked")),
    onError,
  });
  const pending = mark.isPending || unmark.isPending;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("dialog.markTitle")}</DialogTitle>
          <DialogDescription>
            {t(`names.${view.dose.vaccine}`)}, {t("dose", { dose: view.dose.dose })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="vaccine-date">{t("dialog.dateLabel")}</Label>
          <Input
            id="vaccine-date"
            type="date"
            value={date}
            max={todayInputValue()}
            onChange={(e) => setDate(e.target.value)}
            className="h-12"
          />
        </div>
        <DialogFooter className="gap-2">
          {view.givenAt && (
            <Button
              variant="outline"
              className="min-h-12"
              disabled={pending}
              onClick={() => unmark.mutate({ childId, vaccineKey: view.dose.key })}
            >
              {t("dialog.undo")}
            </Button>
          )}
          <Button variant="outline" className="min-h-12" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button
            className="min-h-12"
            disabled={!date || pending}
            onClick={() =>
              mark.mutate({
                childId,
                vaccineKey: view.dose.key,
                givenAt: fromDateInputValue(date),
              })
            }
          >
            {t("dialog.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
