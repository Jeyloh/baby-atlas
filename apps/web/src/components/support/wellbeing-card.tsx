"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Annoyed, Frown, Laugh, Lock, Meh, Smile, X, type LucideIcon } from "lucide-react";
import { osloDayKey, shouldShowSupport } from "@baby-atlas/utils";
import { trpc } from "@/lib/trpc/provider";
import { useToast } from "@/hooks/use-toast";
import { useUserId } from "@/hooks/use-last-activities";
import { useStoredValue } from "@/hooks/use-stored-value";
import { wellbeingStorageKey } from "@/lib/wellbeing-storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { HIDDEN_CARD, type SupportCardState } from "./types";

const MOODS: ReadonlyArray<{ value: 1 | 2 | 3 | 4 | 5; icon: LucideIcon }> = [
  { value: 1, icon: Frown },
  { value: 2, icon: Annoyed },
  { value: 3, icon: Meh },
  { value: 4, icon: Smile },
  { value: 5, icon: Laugh },
];

/**
 * Private daily check-in for the parent (mood and sleep), plus a gentle
 * support card after several hard days. Only the signed-in user's own rows
 * are read or written. No scores and no diagnosis.
 *
 * It is the home screen's soft card and takes the slot on days it wants a
 * check-in: nothing answered today, or the support card is due. Once it has
 * wanted one it stays for this visit, so it does not vanish after the answer.
 */
export function useWellbeingCard(): SupportCardState {
  const userId = useUserId();
  const [hidden, setHidden] = useStoredValue(
    userId ? wellbeingStorageKey("hidden", userId) : undefined
  );
  const [supportDismissed, setSupportDismissed] = useStoredValue(
    userId ? wellbeingStorageKey("support-dismissed", userId) : undefined
  );
  const recent = trpc.wellbeing.recent.useQuery(undefined, {
    enabled: !!userId && hidden === null,
  });
  const [wanted, setWanted] = useState(false);

  const entries = recent.data;
  const today = osloDayKey(new Date());
  const wants =
    !!entries &&
    (!entries.some((e) => e.date === today) ||
      (shouldShowSupport(entries, new Date()) && supportDismissed !== today));
  if (wants && !wanted) setWanted(true);

  if (!userId || hidden !== null || !entries || !(wants || wanted)) return HIDDEN_CARD;
  return {
    visible: true,
    urgent: false,
    element: (
      <WellbeingContent
        supportDismissed={supportDismissed}
        onDismissSupport={() => setSupportDismissed(today)}
        onHide={() => setHidden("1")}
      />
    ),
  };
}

/** Settings switch that brings the hidden check-in card back. Renders nothing while it is shown. */
export function WellbeingToggle() {
  const t = useTranslations("wellbeing");
  const userId = useUserId();
  const [hidden, setHidden] = useStoredValue(
    userId ? wellbeingStorageKey("hidden", userId) : undefined
  );
  if (!userId || !hidden) return null;
  return (
    <Button variant="outline" className="min-h-12" onClick={() => setHidden(null)}>
      {t("checkIn.show")}
    </Button>
  );
}

