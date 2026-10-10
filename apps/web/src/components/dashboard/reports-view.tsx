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
      <TabsList className="w-full grid grid-cols-3">
        <TabsTrigger value="day">{t("day")}</TabsTrigger>
        <TabsTrigger value="week">{t("week")}</TabsTrigger>
        <TabsTrigger value="list">{t("list")}</TabsTrigger>
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
