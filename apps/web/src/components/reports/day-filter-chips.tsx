"use client";

import { useTranslations } from "next-intl";
import {
  Baby,
  Droplets,
  HeartPulse,
  Milk,
  Moon,
  Pill,
  Ruler,
  Sparkles,
  Thermometer,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { useFormatters } from "@/lib/format";
import {
  getActivityChipClasses,
  getActivityIconClasses,
  type ActivityCategory,
} from "@/lib/activity-colors";
import { cn } from "@/lib/utils";
import type { DayFilter, DaySummaryItem } from "./day-filters";

const CONFIG: Record<
  DayFilter,
  {
    icon: LucideIcon;
    category: ActivityCategory;
    labelKey:
      | "trackingType.sleep"
      | "trackingType.breastfeeding"
      | "trackingType.bottle"
      | "trackingType.solids"
      | "trackingType.diaper"
      | "trackingType.pumping"
      | "trackingType.medicine"
      | "trackingType.temperatureShort"
      | "trackingType.growth"
      | "trackingType.activity";
  }
> = {
  sleep: { icon: Moon, category: "sleep", labelKey: "trackingType.sleep" },
  nursing: { icon: Baby, category: "nursing", labelKey: "trackingType.breastfeeding" },
  bottle: { icon: Milk, category: "bottle", labelKey: "trackingType.bottle" },
  solids: { icon: Utensils, category: "solids", labelKey: "trackingType.solids" },
  diaper: { icon: Droplets, category: "diaper", labelKey: "trackingType.diaper" },
  pumping: { icon: HeartPulse, category: "pumping", labelKey: "trackingType.pumping" },
  medicine: { icon: Pill, category: "medicine", labelKey: "trackingType.medicine" },
  temperature: { icon: Thermometer, category: "temperature", labelKey: "trackingType.temperatureShort" },
  growth: { icon: Ruler, category: "growth", labelKey: "trackingType.growth" },
  activity: { icon: Sparkles, category: "activity", labelKey: "trackingType.activity" },
};

/**
 * The day's totals, doubling as filters for the timeline. Tap to show only
 * that activity, tap more to combine, "Vis alt" to clear.
 */
export function DayFilterChips({
  items,
  selected,
  onToggle,
  onClear,
}: {
  items: DaySummaryItem[];
  selected: ReadonlySet<DayFilter>;
  onToggle: (filter: DayFilter) => void;
  onClear: () => void;
}) {
  const t = useTranslations("reports.filters");
  const te = useTranslations("enums");
  const f = useFormatters();

  const format = (item: DaySummaryItem) => {
    switch (item.summary.kind) {
      case "minutes":
        return f.duration(item.summary.value);
      case "ml":
        return f.ml(item.summary.value);
      case "count":
        return String(item.summary.value);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {selected.size === 0 ? t("hint") : t("filtered", { count: selected.size })}
        </p>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="-mr-2 min-h-10 rounded-full px-3 text-sm font-medium text-primary hover:bg-muted"
          >
            {t("showAll")}
          </button>
        )}
      </div>

      {/* Full-bleed horizontal scroller on phones, wraps on wider screens */}
      <div
        role="group"
        aria-label={t("label")}
        className="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const { icon: Icon, category, labelKey } = CONFIG[item.filter];
          const isOn = selected.has(item.filter);
          return (
            <button
              key={item.filter}
              type="button"
              aria-pressed={isOn}
              onClick={() => onToggle(item.filter)}
              className={cn(
                "flex min-h-14 shrink-0 snap-start items-center gap-2.5 rounded-xl border py-2 pl-2.5 pr-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isOn
                  ? cn("border-transparent", getActivityChipClasses(category))
                  : "bg-card hover:bg-muted",
                !isOn && item.count === 0 && "opacity-60"
              )}
            >
              <Icon
                className={cn("h-5 w-5 shrink-0", !isOn && getActivityIconClasses(category))}
                aria-hidden
              />
              <span className="leading-tight">
                <span className="block font-display text-base font-semibold tabular-nums">
                  {format(item)}
                </span>
                <span className={cn("block text-xs", isOn ? "opacity-85" : "text-muted-foreground")}>
                  {te(labelKey)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
