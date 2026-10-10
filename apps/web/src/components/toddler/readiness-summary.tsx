"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { readinessLevel, type ReadinessSummary as Summary } from "./potty-utils";

export function ReadinessSummary({ summary }: { summary: Summary }) {
  const t = useTranslations("potty");
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("summary.title", { days: summary.windowDays })}</CardTitle>
        <p className="text-2xl font-bold">
          {t("summary.seenCount", { seen: summary.seenCount, total: summary.totalCount })}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-1" aria-hidden>
          {summary.signals.map((s) => (
            <span
              key={s.signal}
              className={cn("h-2 flex-1 rounded-full", s.seen ? "bg-primary" : "bg-muted")}
            />
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{t(`summary.level.${readinessLevel(summary.seenCount)}`)}</p>
        <ul className="divide-y">
          {summary.signals.map((s) => (
            <li key={s.signal} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className={s.seen ? "font-medium" : "text-muted-foreground"}>
                {t(`signals.${s.signal}`)}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-0.5 text-xs",
                  s.seen ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}
              >
                {s.seen ? t("summary.seen", { count: s.count }) : t("summary.notSeen")}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
