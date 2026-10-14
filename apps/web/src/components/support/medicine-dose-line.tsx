"use client";

import { useTranslations } from "next-intl";
import { isToday } from "date-fns";
import type { MedicineDoseStatus } from "@baby-atlas/utils";
import { useFormatters } from "@/lib/format";

/** Time of day for today, date and time otherwise. */
export function useDoseClock() {
  const f = useFormatters();
  return (date: Date) => (isToday(date) ? f.time(date) : f.dateTime(date));
}

interface MedicineDoseLineProps {
  status: MedicineDoseStatus;
  maxDosesPer24h: number | null;
  now: Date;
}

/**
 * Factual lines about a medicine compared with the limits the parent set:
 * last dose, doses in the last 24 hours and when the next may be given.
 */
export function MedicineDoseLines({ status, maxDosesPer24h, now }: MedicineDoseLineProps) {
  const t = useTranslations("support.medicineStatus");
  const clock = useDoseClock();

  if (!status.lastDose) return null;

  const waiting = status.nextAllowedAt !== null && status.nextAllowedAt > now;

  let next: string | null = null;
  if (status.maxReached && status.nextByMax && status.nextByMax > now) {
    next = t("maxReached", { time: clock(status.nextByMax) });
  } else if (waiting && status.nextAllowedAt) {
    next = t("nextFrom", { time: clock(status.nextAllowedAt) });
  } else if (status.nextByInterval) {
    next = t("intervalPassed");
  }

  return (
    <div className="space-y-0.5 text-xs text-muted-foreground">
      <p>
        {t("lastDose", { time: clock(status.lastDose.time) })}
        {" · "}
        {maxDosesPer24h
          ? t("dosesOfMax", { count: status.dosesLast24h, max: maxDosesPer24h })
          : t("doses", { count: status.dosesLast24h })}
      </p>
      {next && <p className={waiting ? "text-foreground" : undefined}>{next}</p>}
    </div>
  );
}
