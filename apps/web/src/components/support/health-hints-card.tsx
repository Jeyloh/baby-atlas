"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, Info, Phone, TriangleAlert, X } from "lucide-react";
import { evaluateHealthHints, type HealthHint } from "@baby-atlas/utils";
import { cn } from "@/lib/utils";
import { useFormatters } from "@/lib/format";
import { useNow, useSupportData } from "@/hooks/use-support-data";
import { dismissHint, readDismissedHints } from "@/lib/support/dismissed-hints";
import type { SupportCardProps } from "./types";

const LEGEVAKT_TEL = "tel:116117";
const EMERGENCY_TEL = "tel:113";

/**
 * Rule-based, informational hints (fever, few wet diapers in a newborn, a long
 * gap between feeds in a young baby) with links to Helsenorge. Never a
 * diagnosis. Each hint can be dismissed on this device; a new situation gets a
 * new hint id and shows again.
 */
export function HealthHintsCard({ childId, birthDate }: SupportCardProps) {
  const t = useTranslations("support.healthHints");
  const { number } = useFormatters();
  const data = useSupportData(childId);
  const now = useNow();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // localStorage is read after mount: the server cannot know it
  useEffect(() => {
    setDismissed(readDismissedHints(localStorage, childId, new Date()));
  }, [childId]);

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

  if (hints.length === 0) return null;

  const dismiss = (id: string) => {
    dismissHint(localStorage, childId, id, new Date());
    setDismissed((current) => new Set(current).add(id));
  };

  const text = (hint: HealthHint, part: "title" | "body") => {
    const params = Object.fromEntries(
      Object.entries(hint.params).map(([key, value]) => [
        key,
        key === "temperature" && typeof value === "number" ? number(value, 1) : value,
      ])
    );
    return t(`${hint.kind}.${part}`, params);
  };

  return (
    <section aria-label={t("title")} className="space-y-3">
      {hints.map((hint) => {
        const urgent = hint.severity === "urgent";
        const Icon = urgent ? TriangleAlert : Info;
        return (
          <aside
            key={hint.id}
            aria-labelledby={`hint-${hint.id}`}
            className={cn(
              "flex items-start gap-3 rounded-2xl border p-4",
              urgent
                ? "border-destructive/50 bg-destructive/10 text-foreground"
                : "bg-card text-card-foreground"
            )}
          >
            <Icon
              className={cn("mt-0.5 h-5 w-5 shrink-0", urgent ? "text-destructive" : "text-primary")}
              aria-hidden
            />
            <div className="min-w-0 flex-1 space-y-2">
              <h2 id={`hint-${hint.id}`} className="font-semibold leading-tight">
                {text(hint, "title")}
              </h2>
              <p className="text-sm text-muted-foreground">{text(hint, "body")}</p>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <li>
                  <a
                    href={LEGEVAKT_TEL}
                    className="inline-flex min-h-11 items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Phone className="h-4 w-4" aria-hidden />
                    {t("callLegevakt")}
                  </a>
                </li>
                {urgent && (
                  <li>
                    <a
                      href={EMERGENCY_TEL}
                      className="inline-flex min-h-11 items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Phone className="h-4 w-4" aria-hidden />
                      {t("callEmergency")}
                    </a>
                  </li>
                )}
                <li>
                  <a
                    href={hint.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    {t("readMore")}
                  </a>
                </li>
              </ul>
              <p className="text-xs text-muted-foreground">{t("note")}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(hint.id)}
              aria-label={t("dismiss")}
              className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </aside>
        );
      })}
    </section>
  );
}
