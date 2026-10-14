"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { CalendarClock, Check, ExternalLink } from "lucide-react";
import {
  NORWEGIAN_VACCINE_PROGRAMME,
  formatOsloTime,
  osloLocalToInstant,
  type CheckupView,
} from "@baby-atlas/utils";
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
import { Textarea } from "@/components/ui/textarea";
import {
  fromDateInputValue,
  toDateInputValue,
  todayInputValue,
} from "@/components/toddler/date-input";
import { useErrorToast } from "@/components/toddler/use-error-toast";

export type CheckupListItem = CheckupView & { notes: string | null };

const STATUS_STYLES: Record<CheckupView["status"], string> = {
  done: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  overdue: "bg-muted text-muted-foreground",
  due: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  upcoming: "bg-muted text-muted-foreground",
};

function useDateFormatters() {
  const format = useFormatter();
  return {
    /** Date-only values (birth-date based) are UTC midnight */
    day: (date: Date) => format.dateTime(date, { dateStyle: "medium", timeZone: "UTC" }),
    /** Instants are shown in Oslo */
    osloDay: (date: Date) =>
      format.dateTime(date, { dateStyle: "medium", timeZone: "Europe/Oslo" }),
  };
}

export function CheckupTimeline({
  childId,
  items,
}: {
  childId: string;
  items: CheckupListItem[];
}) {
  const t = useTranslations("checkups");
  const fmt = useDateFormatters();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = items.find((i) => i.contact.key === selectedKey) ?? null;

  const firstOpen = items.find((i) => i.status === "due" || i.status === "upcoming");

  return (
    <>
      <ol className="space-y-3">
        {items.map((item) => {
          const key = item.contact.key;
          const isNext = item === firstOpen;
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => setSelectedKey(key)}
                aria-label={t("openItem", { title: t(`items.${key}.title`) })}
                className={cn(
                  "flex min-h-16 w-full items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-colors hover:bg-muted",
                  isNext && "border-primary/50"
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{t(`items.${key}.title`)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {item.completedAt
                      ? t("doneOn", { date: fmt.day(item.completedAt) })
                      : t("usually", { date: fmt.day(item.window.target) })}
                  </span>
                  {item.booked && item.scheduledAt && (
                    <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-primary">
                      <CalendarClock className="h-3 w-3" aria-hidden />
                      {t("booked", {
                        date: fmt.osloDay(item.scheduledAt),
                        time: formatOsloTime(item.scheduledAt),
                      })}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                    STATUS_STYLES[item.status]
                  )}
                >
                  {item.status === "done" && <Check className="h-3 w-3" aria-hidden />}
                  {t(`status.${item.status}`)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {selected && (
        <CheckupDialog
          key={selected.contact.key}
          childId={childId}
          item={selected}
          onClose={() => setSelectedKey(null)}
        />
      )}
    </>
  );
}

function CheckupDialog({
  childId,
  item,
  onClose,
}: {
  childId: string;
  item: CheckupListItem;
  onClose: () => void;
}) {
  const t = useTranslations("checkups");
  const tv = useTranslations("vaccines");
  const tc = useTranslations("common");
  const fmt = useDateFormatters();
  const { toast } = useToast();
  const onError = useErrorToast(t("errorTitle"));
  const utils = trpc.useUtils();
  const { contact } = item;

  const [bookDate, setBookDate] = useState(
    item.scheduledAt ? todayInputValue(item.scheduledAt) : ""
  );
  const [bookTime, setBookTime] = useState(item.scheduledAt ? formatOsloTime(item.scheduledAt) : "");
  const [doneDate, setDoneDate] = useState(
    item.completedAt ? toDateInputValue(item.completedAt) : todayInputValue()
  );
  const [notes, setNotes] = useState(item.notes ?? "");

  const done = (message: string, close = false) => {
    utils.checkup.list.invalidate({ childId });
    toast({ title: message });
    if (close) onClose();
  };

  const setScheduled = trpc.checkup.setScheduled.useMutation({
    onSuccess: (_data, vars) =>
      done(vars.scheduledAt ? t("dialog.bookingSaved") : t("dialog.bookingRemoved"), true),
    onError,
  });
  const markDone = trpc.checkup.markDone.useMutation({
    onSuccess: () => done(t("dialog.doneSaved"), true),
    onError,
  });
  const undoDone = trpc.checkup.undoDone.useMutation({
    onSuccess: () => done(t("dialog.doneUndone"), true),
    onError,
  });
  const saveNotes = trpc.checkup.setNotes.useMutation({
    onSuccess: () => done(t("dialog.notesSaved")),
    onError,
  });
  const pending =
    setScheduled.isPending || markDone.isPending || undoDone.isPending || saveNotes.isPending;

  const windowText = t("usuallyRange", {
    start: fmt.day(item.window.start),
    end: fmt.day(item.window.end),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t(`items.${contact.key}.title`)}</DialogTitle>
          <DialogDescription>{t("dialog.description", { window: windowText })}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          <p>{t(`items.${contact.key}.description`)}</p>
          <p className="text-muted-foreground">
            {t("withWhom", { who: t(`who.${contact.who}`) })}
            {contact.group && <> · {t("group")}</>}
          </p>
          {contact.arrangedByNurse && (
            <p className="text-muted-foreground">{t("homeVisitNote")}</p>
          )}
          {contact.vaccineKeys.length > 0 && (
            <div>
              <p className="font-medium">{t("vaccinesAtVisit")}</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {contact.vaccineKeys.map((key) => (
                  <li key={key}>{vaccineLabel(key, tv as Parameters<typeof vaccineLabel>[1])}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {!contact.arrangedByNurse && (
          <section className="space-y-2" aria-labelledby="checkup-book-title">
            <h3 id="checkup-book-title" className="text-sm font-semibold">
              {t("dialog.bookTitle")}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="checkup-book-date">{t("dialog.dateLabel")}</Label>
                <Input
                  id="checkup-book-date"
                  type="date"
                  value={bookDate}
                  onChange={(e) => setBookDate(e.target.value)}
                  className="h-12"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="checkup-book-time">{t("dialog.timeLabel")}</Label>
                <Input
                  id="checkup-book-time"
                  type="time"
                  value={bookTime}
                  onChange={(e) => setBookTime(e.target.value)}
                  className="h-12"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                className="min-h-12 flex-1"
                disabled={!bookDate || !bookTime || pending}
                onClick={() =>
                  setScheduled.mutate({
                    childId,
                    checkupKey: contact.key,
                    scheduledAt: osloLocalToInstant(bookDate, bookTime),
                  })
                }
              >
                {t("dialog.saveBooking")}
              </Button>
              {item.scheduledAt && (
                <Button
                  variant="outline"
                  className="min-h-12"
                  disabled={pending}
                  onClick={() =>
                    setScheduled.mutate({ childId, checkupKey: contact.key, scheduledAt: null })
                  }
                >
                  {t("dialog.removeBooking")}
                </Button>
              )}
            </div>
          </section>
        )}

        <section className="space-y-2" aria-labelledby="checkup-done-title">
          <h3 id="checkup-done-title" className="text-sm font-semibold">
            {t("dialog.doneTitle")}
          </h3>
          <div className="space-y-1">
            <Label htmlFor="checkup-done-date">{t("dialog.doneDateLabel")}</Label>
            <Input
              id="checkup-done-date"
              type="date"
              value={doneDate}
              max={todayInputValue()}
              onChange={(e) => setDoneDate(e.target.value)}
              className="h-12"
            />
          </div>
          <div className="flex gap-2">
            <Button
              className="min-h-12 flex-1"
              disabled={!doneDate || pending}
              onClick={() =>
                markDone.mutate({
                  childId,
                  checkupKey: contact.key,
                  completedAt: fromDateInputValue(doneDate),
                })
              }
            >
              {t("dialog.markDone")}
            </Button>
            {item.completedAt && (
              <Button
                variant="outline"
                className="min-h-12"
                disabled={pending}
                onClick={() => undoDone.mutate({ childId, checkupKey: contact.key })}
              >
                {t("dialog.undoDone")}
              </Button>
            )}
          </div>
        </section>

        <section className="space-y-2">
          <Label htmlFor="checkup-notes">{t("dialog.notesLabel")}</Label>
          <Textarea
            id="checkup-notes"
            value={notes}
            maxLength={1000}
            placeholder={t("dialog.notesPlaceholder")}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button
            variant="outline"
            className="min-h-12"
            disabled={pending || notes === (item.notes ?? "")}
            onClick={() => saveNotes.mutate({ childId, checkupKey: contact.key, notes })}
          >
            {t("dialog.saveNotes")}
          </Button>
        </section>

        <div className="text-xs text-muted-foreground">
          <p className="font-medium">{t("dialog.sources")}</p>
          <ul className="space-y-0.5">
            {contact.sources.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 underline"
                >
                  {new URL(url).hostname}
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter>
          <Button variant="outline" className="min-h-12" onClick={onClose}>
            {tc("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "Pneumokokkvaksine, dose 2" from a programme dose key like `pneumococcal-2`. */
function vaccineLabel(
  doseKey: string,
  tv: (key: string, values?: Record<string, string | number>) => string
): string {
  const dose = NORWEGIAN_VACCINE_PROGRAMME.find((d) => d.key === doseKey);
  if (!dose) return doseKey;
  return `${tv(`names.${dose.vaccine}`)}, ${tv("dose", { dose: dose.dose })}`;
}
