"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  getActivityCardClasses,
  getActivityChipClasses,
  type ActivityCategory,
} from "@/lib/activity-colors";
import { TimeSince } from "@/components/ui/time-since";
import { LogModal } from "@/components/tracking/log-modal";
import { useFormatters } from "@/lib/format";
import type enumMessages from "../../../messages/nb/enums.json";
import { Moon, Baby, Milk, Utensils, Droplets, HeartPulse, Pill, Ruler, Thermometer, Sparkles } from "lucide-react";

interface ActivityCardProps {
  category: ActivityCategory;
  childId: string;
  lastTime: Date | null;
  details?: string;
  isActive?: boolean;
  activeLabel?: string;
}

type CategoryLabelKey =
  | "trackingType.sleep"
  | "trackingType.breastfeeding"
  | "trackingType.bottle"
  | "trackingType.solids"
  | "trackingType.diaper"
  | "trackingType.pumping"
  | "trackingType.medicine"
  | "trackingType.growth"
  | "trackingType.temperatureShort"
  | "trackingType.activity"
  | "diaperType.WET"
  | "diaperType.DIRTY"
  | "diaperType.BOTH"
  | "diaperType.DRY";

const categoryConfig: Record<
  ActivityCategory,
  {
    icon: typeof Moon;
    labelKey: CategoryLabelKey;
    logType: "sleep" | "breast" | "bottle" | "diaper" | "solids" | "pumping" | "medicine" | "growth" | "temperature" | "activity";
  }
> = {
  sleep: { icon: Moon, labelKey: "trackingType.sleep", logType: "sleep" },
  nursing: { icon: Baby, labelKey: "trackingType.breastfeeding", logType: "breast" },
  bottle: { icon: Milk, labelKey: "trackingType.bottle", logType: "bottle" },
  solids: { icon: Utensils, labelKey: "trackingType.solids", logType: "solids" },
  diaper: { icon: Droplets, labelKey: "trackingType.diaper", logType: "diaper" },
  diaperWet: { icon: Droplets, labelKey: "diaperType.WET", logType: "diaper" },
  diaperDirty: { icon: Droplets, labelKey: "diaperType.DIRTY", logType: "diaper" },
  diaperBoth: { icon: Droplets, labelKey: "diaperType.BOTH", logType: "diaper" },
  diaperDry: { icon: Droplets, labelKey: "diaperType.DRY", logType: "diaper" },
  pumping: { icon: HeartPulse, labelKey: "trackingType.pumping", logType: "pumping" },
  medicine: { icon: Pill, labelKey: "trackingType.medicine", logType: "medicine" },
  growth: { icon: Ruler, labelKey: "trackingType.growth", logType: "growth" },
  temperature: { icon: Thermometer, labelKey: "trackingType.temperatureShort", logType: "temperature" },
  activity: { icon: Sparkles, labelKey: "trackingType.activity", logType: "activity" },
};

