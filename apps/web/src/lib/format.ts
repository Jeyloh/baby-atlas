"use client";

import { useMemo } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { format as formatDateFns, isToday, isYesterday, parseISO } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import { nb } from "date-fns/locale/nb";

type DateInput = Date | string;

const toDate = (value: DateInput) =>
  typeof value === "string" ? parseISO(value) : value;

/**
 * Locale-aware formatting for the UI. Time is always 24-hour (HH:mm) and all
 * units are metric. Use this instead of the English helpers in
 * `@baby-atlas/utils` (formatDate, formatTimeSince, formatDurationPrecise).
 */
export function useFormatters() {
  const t = useTranslations("format");
  const locale = useLocale();
  const intl = useFormatter();

  return useMemo(() => {
    const dateLocale = locale === "nb" ? nb : enUS;

    const number = (value: number, maximumFractionDigits = 1) =>
      intl.number(value, { maximumFractionDigits });

    const time = (value: DateInput) => formatDateFns(toDate(value), "HH:mm");

    /** Pattern uses date-fns tokens, rendered in the active locale. */
    const pattern = (value: DateInput, fmt: string) =>
      formatDateFns(toDate(value), fmt, { locale: dateLocale });

    const shortDate = (value: DateInput) =>
      pattern(value, locale === "nb" ? "d. MMM" : "MMM d");

    const fullDate = (value: DateInput) =>
      pattern(value, locale === "nb" ? "d. MMM yyyy" : "MMM d, yyyy");

    const longDate = (value: DateInput) =>
      pattern(value, locale === "nb" ? "EEEE d. MMMM yyyy" : "EEEE, MMMM d, yyyy");

    const weekday = (value: DateInput) => pattern(value, "EEE");

    /** "I dag", "I går" or "3. mai" */
    const date = (value: DateInput) => {
      const d = toDate(value);
      if (isToday(d)) return t("today");
      if (isYesterday(d)) return t("yesterday");
      return shortDate(d);
    };

    /** "I dag kl. 14:30", "I går kl. 14:30" or "3. mai kl. 14:30" */
    const dateTime = (value: DateInput) => {
      const d = toDate(value);
      const timeText = time(d);
      if (isToday(d)) return t("todayAtTime", { time: timeText });
      if (isYesterday(d)) return t("yesterdayAtTime", { time: timeText });
      return t("dateAtTime", { date: shortDate(d), time: timeText });
    };

    const timeRange = (start: DateInput, end: DateInput | null | undefined) =>
      end
        ? t("timeRange", { start: time(start), end: time(end) })
        : t("timeRangeOngoing", { start: time(start) });

    /** Whole minutes: "45 min", "1 t 25 min", "2 t" */
    const duration = (totalMinutes: number) => {
      const minutes = Math.max(0, Math.round(totalMinutes));
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      if (h === 0) return t("durationMinutes", { minutes: m });
      if (m === 0) return t("durationHours", { hours: h });
      return t("durationHoursMinutes", { hours: h, minutes: m });
    };

    /** Seconds precision, drops zero parts: "1 t 25 min 10 sek", "45 sek" */
    const durationPrecise = (start: DateInput, end: DateInput) => {
      const diffSeconds = Math.max(
        0,
        Math.floor((toDate(end).getTime() - toDate(start).getTime()) / 1000)
      );
      const hours = Math.floor(diffSeconds / 3600);
      const minutes = Math.floor((diffSeconds % 3600) / 60);
      const seconds = diffSeconds % 60;

      if (hours > 0) {
        if (seconds > 0) {
          return t("durationHoursMinutesSeconds", { hours, minutes, seconds });
        }
        return minutes > 0
          ? t("durationHoursMinutes", { hours, minutes })
          : t("durationHours", { hours });
      }
      if (minutes > 0) {
        return seconds > 0
          ? t("durationMinutesSeconds", { minutes, seconds })
          : t("durationMinutes", { minutes });
      }
      return t("durationSeconds", { seconds });
    };

    /** "2 t 15 min siden", "3 dager siden", "akkurat nå" */
    const timeSince = (value: DateInput) => {
      const diffMs = Date.now() - toDate(value).getTime();
      const totalMinutes = Math.floor(diffMs / 60000);
      if (diffMs < 0 || totalMinutes <= 0) return t("justNow");

      const totalDays = Math.floor(totalMinutes / (60 * 24));
      if (totalDays > 0) {
        return t("timeSince", { value: t("daysAgo", { count: totalDays }) });
      }
      return t("timeSince", { value: duration(totalMinutes) });
    };

    const ml = (value: number) =>
      value >= 1000
        ? t("units.liters", { value: number(value / 1000, 1) })
        : t("units.ml", { value: number(value, 0) });

    const weightKg = (kg: number) =>
      kg < 1
        ? t("units.g", { value: number(Math.round(kg * 1000), 0) })
        : t("units.kg", { value: number(kg, 2) });

    const heightCm = (cm: number) => t("units.cm", { value: number(cm, 1) });

    const temperatureC = (celsius: number) =>
      t("units.celsius", { value: intl.number(celsius, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) });

    return {
      number,
      time,
      date,
      dateTime,
      shortDate,
      fullDate,
      longDate,
      weekday,
      pattern,
      timeRange,
      duration,
      durationPrecise,
      timeSince,
      ml,
      weightKg,
      heightCm,
      temperatureC,
      dateLocale,
    };
  }, [t, locale, intl]);
}
