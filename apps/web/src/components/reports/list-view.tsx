"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ActivityRow } from "@/components/reports/activity-row";
import { startOfWeek, addDays } from "@baby-atlas/utils";
import { useTranslations } from "next-intl";
import { useFormatters } from "@/lib/format";

interface ListViewProps {
  childId: string;
}

export function ListView({ childId }: ListViewProps) {
  const t = useTranslations("reports");
  const f = useFormatters();
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const { data: childData } = trpc.child.get.useQuery({ id: childId });
  const { data, isLoading } = trpc.timeline.getList.useQuery({
    childId,
    weekStart,
  });

  const childName = childData?.name ?? t("defaultChildName");

  const handlePrevWeek = () => {
    setWeekStart((prev) => addDays(prev, -7));
  };

  const handleNextWeek = () => {
    setWeekStart((prev) => addDays(prev, 7));
  };

  // Group activities by date
  const groupedByDate = data?.groupedByDate ?? {};
  const sortedDates = Object.keys(groupedByDate).sort((a, b) =>
    b.localeCompare(a)
  );

  return (
    <div className="space-y-4 mt-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={handlePrevWeek} aria-label={t("previousWeek")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-medium">
          {f.shortDate(weekStart)} – {f.fullDate(addDays(weekStart, 6))}
        </span>
        <Button variant="outline" size="icon" onClick={handleNextWeek} aria-label={t("nextWeek")}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">
            {t("loadingActivities")}
          </div>
        </div>
      ) : sortedDates.length > 0 ? (
        <div className="space-y-4">
          {sortedDates.map((dateKey) => (
            <Card key={dateKey}>
              <CardContent className="p-4">
                <h3 className="font-medium text-sm text-muted-foreground mb-3">
                  {/* Add T12:00:00 to parse as local noon, avoiding UTC midnight timezone shift */}
                  {f.longDate(new Date(dateKey + "T12:00:00"))}
                </h3>
                <div className="space-y-2">
                  {groupedByDate[dateKey].map((activity) => (
                    <ActivityRow
                      key={`${activity.type}-${activity.record.id}`}
                      activity={activity}
                      childId={childId}
                      childName={childName}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          {t("noActivitiesWeek")}
        </div>
      )}
    </div>
  );
}
