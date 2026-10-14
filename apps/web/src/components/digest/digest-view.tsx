"use client";

import Link from "next/link";
import type { Route } from "next";
import { useTranslations } from "next-intl";
import { keepPreviousData } from "@tanstack/react-query";
import { addDaysToKey } from "@baby-atlas/utils";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Equal,
  type LucideIcon,
} from "lucide-react";
import { trpc } from "@/lib/trpc/provider";
import { useFormatters } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { compareValues } from "./digest-utils";

interface MetricProps {
  label: string;
  value: string | null;
  hint?: string;
  change: ReturnType<typeof compareValues>;
  formatAmount: (amount: number) => string;
}

const CHANGE_ICON: Record<"up" | "down" | "same", LucideIcon> = {
  up: ArrowUp,
  down: ArrowDown,
  same: Equal,
};

function Metric({ label, value, hint, change, formatAmount }: MetricProps) {
  const t = useTranslations("digest");
  const Icon = change.direction === "none" ? null : CHANGE_ICON[change.direction];

  return (
    <div className="flex flex-col gap-1.5 bg-card p-3.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-display text-2xl font-semibold leading-none tabular-nums",
          value === null && "text-base font-normal text-muted-foreground"
        )}
      >
        {value ?? t("noValue")}
      </dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
      {/* Neutral colours on purpose: more or less is not good or bad by itself */}
      <dd className="flex items-center gap-1 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3 w-3 shrink-0" aria-hidden />}
        <span>
          {change.direction === "none" && t("change.none")}
          {change.direction === "same" && t("change.same")}
          {change.direction === "up" && t("change.up", { value: formatAmount(change.amount) })}
          {change.direction === "down" && t("change.down", { value: formatAmount(change.amount) })}
        </span>
      </dd>
    </div>
  );
}

function weekHref(childId: string, weekStart: string): Route {
  return `/dashboard/${childId}/digest?week=${weekStart}` as Route;
}

