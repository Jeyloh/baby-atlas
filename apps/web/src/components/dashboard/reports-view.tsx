"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DayView } from "@/components/reports/day-view";
import { WeekView } from "@/components/reports/week-view";
import { ListView } from "@/components/reports/list-view";

interface ReportsViewProps {
  childId: string;
}

export function ReportsView({ childId }: ReportsViewProps) {
  const t = useTranslations("dashboard.reportsTabs");
  const [activeTab, setActiveTab] = useState("day");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      {/* Secondary navigation: lighter than the main tabs above */}
      <TabsList className="h-10 gap-1 bg-transparent p-0">
        {(["day", "week", "list"] as const).map((value) => (
          <TabsTrigger
            key={value}
            value={value}
            className="h-10 px-4 data-[state=active]:bg-secondary data-[state=active]:shadow-none"
          >
            {t(value)}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="day">
        <DayView childId={childId} />
      </TabsContent>

      <TabsContent value="week">
        <WeekView childId={childId} />
      </TabsContent>

      <TabsContent value="list">
        <ListView childId={childId} />
      </TabsContent>
    </Tabs>
  );
}
