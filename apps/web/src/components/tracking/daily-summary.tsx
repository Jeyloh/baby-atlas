"use client";

import { trpc } from "@/lib/trpc/provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import { useFormatters } from "@/lib/format";
import { Moon, Baby, Droplets } from "lucide-react";

interface DailySummaryProps {
  childId: string;
}

export function DailySummary({ childId }: DailySummaryProps) {
  const t = useTranslations("tracking.dailySummary");
  const { duration: formatDuration, ml } = useFormatters();
  const { data: sleepSummary } = trpc.sleep.summary.useQuery({
    childId,
    period: "today",
  });

  const { data: feedingSummary } = trpc.feeding.summary.useQuery({
    childId,
    period: "today",
  });

  const { data: diaperSummary } = trpc.diaper.summary.useQuery({
    childId,
    period: "today",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-3 rounded-lg bg-indigo-100 dark:bg-indigo-900/50">
            <Moon className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
            <div className="flex-1">
              <p className="font-semibold text-indigo-900 dark:text-indigo-100">{t("sleep")}</p>
              <div className="text-sm text-indigo-700 dark:text-indigo-300">
                {sleepSummary ? (
                  <>
                    <p>
                      {t("sleepTotal", {
                        duration: formatDuration(sleepSummary.totalMinutes),
                        count: sleepSummary.totalSessions,
                      })}
                    </p>
                    <p>
                      {t("sleepSplit", {
                        napDuration: formatDuration(sleepSummary.napMinutes),
                        napCount: sleepSummary.napCount,
                        nightDuration: formatDuration(sleepSummary.nightMinutes),
                        nightCount: sleepSummary.nightCount,
                      })}
                    </p>
                  </>
                ) : (
                  t("noSleep")
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 p-3 rounded-lg bg-pink-100 dark:bg-pink-900/50">
            <Baby className="h-8 w-8 text-pink-600 dark:text-pink-400" />
            <div className="flex-1">
              <p className="font-semibold text-pink-900 dark:text-pink-100">{t("feeding")}</p>
              <div className="text-sm text-pink-700 dark:text-pink-300">
                {feedingSummary ? (
                  <>
                    <p>{t("feedingTotal", { count: feedingSummary.totalFeedings })}</p>
                    <p>
                      {[
                        t("breastPart", {
                          count: feedingSummary.breastfeedingCount,
                          duration: formatDuration(feedingSummary.breastfeedingMinutes),
                        }),
                        feedingSummary.bottleCount > 0 &&
                          t("bottlePart", {
                            count: feedingSummary.bottleCount,
                            amount: ml(feedingSummary.totalBottleMl),
                          }),
                        feedingSummary.solidsCount > 0 &&
                          t("solidsPart", { count: feedingSummary.solidsCount }),
                      ]
                        .filter(Boolean)
                        .join(" | ")}
                    </p>
                  </>
                ) : (
                  t("noFeedings")
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 p-3 rounded-lg bg-blue-100 dark:bg-blue-900/50">
            <Droplets className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <div className="flex-1">
              <p className="font-semibold text-blue-900 dark:text-blue-100">{t("diapers")}</p>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                {diaperSummary ? (
                  <>
                    <p>{t("diaperTotal", { count: diaperSummary.totalChanges })}</p>
                    <p>
                      {t("diaperSplit", {
                        wet: diaperSummary.wetCount,
                        dirty: diaperSummary.dirtyCount,
                      })}
                    </p>
                  </>
                ) : (
                  t("noDiapers")
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