export function ActivityCard({
  category,
  childId,
  lastTime,
  details,
  isActive,
  activeLabel,
}: ActivityCardProps) {
  const t = useTranslations("dashboard.card");
  const tEnums = useTranslations("enums");
  const [modalOpen, setModalOpen] = useState(false);
  const config = categoryConfig[category];
  const Icon = config.icon;

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className={`relative flex w-full items-start gap-3 rounded-lg p-3 text-left touch-manipulation transition-colors active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${getActivityCardClasses(category)}`}
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${getActivityChipClasses(category)}`}
          aria-hidden
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-tight">{tEnums(config.labelKey)}</span>
          {isActive ? (
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-highlight px-2 py-0.5 text-xs font-medium text-highlight-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" aria-hidden />
              {activeLabel || t("active")}
            </span>
          ) : (
            <TimeSince
              date={lastTime}
              className="mt-0.5 block text-xs opacity-75"
              fallback={t("noRecords")}
            />
          )}
          {details && !isActive && (            <span className="mt-0.5 block truncate text-xs opacity-75">{details}</span>
          )}
        </span>
      </button>

      <LogModal
        childId={childId}
        type={config.logType}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </>
  );
}

type Side = "LEFT" | "RIGHT" | "BOTH";

const isSide = (value: string | null | undefined): value is Side =>
  value === "LEFT" || value === "RIGHT" || value === "BOTH";

/**
 * Locale-aware detail lines for the home dashboard cards (metric only).
 */
export function useActivityDetails() {
  const t = useTranslations("dashboard.card");
  const tSide = useTranslations("dashboard.side");
  const tEnums = useTranslations("enums");
  const { durationPrecise, ml, weightKg, heightCm, temperatureC } = useFormatters();

  const sleep = (
    lastSleep: { startTime: Date; endTime: Date | null; sleepType: string } | null
  ): string => {
    if (!lastSleep || !lastSleep.endTime) return "";
    return durationPrecise(lastSleep.startTime, lastSleep.endTime);
  };

  const nursing = (
    lastFeeding: {
      startTime: Date;
      endTime: Date | null;
      side: string | null;
    } | null
  ): string => {
    if (!lastFeeding || !lastFeeding.endTime) return "";
    const duration = durationPrecise(lastFeeding.startTime, lastFeeding.endTime);
    const sideInfo = isSide(lastFeeding.side) ? tSide(lastFeeding.side) : "";
    return `${duration} ${sideInfo}`.trim();
  };

  const bottle = (
    lastBottle: {
      amountMl: number | null;
      bottleContentType: string | null;
    } | null
  ): string => {
    if (!lastBottle) return "";
    const amount = lastBottle.amountMl ? ml(lastBottle.amountMl) : "";
    const type =
      lastBottle.bottleContentType === "BREAST_MILK" ||
      lastBottle.bottleContentType === "FORMULA"
        ? tEnums(`bottleContent.${lastBottle.bottleContentType}`)
        : "";
    return [amount, type].filter(Boolean).join(" ");
  };

  const diaper = (
    lastDiaper: {
      diaperType: string;
      amount?: string | null;
      color?: string | null;
    } | null
  ): string => {
    if (!lastDiaper) return "";
    switch (lastDiaper.diaperType) {
      case "WET":
        return tEnums("diaperType.WET");
      case "DIRTY":
        return tEnums("diaperType.DIRTY");
      case "BOTH":
        return t("mixedDiaper");
      default:
        return tEnums("diaperType.DRY");
    }
  };

  const solids = (lastSolids: { notes?: string | null } | null): string => {
    if (!lastSolids) return "";
    return lastSolids.notes ?? "";
  };

  const pumping = (
    lastPumping: {
      startTime: Date;
      endTime: Date | null;
      amountMl: number | null;
    } | null
  ): string => {
    if (!lastPumping) return "";
    const parts: string[] = [];
    if (lastPumping.endTime) {
      parts.push(durationPrecise(lastPumping.startTime, lastPumping.endTime));
    }
    if (lastPumping.amountMl) {
      parts.push(ml(lastPumping.amountMl));
    }
    return parts.join(" ");
  };

  const medicine = (
    lastMedicine: {
      medicine: { name: string };
      dosageGiven?: string | null;
    } | null
  ): string => {
    if (!lastMedicine) return "";
    const name = lastMedicine.medicine.name;
    return lastMedicine.dosageGiven ? `${name} (${lastMedicine.dosageGiven})` : name;
  };

  const growth = (
    lastGrowth: {
      weightKg?: number | null;
      heightCm?: number | null;
      headCircumferenceCm?: number | null;
    } | null
  ): string => {
    if (!lastGrowth) return "";
    const parts: string[] = [];
    if (lastGrowth.weightKg) parts.push(weightKg(lastGrowth.weightKg));
    if (lastGrowth.heightCm) parts.push(heightCm(lastGrowth.heightCm));
    return parts.join(" / ");
  };

  const temperature = (
    lastTemperature: { temperatureCelsius: number } | null
  ): string => {
    if (!lastTemperature) return "";
    return temperatureC(lastTemperature.temperatureCelsius);
  };

  const activity = (
    lastActivity: {
      activityType: string;
      startTime: Date;
      endTime: Date | null;
    } | null
  ): string => {
    if (!lastActivity) return "";
    const type = tEnums(
      `activityType.${lastActivity.activityType as keyof typeof enumMessages.activityType}`
    );
    if (lastActivity.endTime) {
      return `${type} (${durationPrecise(lastActivity.startTime, lastActivity.endTime)})`;
    }
    return type;
  };

  return { sleep, nursing, bottle, diaper, solids, pumping, medicine, growth, temperature, activity };
}
