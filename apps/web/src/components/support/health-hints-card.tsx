"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, Info, Phone, TriangleAlert, X } from "lucide-react";
import { evaluateHealthHints, type HealthHint } from "@baby-atlas/utils";
import { cn } from "@/lib/utils";
import { useFormatters } from "@/lib/format";
import { useNow, useSupportData } from "@/hooks/use-support-data";
import { browserStorage } from "@/lib/support/browser-storage";
import { dismissHint, readDismissedHints } from "@/lib/support/dismissed-hints";
import { HIDDEN_CARD, type SupportCardProps, type SupportCardState } from "./types";

const LEGEVAKT_TEL = "tel:116117";
const EMERGENCY_TEL = "tel:113";
/** Organisation names are not translated */
const SOURCE_NAMES: Record<HealthHint["source"], string> = {
  helsenorge: "Helsenorge",
  ammehjelpen: "Ammehjelpen",
};

const LINK_CLASS =
  "inline-flex min-h-11 items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Rule-based, informational hints (fever, few wet diapers in a newborn, a long
 * gap between feeds in a young baby) with links to Helsenorge. Never a
 * diagnosis. Each hint can be dismissed on this device; a new situation gets a
 * new hint id and shows again. Urgent hints and the rest are two cards, so the
 * urgent ones can go first on the home screen.
 */
export function useHealthHintsCards({ childId, birthDate }: SupportCardProps): {
  urgent: SupportCardState;
  regular: SupportCardState;
} {
  const t = useTranslations("support.healthHints");
  const data = useSupportData(childId);
  const now = useNow();
  // The home screen remounts this per child, so the saved dismissals are read once
  const [dismissed, setDismissed] = useState<Set<string>>(() =>
    readDismissedHints(browserStorage(), childId, new Date())
  );

  const hints = useMemo(
    () =>
      data
        ? evaluateHealthHints({
            birthDate,
            now,
            temperatures: data.temperatures,
            diapers: data.diapers,
            feeds: data.feeds,
            feedingActive: data.feedingActive,
          }).filter((hint) => !dismissed.has(hint.id))
        : [],
    [data, birthDate, now, dismissed]
  );

  const dismiss = (id: string) => {
    const storage = browserStorage();
    if (storage) dismissHint(storage, childId, id, new Date());
    setDismissed((current) => new Set(current).add(id));
  };

  const group = (urgent: boolean): SupportCardState => {
    const shown = hints.filter((hint) => (hint.severity === "urgent") === urgent);
    if (shown.length === 0) return HIDDEN_CARD;
    return {
      visible: true,
      urgent,
      element: (
        <section aria-label={t("title")} className="space-y-3">
          {shown.map((hint) => (
            <HealthHintItem key={hint.id} hint={hint} onDismiss={() => dismiss(hint.id)} />
          ))}
        </section>
      ),
    };
  };

  return { urgent: group(true), regular: group(false) };
}

/** Both groups in one place, for rendering the hints on their own. */
export function HealthHintsCard(props: SupportCardProps) {
  const { urgent, regular } = useHealthHintsCards(props);
  return (
    <>
      {urgent.element}
      {regular.element}
    </>
  );
}

function HealthHintItem({ hint, onDismiss }: { hint: HealthHint; onDismiss: () => void }) {
  const t = useTranslations("support.healthHints");
  const { number } = useFormatters();

  const text = (part: "title" | "body") => {
    const params = Object.fromEntries(
      Object.entries(hint.params).map(([key, value]) => [
        key,
        key === "temperature" && typeof value === "number" ? number(value, 1) : value,
      ])
    );
    return t(`${hint.kind}.${part}`, params);
  };

  const urgent = hint.severity === "urgent";
  const Icon = urgent ? TriangleAlert : Info;
  return (
    <aside
      aria-labelledby={`hint-${hint.id}`}
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-4",
        urgent ? "border-destructive/50 bg-destructive/10 text-foreground" : "bg-card text-card-foreground"
      )}
    >
      <Icon
        className={cn("mt-0.5 h-5 w-5 shrink-0", urgent ? "text-destructive" : "text-primary")}
        aria-hidden
      />
      <div className="min-w-0 flex-1 space-y-2">
        <h2 id={`hint-${hint.id}`} className="font-semibold leading-tight">
          {text("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{text("body")}</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <li>
            <a href={LEGEVAKT_TEL} className={LINK_CLASS}>
              <Phone className="h-4 w-4" aria-hidden />
              {t("callLegevakt")}
            </a>
          </li>
          {hint.emergency && (
            <li>
              <a href={EMERGENCY_TEL} className={LINK_CLASS}>
                <Phone className="h-4 w-4" aria-hidden />
                {t("callEmergency")}
              </a>
            </li>
          )}
          <li>
            <a href={hint.url} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
              <ExternalLink className="h-4 w-4" aria-hidden />
              {t("readMore", { source: SOURCE_NAMES[hint.source] })}
            </a>
          </li>
        </ul>
        <p className="text-xs text-muted-foreground">{t("note")}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("dismiss")}
        className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-5 w-5" aria-hidden />
      </button>
    </aside>
  );
}
