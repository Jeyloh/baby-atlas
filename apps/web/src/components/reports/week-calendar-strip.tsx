"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  startOfWeek,
  addDays,
  isToday,
  startOfDay,
} from "@baby-atlas/utils";
import { useTranslations } from "next-intl";
import { useFormatters } from "@/lib/format";

interface WeekCalendarStripProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

export function WeekCalendarStrip({
  selectedDate,
  onDateSelect,
}: WeekCalendarStripProps) {
  const t = useTranslations("reports");
  const f = useFormatters();
  const weekStart = useMemo(
    () => startOfWeek(selectedDate, { weekStartsOn: 1 }),
    [selectedDate]
  );

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const handlePrevWeek = () => {
    onDateSelect(addDays(selectedDate, -7));
  };

  const handleNextWeek = () => {
    onDateSelect(addDays(selectedDate, 7));
  };

  const isSameDay = (a: Date, b: Date) =>
    startOfDay(a).getTime() === startOfDay(b).getTime();

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" onClick={handlePrevWeek} aria-label={t("previousWeek")}>
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex-1 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          const today = isToday(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateSelect(day)}
              aria-label={f.longDate(day)}
              aria-pressed={isSelected}
              className={`flex flex-col items-center justify-center min-h-12 p-1.5 md:p-2 rounded-lg transition-colors touch-manipulation ${
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : today
                    ? "bg-primary/10 hover:bg-primary/20"
                    : "hover:bg-muted"
              }`}
            >
              <span className="text-[10px] md:text-xs font-medium">
                {f.weekday(day)}
              </span>
              <span className={`text-base md:text-lg font-semibold ${today && !isSelected ? "text-primary" : ""}`}>
                {f.pattern(day, "d")}
              </span>
            </button>
          );
        })}
      </div>

      <Button variant="ghost" size="icon" onClick={handleNextWeek} aria-label={t("nextWeek")}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