function WellbeingContent({
  supportDismissed,
  onDismissSupport,
  onHide,
}: {
  supportDismissed: string | null;
  onDismissSupport: () => void;
  onHide: () => void;
}) {
  const t = useTranslations("wellbeing");
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const recent = trpc.wellbeing.recent.useQuery();
  const radios = useRef<Array<HTMLButtonElement | null>>([]);
  const [sleepText, setSleepText] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(0);

  const save = trpc.wellbeing.upsertToday.useMutation({
    onSuccess: async () => {
      setSavedAt(Date.now());
      await utils.wellbeing.recent.invalidate();
    },
    onError: () => toast({ title: t("checkIn.saveFailed"), variant: "destructive" }),
  });

  if (recent.isLoading || !recent.data) return null;

  const today = recent.data.find((e) => e.date === osloDayKey(new Date()));
  const sleepValue = sleepText ?? (today?.sleepHours != null ? String(today.sleepHours) : "");
  const showSupport =
    shouldShowSupport(recent.data, new Date()) &&
    supportDismissed !== osloDayKey(new Date());

  const saveMood = (mood: number) => {
    // aria-disabled keeps focus on the button while saving
    if (save.isPending) return;
    save.mutate({ mood, sleepHours: today?.sleepHours ?? null, note: today?.note ?? null });
  };

  const onRadioKeyDown = (event: KeyboardEvent, index: number) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + MOODS.length) % MOODS.length;
    radios.current[next]?.focus();
    saveMood(MOODS[next]!.value);
  };

  const saveSleep = () => {
    if (!today || sleepText === null) return;
    const parsed = sleepText.trim() === "" ? null : Number(sleepText.replace(",", "."));
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0 || parsed > 24)) return;
    if (parsed === (today.sleepHours ?? null)) return;
    save.mutate({ mood: today.mood, sleepHours: parsed, note: today.note });
  };

  return (
    <div className="space-y-3">
      {showSupport && (
        <section
          aria-labelledby="wellbeing-support-title"
          className="relative rounded-lg border bg-card p-4 pr-12 text-card-foreground"
        >
          <h2 id="wellbeing-support-title" className="font-display text-base font-semibold leading-tight">
            {t("support.title")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("support.body")}</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>{t("support.helsestasjon")}</li>
            <li>
              {t.rich("support.mentalHelp", {
                helpline: (chunks) => (
                  <a
                    href="tel:116123"
                    className="font-semibold text-primary underline underline-offset-4"
                  >
                    {chunks}
                  </a>
                ),
              })}
            </li>
            <li>
              {t.rich("support.urgent", {
                legevakt: (chunks) => (
                  <a
                    href="tel:116117"
                    className="font-semibold text-primary underline underline-offset-4"
                  >
                    {chunks}
                  </a>
                ),
                emergency: (chunks) => (
                  <a
                    href="tel:113"
                    className="font-semibold text-primary underline underline-offset-4"
                  >
                    {chunks}
                  </a>
                ),
              })}
            </li>
          </ul>
          <button
            type="button"
            onClick={onDismissSupport}
            aria-label={t("support.dismiss")}
            className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-5 w-5" />
          </button>
        </section>
      )}

      <section
        aria-labelledby="wellbeing-title"
        className="rounded-lg border bg-card p-4 text-card-foreground"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 id="wellbeing-title" className="font-display text-base font-semibold leading-tight">
            {t("checkIn.title")}
          </h2>
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            title={t("checkIn.privateHint")}
          >
            <Lock className="h-3 w-3" aria-hidden />
            {t("checkIn.private")}
          </span>
        </div>

        <div role="radiogroup" aria-label={t("checkIn.moodLabel")} className="mt-3 grid grid-cols-5 gap-2">
          {MOODS.map(({ value, icon: Icon }, index) => {
            const selected = today?.mood === value;
            // Roving tabindex: one tab stop, on the selected face (or the first)
            const tabStop = today ? selected : index === 0;
            return (
              <button
                key={value}
                ref={(node) => {
                  radios.current[index] = node;
                }}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-disabled={save.isPending}
                aria-label={t(`checkIn.mood.${value}`)}
                tabIndex={tabStop ? 0 : -1}
                onClick={() => saveMood(value)}
                onKeyDown={(e) => onRadioKeyDown(e, index)}
                className={cn(
                  "flex h-12 items-center justify-center rounded-lg border text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-disabled:opacity-60",
                  selected
                    ? "border-primary bg-primary/10 text-primary"
                    : "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-6 w-6" aria-hidden />
              </button>
            );
          })}
        </div>

        {today && (
          <p className="mt-2 text-sm font-medium" aria-live="polite">
            {t(`checkIn.mood.${today.mood as 1 | 2 | 3 | 4 | 5}`)}
          </p>
        )}

        {today && (
          <div className="mt-3 space-y-1">
            <Label htmlFor="wellbeing-sleep" className="text-sm font-normal text-muted-foreground">
              {t("checkIn.sleepLabel")}
            </Label>
            <Input
              id="wellbeing-sleep"
              type="number"
              inputMode="decimal"
              min={0}
              max={24}
              step={0.5}
              value={sleepValue}
              onChange={(e) => setSleepText(e.target.value)}
              onBlur={saveSleep}
              className="max-w-[8rem]"
            />
          </div>
        )}

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span role="status" aria-live="polite">
            {savedAt > 0 && !save.isPending && !save.isError ? t("checkIn.saved") : ""}
          </span>
          <button
            type="button"
            onClick={onHide}
            className="underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("checkIn.hide")}
          </button>
        </div>
      </section>
    </div>
  );
}
