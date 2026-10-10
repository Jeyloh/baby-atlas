"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface TimerDisplayProps {
  elapsedMs: number;
  className?: string;
  size?: "default" | "large";
}

export function TimerDisplay({
  elapsedMs,
  className,
  size = "default",
}: TimerDisplayProps) {
  const t = useTranslations("tracking.timer");
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  // Long sleeps read as 1:42:05 instead of 102:05
  const text = hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div
        className={cn(
          "font-display font-semibold leading-none tracking-tight tabular-nums",
          size === "large" ? "text-6xl" : "text-5xl"
        )}
      >
        {text}
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        {hours > 0 ? t("hoursMinutesSeconds") : t("minutesSeconds")}
      </div>
    </div>
  );
}
