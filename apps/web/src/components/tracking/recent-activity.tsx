"use client";

import { trpc } from "@/lib/trpc/provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import { calculateDurationMinutes } from "@baby-atlas/utils";
import { useFormatters } from "@/lib/format";
import { Moon, Baby, Droplets, Milk, Dumbbell } from "lucide-react";

interface RecentActivityProps {
  childId: string;
}

type ActivityItem = {
  id: string;
  type: "sleep" | "feeding" | "diaper" | "pumping" | "activity";
  time: Date;
  details: string;
  subDetails?: string;
};

export function RecentActivity({ childId }: RecentActivityProps) {
  const t = useTranslations("tracking.recentActivity");
  const tEnums = useTranslations("enums");
  const { time, duration: formatDuration, ml } = useFormatters();
  const sideLabel = (side: string | null) =>
    side === "LEFT" || side === "RIGHT" || side === "BOTH"
      ? tEnums(`breastSide.${side}`)
      : (side ?? "");

  const { data: sleepRecords } = trpc.sleep.list.useQuery({
    childId,
    period: "today",
  });

  const { data: feedingRecords } = trpc.feeding.list.useQuery({
    childId,
    period: "today",
  });

  const { data: diaperRecords } = trpc.diaper.list.useQuery({
    childId,
    period: "today",
  });

  const activities: ActivityItem[] = [];

  sleepRecords?.forEach((record) => {
    const duration = record.endTime
      ? calculateDurationMinutes(record.startTime, record.endTime)
      : null;
    activities.push({
      id: `sleep-${record.id}`,
      type: "sleep",
      time: record.startTime,
      details: tEnums(record.sleepType === "NAP" ? "sleepType.NAP" : "sleepType.NIGHT"),
      subDetails: duration !== null ? formatDuration(duration) : t("inProgress"),
    });
  });

  feedingRecords?.forEach((record) => {
    let details = "";
    let subDetails = "";

    if (record.feedingType === "BREAST") {
      details = t("breastfeeding", { side: sideLabel(record.side) });
      if (record.endTime) {
        const minutes = calculateDurationMinutes(record.startTime, record.endTime);
        subDetails = formatDuration(minutes);
      } else {
        subDetails = t("inProgress");
      }
    } else if (record.feedingType === "BOTTLE") {
      details = tEnums("feedingType.BOTTLE");
      subDetails = record.amountMl ? ml(record.amountMl) : "";
    } else {
      details = tEnums("feedingType.SOLIDS");
      subDetails = record.foodItems?.join(", ") || "";
    }

    activities.push({
      id: `feeding-${record.id}`,
      type: "feeding",
      time: record.startTime,
      details,
      subDetails,
    });
  });

  diaperRecords?.forEach((record) => {
    activities.push({
      id: `diaper-${record.id}`,
      type: "diaper",
      time: record.time,
      details: tEnums(`diaperType.${record.diaperType}`),
      subDetails: record.color ? tEnums(`diaperColor.${record.color}`) : undefined,
    });
  });

  activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  const recentActivities = activities.slice(0, 10);

  const getIcon = (type: ActivityItem["type"]) => {
    switch (type) {
      case "sleep":
        return <Moon className="h-4 w-4 text-indigo-500" />;
      case "feeding":
        return <Baby className="h-4 w-4 text-pink-500" />;
      case "diaper":
        return <Droplets className="h-4 w-4 text-blue-500" />;
      case "pumping":
        return <Milk className="h-4 w-4 text-purple-500" />;
      case "activity":
        return <Dumbbell className="h-4 w-4 text-green-500" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {recentActivities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t("empty")}
          </p>
        ) : (
          <div className="space-y-3">
            {recentActivities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div className="flex items-center gap-3">
                  {getIcon(activity.type)}
                  <div>
                    <p className="font-medium text-sm">{activity.details}</p>
                    {activity.subDetails && (
                      <p className="text-xs text-muted-foreground">
                        {activity.subDetails}
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {time(activity.time)}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
