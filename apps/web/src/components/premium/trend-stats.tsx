"use client";

import { useTranslations } from "next-intl";
import { Baby, Droplets, Milk, Moon, Sun, Waves, type LucideIcon } from "lucide-react";
import { trpc } from "@/lib/trpc/provider";
import { getActivityIconClasses, type ActivityCategory } from "@/lib/activity-colors";
import { cn } from "@/lib/utils";
import { UpgradeCard } from "./upgrade-card";

type StatKey =
  | "sleepPerDay"
  | "napsPerDay"
  | "feedsPerDay"
  | "mlPerBottle"
  | "wetPerDay"
  | "dirtyPerDay";

const STAT_STYLE: Record<StatKey, { icon: LucideIcon; category: ActivityCategory }> = {
  sleepPerDay: { icon: Moon, category: "sleep" },
  napsPerDay: { icon: Sun, category: "sleep" },
  feedsPerDay: { icon: Baby, category: "nursing" },
  mlPerBottle: { icon: Milk, category: "bottle" },
  wetPerDay: { icon: Waves, category: "diaperWet" },
  dirtyPerDay: { icon: Droplets, category: "diaperDirty" },
};

export function TrendStats({ childId }: { childId: string }) {
  const t = useTranslations("insights.stats");
  const { data, error, isLoading, isError } = trpc.stats.trends.useQuery(
    { childId, days: 14 },
    { retry: false }
  );

  // The server decides who is premium (flag or PREMIUM_EMAILS), so the
  // upgrade card follows its answer instead of a client-side flag.
  if (error?.message === "premium_required") {
    return <UpgradeCard />;
  }

  const formatSleep = (minutes: number | null) =>
    minutes === null
      ? null
      : t("hoursMinutes", { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
  const formatNumber = (value: number | null) => (value === null ? null : String(value));

  const averages = data?.averages;
  const hasData = averages && Object.values(averages).some((v) => v !== null);

  const rows: { key: StatKey; value: string | null }[] = averages
    ? [
        { key: "sleepPerDay", value: formatSleep(averages.sleepMinutesPerDay) },
        { key: "napsPerDay", value: formatNumber(averages.napsPerDay) },
        { key: "feedsPerDay", value: formatNumber(averages.feedsPerDay) },
        {
          key: "mlPerBottle",
          value: averages.mlPerBottle === null ? null : t("ml", { value: averages.mlPerBottle }),
        },
        { key: "wetPerDay", value: formatNumber(averages.wetDiapersPerDay) },
        { key: "dirtyPerDay", value: formatNumber(averages.dirtyDiapersPerDay) },
      ]
    : [];

  return (
    <section aria-labelledby="trends-title" className="space-y-3">
      <div>
        <h2 id="trends-title" className="text-lg font-semibold">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
      {isError && (
        <p role="alert" className="text-sm text-destructive">
          {t("error")}
        </p>
      )}
      {data && !hasData && <p className="text-sm text-muted-foreground">{t("empty")}</p>}

      {hasData && (
        // One surface split by hairlines, so numbers align instead of floating in boxes
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
          {rows.map((row) => {
            const { icon: Icon, category } = STAT_STYLE[row.key];
            return (
              <div key={row.key} className="flex flex-col gap-1.5 bg-card p-3.5">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon className={cn("h-3.5 w-3.5", getActivityIconClasses(category))} aria-hidden />
                  {t(row.key)}
                </dt>
                <dd
                  className={cn(
                    "font-display text-2xl font-semibold leading-none tabular-nums",
                    row.value === null && "text-base font-normal text-muted-foreground"
                  )}
                >
                  {row.value ?? t("noValue")}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </section>
  );
}
