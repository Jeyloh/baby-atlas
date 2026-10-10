"use client";

import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc/provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UpgradeCard } from "./upgrade-card";

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
      ? t("noValue")
      : t("hoursMinutes", {
          hours: Math.floor(minutes / 60),
          minutes: minutes % 60,
        });
  const formatNumber = (value: number | null) =>
    value === null ? t("noValue") : String(value);

  const averages = data?.averages;
  const hasData = averages && Object.values(averages).some((v) => v !== null);

  const rows: {
    key:
      | "sleepPerDay"
      | "napsPerDay"
      | "feedsPerDay"
      | "mlPerBottle"
      | "wetPerDay"
      | "dirtyPerDay";
    value: string;
  }[] = averages
    ? [
        { key: "sleepPerDay", value: formatSleep(averages.sleepMinutesPerDay) },
        { key: "napsPerDay", value: formatNumber(averages.napsPerDay) },
        { key: "feedsPerDay", value: formatNumber(averages.feedsPerDay) },
        {
          key: "mlPerBottle",
          value:
            averages.mlPerBottle === null
              ? t("noValue")
              : t("ml", { value: averages.mlPerBottle }),
        },
        { key: "wetPerDay", value: formatNumber(averages.wetDiapersPerDay) },
        { key: "dirtyPerDay", value: formatNumber(averages.dirtyDiapersPerDay) },
      ]
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        )}
        {isError && (
          <p role="alert" className="text-sm text-destructive">
            {t("error")}
          </p>
        )}
        {data && !hasData && (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        )}
        {hasData && (
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {rows.map((row) => (
              <div key={row.key} className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">
                  {t(row.key)}
                </dt>
                <dd className="mt-1 text-xl font-semibold">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
