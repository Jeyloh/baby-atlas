"use client";

import { use, useState } from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc/provider";
import { ActiveTimers } from "@/components/tracking/active-timers";
import { LogModal } from "@/components/tracking/log-modal";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  ArrowLeft,
  Moon,
  Baby,
  Droplets,
  ChevronRight,
  Utensils,
  HeartPulse,
  Pill,
  Ruler,
  Thermometer,
  Sparkles,
} from "lucide-react";

type LogType = "sleep" | "breast" | "bottle" | "diaper" | "solids" | "pumping" | "medicine" | "growth" | "temperature" | "activity";

type TrackingLabelKey =
  | "sleep"
  | "breastfeeding"
  | "bottle"
  | "diaper"
  | "solids"
  | "pumping"
  | "medicine"
  | "growth"
  | "temperature"
  | "activity";

export default function LogPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = use(params);
  const t = useTranslations("activities");
  const tEnums = useTranslations("enums");
  const tCommon = useTranslations("common");
  const { data: child, isLoading } = trpc.child.get.useQuery({ id: childId });

  const [modalType, setModalType] = useState<LogType | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">{tCommon("loading")}</div>
      </div>
    );
  }

  if (!child) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <p className="text-muted-foreground">{t("notFound")}</p>
        <Button asChild>
          <Link href="/dashboard">{t("backToDashboard")}</Link>
        </Button>
      </div>
    );
  }

  const logOptions: {
    type: LogType;
    labelKey: TrackingLabelKey;
    icon: typeof Moon;
    iconColor: string;
    bgColor: string;
    textColor: string;
    descColor: string;
  }[] = [
    {
      type: "sleep",
      labelKey: "sleep",
      icon: Moon,
      iconColor: "text-indigo-600 dark:text-indigo-400",
      bgColor: "bg-indigo-100 dark:bg-indigo-900/50",
      textColor: "text-indigo-900 dark:text-indigo-100",
      descColor: "text-indigo-700 dark:text-indigo-300",
    },
    {
      type: "breast",
      labelKey: "breastfeeding",
      icon: Baby,
      iconColor: "text-pink-600 dark:text-pink-400",
      bgColor: "bg-pink-100 dark:bg-pink-900/50",
      textColor: "text-pink-900 dark:text-pink-100",
      descColor: "text-pink-700 dark:text-pink-300",
    },
    {
      type: "bottle",
      labelKey: "bottle",
      icon: Baby,
      iconColor: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-100 dark:bg-orange-900/50",
      textColor: "text-orange-900 dark:text-orange-100",
      descColor: "text-orange-700 dark:text-orange-300",
    },
    {
      type: "diaper",
      labelKey: "diaper",
      icon: Droplets,
      iconColor: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-900/50",
      textColor: "text-blue-900 dark:text-blue-100",
      descColor: "text-blue-700 dark:text-blue-300",
    },
    {
      type: "solids",
      labelKey: "solids",
      icon: Utensils,
      iconColor: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-100 dark:bg-emerald-900/50",
      textColor: "text-emerald-900 dark:text-emerald-100",
      descColor: "text-emerald-700 dark:text-emerald-300",
    },
    {
      type: "pumping",
      labelKey: "pumping",
      icon: HeartPulse,
      iconColor: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-100 dark:bg-purple-900/50",
      textColor: "text-purple-900 dark:text-purple-100",
      descColor: "text-purple-700 dark:text-purple-300",
    },
    {
      type: "medicine",
      labelKey: "medicine",
      icon: Pill,
      iconColor: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-100 dark:bg-red-900/50",
      textColor: "text-red-900 dark:text-red-100",
      descColor: "text-red-700 dark:text-red-300",
    },
    {
      type: "growth",
      labelKey: "growth",
      icon: Ruler,
      iconColor: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-100 dark:bg-green-900/50",
      textColor: "text-green-900 dark:text-green-100",
      descColor: "text-green-700 dark:text-green-300",
    },
    {
      type: "temperature",
      labelKey: "temperature",
      icon: Thermometer,
      iconColor: "text-rose-600 dark:text-rose-400",
      bgColor: "bg-rose-100 dark:bg-rose-900/50",
      textColor: "text-rose-900 dark:text-rose-100",
      descColor: "text-rose-700 dark:text-rose-300",
    },
    {
      type: "activity",
      labelKey: "activity",
      icon: Sparkles,
      iconColor: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-100 dark:bg-amber-900/50",
      textColor: "text-amber-900 dark:text-amber-100",
      descColor: "text-amber-700 dark:text-amber-300",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/dashboard/${childId}`}>
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">{t("back")}</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{t("log.title")}</h1>
          <p className="text-sm text-muted-foreground">{child.name}</p>
        </div>
      </div>

      <ActiveTimers childId={childId} />

      <div className="space-y-3">
        {logOptions.map((option) => (
          <button
            key={option.type}
            onClick={() => setModalType(option.type)}
            className={`w-full flex items-center gap-4 p-4 rounded-xl ${option.bgColor} hover:opacity-90 transition-opacity text-left border border-transparent dark:border-white/10`}
          >
            <option.icon className={`h-8 w-8 ${option.iconColor}`} />
            <div className="flex-1">
              <p className={`font-semibold ${option.textColor}`}>
                {tEnums(`trackingType.${option.labelKey}`)}
              </p>
              <p className={`text-sm ${option.descColor}`}>
                {t(`log.descriptions.${option.type}`)}
              </p>
            </div>
            <ChevronRight className={`h-5 w-5 ${option.iconColor}`} />
          </button>
        ))}
      </div>

      {modalType && (
        <LogModal
          childId={childId}
          type={modalType}
          open={!!modalType}
          onOpenChange={(open) => !open && setModalType(null)}
        />
      )}
    </div>
  );
}