export function DigestView({ childId, week }: { childId: string; week?: string }) {
  const t = useTranslations("digest");
  const f = useFormatters();
  // Keep showing the last week while the next one loads, so the page does not jump
  const { data, isLoading, isError, refetch } = trpc.digest.week.useQuery(
    { childId, weekStart: week },
    { placeholderData: keepPreviousData }
  );

  if (isLoading) {
    return (
      <p className="animate-pulse py-8 text-center text-muted-foreground" aria-busy="true">
        {t("loading")}
      </p>
    );
  }

  if (isError || !data) {
    return (
      <div role="alert" className="space-y-3 py-6 text-center">
        <p className="text-sm text-destructive">{t("error")}</p>
        <Button variant="outline" className="min-h-12" onClick={() => refetch()}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  const { current, previous } = data;
  const weekNumber = Number(data.isoWeek.slice(-2));
  const isCurrentWeek = data.weekStart >= data.currentWeekStart;
  const hasRecords = current.totalRecords > 0 || previous.totalRecords > 0;

  const minutes = (value: number) => f.duration(value);
  const count = (value: number) => f.number(value, 1);
  const ml = (value: number) => f.ml(value);
  const optional = <T,>(value: number | null, format: (v: number) => T) =>
    value === null ? null : format(value);

  return (
    <div className="space-y-5">
      <nav aria-label={t("title")} className="flex items-center gap-2">
        <Button asChild variant="outline" size="icon-lg" className="h-12 w-12 shrink-0">
          <Link
            href={weekHref(childId, addDaysToKey(data.weekStart, -7))}
            aria-label={t("week.previous")}
          >
            <ChevronLeft className="!size-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1 text-center">
          <p className="font-display text-lg font-semibold leading-tight">
            {t("week.label", { week: weekNumber })}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("week.range", {
              start: f.shortDate(data.weekStart),
              end: f.fullDate(data.weekEnd),
            })}
          </p>
        </div>
        {isCurrentWeek ? (
          <Button
            variant="outline"
            size="icon-lg"
            className="h-12 w-12 shrink-0"
            disabled
            aria-label={t("week.next")}
          >
            <ChevronRight className="!size-5" />
          </Button>
        ) : (
          <Button asChild variant="outline" size="icon-lg" className="h-12 w-12 shrink-0">
            <Link
              href={weekHref(childId, addDaysToKey(data.weekStart, 7))}
              aria-label={t("week.next")}
            >
              <ChevronRight className="!size-5" />
            </Link>
          </Button>
        )}
      </nav>

      {isCurrentWeek && <p className="text-sm text-muted-foreground">{t("week.ongoing")}</p>}

      {current.totalRecords === 0 ? (
        <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <section aria-labelledby="digest-averages" className="space-y-2">
          <div>
            <h2 id="digest-averages" className="text-lg font-semibold">
              {t("average")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("averageHint")}</p>
          </div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border">
            <Metric
              label={t("metrics.sleepTotal")}
              value={optional(current.sleep.totalMinutesPerDay, minutes)}
              change={compareValues(
                current.sleep.totalMinutesPerDay,
                previous.sleep.totalMinutesPerDay,
                1
              )}
              formatAmount={minutes}
            />
            <Metric
              label={t("metrics.sleepNight")}
              value={optional(current.sleep.nightMinutesPerDay, minutes)}
              change={compareValues(
                current.sleep.nightMinutesPerDay,
                previous.sleep.nightMinutesPerDay,
                1
              )}
              formatAmount={minutes}
            />
            <Metric
              label={t("metrics.sleepNaps")}
              value={optional(current.sleep.napMinutesPerDay, minutes)}
              hint={
                current.sleep.napsPerDay === null
                  ? undefined
                  : t("metrics.napsPerDay", { count: count(current.sleep.napsPerDay) })
              }
              change={compareValues(
                current.sleep.napMinutesPerDay,
                previous.sleep.napMinutesPerDay,
                1
              )}
              formatAmount={minutes}
            />
            <Metric
              label={t("metrics.feeds")}
              value={optional(current.feeds.perDay, count)}
              change={compareValues(current.feeds.perDay, previous.feeds.perDay)}
              formatAmount={count}
            />
            {(current.feeds.bottleMlPerDay !== null || previous.feeds.bottleMlPerDay !== null) && (
              <Metric
                label={t("metrics.bottle")}
                value={optional(current.feeds.bottleMlPerDay, ml)}
                change={compareValues(
                  current.feeds.bottleMlPerDay,
                  previous.feeds.bottleMlPerDay,
                  1
                )}
                formatAmount={ml}
              />
            )}
            <Metric
              label={t("metrics.wet")}
              value={optional(current.diapers.wetPerDay, count)}
              change={compareValues(current.diapers.wetPerDay, previous.diapers.wetPerDay)}
              formatAmount={count}
            />
            <Metric
              label={t("metrics.dirty")}
              value={optional(current.diapers.dirtyPerDay, count)}
              change={compareValues(current.diapers.dirtyPerDay, previous.diapers.dirtyPerDay)}
              formatAmount={count}
            />
            {(current.pumping.mlPerDay !== null || previous.pumping.mlPerDay !== null) && (
              <Metric
                label={t("metrics.pumping")}
                value={optional(current.pumping.mlPerDay, ml)}
                change={compareValues(current.pumping.mlPerDay, previous.pumping.mlPerDay, 1)}
                formatAmount={ml}
              />
            )}
          </dl>
        </section>
      )}

      {hasRecords && (
        <>
          <section aria-labelledby="digest-growth" className="space-y-2">
            <h2 id="digest-growth" className="text-lg font-semibold">
              {t("growth.title")}
            </h2>
            {data.growth.entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("growth.empty")}</p>
            ) : (
              <ul className="divide-y overflow-hidden rounded-lg border bg-card">
                {data.growth.entries.map((entry, index, all) => (
                  <li key={entry.date} className="space-y-1 p-3.5">
                    <p className="text-xs text-muted-foreground">{f.fullDate(entry.date)}</p>
                    <dl className="flex flex-wrap gap-x-5 gap-y-1">
                      {entry.weightKg !== null && (
                        <GrowthValue
                          label={t("growth.weight")}
                          value={f.weightKg(entry.weightKg)}
                          change={index === all.length - 1 ? data.growth.change.weightKg : null}
                          format={(v) => f.weightKg(Math.abs(v))}
                        />
                      )}
                      {entry.heightCm !== null && (
                        <GrowthValue
                          label={t("growth.height")}
                          value={f.heightCm(entry.heightCm)}
                          change={index === all.length - 1 ? data.growth.change.heightCm : null}
                          format={(v) => f.heightCm(Math.abs(v))}
                        />
                      )}
                      {entry.headCircumferenceCm !== null && (
                        <GrowthValue
                          label={t("growth.head")}
                          value={f.heightCm(entry.headCircumferenceCm)}
                          change={index === all.length - 1 ? data.growth.change.headCircumferenceCm : null}
                          format={(v) => f.heightCm(Math.abs(v))}
                        />
                      )}
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="digest-words" className="space-y-2">
            <h2 id="digest-words" className="text-lg font-semibold">
              {t("words.title")}
            </h2>
            <div className="space-y-1 rounded-lg border bg-card p-3.5">
              <p className="font-medium">{t("words.count", { count: current.newWords })}</p>
              {data.words.length > 0 && (
                <p className="text-sm text-muted-foreground">{data.words.join(", ")}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {t("words.previous", { count: previous.newWords })}
              </p>
            </div>
          </section>

          <section aria-labelledby="digest-journal" className="space-y-2">
            <h2 id="digest-journal" className="text-lg font-semibold">
              {t("journal.title")}
            </h2>
            <Link
              href={`/dashboard/${childId}/journal` as Route}
              className="flex min-h-14 items-center justify-between gap-3 rounded-lg border bg-card p-3.5 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
            >
              <span>
                <span className="block font-medium">
                  {t("journal.count", { count: current.journalEntries })}
                </span>
                <span className="block text-xs text-muted-foreground">{t("journal.open")}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
            </Link>
          </section>
        </>
      )}
    </div>
  );
}

function GrowthValue({
  label,
  value,
  change,
  format,
}: {
  label: string;
  value: string;
  change: number | null;
  format: (value: number) => string;
}) {
  const t = useTranslations("digest.growth");
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-display text-lg font-semibold tabular-nums">{value}</dd>
      {change !== null && (
        <dd className="text-xs text-muted-foreground">
          {change > 0 && t("changeUp", { value: format(change) })}
          {change < 0 && t("changeDown", { value: `−${format(change)}` })}
          {change === 0 && t("changeSame")}
        </dd>
      )}
    </div>
  );
}
