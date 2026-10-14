"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Milk, Moon, type LucideIcon } from "lucide-react";
import {
  ageInMonths,
  FEED_PREDICTION_MAX_MONTHS,
  predictionPhase,
  predictNextFeed,
  predictNextNap,
  type PredictionPhase,
} from "@baby-atlas/utils";
import { useFormatters } from "@/lib/format";
import { useNow, useSupportData } from "@/hooks/use-support-data";
import { HIDDEN_CARD, type SupportCardProps, type SupportCardState } from "./types";

interface Row {
  key: "feed" | "nap";
  icon: LucideIcon;
  at: Date;
  phase: Exclude<PredictionPhase, "stale">;
  /** Interval or wake window the guess is based on, in minutes */
  basisMinutes: number;
}

/**
 * When the next feed and the next nap are likely, worked out from the child's
 * own log and age. Shows nothing without enough data, and drops a guess once
 * it is clearly out of date.
 */
export function useWhatsNextCard({ childId, birthDate }: SupportCardProps): SupportCardState {
  const data = useSupportData(childId);
  const now = useNow();

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    const result: Row[] = [];

    if (!data.feedingActive && ageInMonths(birthDate, now) < FEED_PREDICTION_MAX_MONTHS) {
      const feed = predictNextFeed(data.feeds, now);
      const phase = feed && predictionPhase(feed.at, now);
      if (feed && phase && phase !== "stale") {
        result.push({ key: "feed", icon: Milk, at: feed.at, phase, basisMinutes: feed.intervalMinutes });
      }
    }

    if (!data.sleepActive) {
      const nap = predictNextNap({ birthDate, now, sleeps: data.sleeps });
      const phase = nap && predictionPhase(nap.at, now);
      if (nap && phase && phase !== "stale") {
        result.push({ key: "nap", icon: Moon, at: nap.at, phase, basisMinutes: nap.wakeWindowMinutes });
      }
    }

    return result.sort((a, b) => a.at.getTime() - b.at.getTime());
  }, [data, birthDate, now]);

  if (rows.length === 0) return HIDDEN_CARD;
  return { visible: true, urgent: false, element: <WhatsNextRows rows={rows} now={now} /> };
}

export function WhatsNextCard(props: SupportCardProps) {
  return useWhatsNextCard(props).element;
}

function WhatsNextRows({ rows, now }: { rows: Row[]; now: Date }) {
  const t = useTranslations("support.whatsNext");
  const { time, duration } = useFormatters();
  return (
    <section
      aria-labelledby="whats-next-title"
      className="space-y-3 rounded-2xl border bg-card p-4 text-card-foreground"
    >
      <h2 id="whats-next-title" className="font-display text-lg font-semibold tracking-tight">
        {t("title")}
      </h2>
      <ul className="space-y-3">
        {rows.map(({ key, icon: Icon, at, phase, basisMinutes }) => (
          <li key={key} className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
              <Icon className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {t(`${key}.label`)}
                <span className="font-normal text-muted-foreground">
                  {" "}
                  {t("at", { time: time(at) })}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                {phase === "upcoming"
                  ? t("phase.upcoming", {
                      duration: duration(Math.max(1, (at.getTime() - now.getTime()) / 60_000)),
                    })
                  : t(`phase.${phase}`)}
                {" · "}
                {t(`${key}.hint`, { interval: duration(basisMinutes) })}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{t("note")}</p>
    </section>
  );
}
