"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc/provider";
import { useRealtimeSync } from "@/hooks/use-realtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { calculateDurationMinutes } from "@baby-atlas/utils";
import { useTranslations } from "next-intl";
import { useFormatters } from "@/lib/format";
import Link from "next/link";
import { ArrowLeft, Baby, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function FeedingPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = use(params);
  const { toast } = useToast();
  const t = useTranslations("activities");
  const tEnums = useTranslations("enums");
  const fmt = useFormatters();
  const utils = trpc.useUtils();

  useRealtimeSync(childId);

  const { data: child } = trpc.child.get.useQuery({ id: childId });
  const { data: todayRecords } = trpc.feeding.list.useQuery({
    childId,
    period: "today",
  });
  const { data: weekRecords } = trpc.feeding.list.useQuery({
    childId,
    period: "week",
  });
  const { data: summary } = trpc.feeding.summary.useQuery({
    childId,
    period: "today",
  });

  const deleteFeeding = trpc.feeding.delete.useMutation({
    onSuccess: () => {
      utils.feeding.list.invalidate({ childId });
      utils.feeding.summary.invalidate({ childId });
      toast({ title: t("feeding.deleted") });
    },
  });

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
          <h1 className="text-2xl font-bold">{t("feeding.title")}</h1>
          <p className="text-sm text-muted-foreground">{child?.name}</p>
        </div>
      </div>

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>{t("todaySummary")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{summary.breastfeedingCount}</p>
                <p className="text-sm text-muted-foreground">{tEnums("feedingType.BREAST")}</p>
                <p className="text-xs text-muted-foreground">
                  {fmt.duration(summary.breastfeedingMinutes)}
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.bottleCount}</p>
                <p className="text-sm text-muted-foreground">{tEnums("feedingType.BOTTLE")}</p>
                <p className="text-xs text-muted-foreground">
                  {fmt.ml(summary.totalBottleMl)}
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.solidsCount}</p>
                <p className="text-sm text-muted-foreground">{tEnums("feedingType.SOLIDS")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">{t("tabToday")}</TabsTrigger>
          <TabsTrigger value="week">{t("tabWeek")}</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-2">
          {todayRecords?.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              {t("feeding.emptyToday")}
            </p>
          )}
          {todayRecords?.map((record) => (
            <FeedingRecordCard
              key={record.id}
              record={record}
              onDelete={() => deleteFeeding.mutate({ id: record.id })}
            />
          ))}
        </TabsContent>

        <TabsContent value="week" className="space-y-2">
          {weekRecords?.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              {t("feeding.emptyWeek")}
            </p>
          )}
          {weekRecords?.map((record) => (
            <FeedingRecordCard
              key={record.id}
              record={record}
              onDelete={() => deleteFeeding.mutate({ id: record.id })}
              showDate
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FeedingRecordCard({
  record,
  onDelete,
  showDate = false,
}: {
  record: {
    id: string;
    feedingType: string;
    startTime: Date;
    endTime: Date | null;
    side: string | null;
    amountMl: number | null;
    foodItems: string[];
  };
  onDelete: () => void;
  showDate?: boolean;
}) {
  const t = useTranslations("activities");
  const tEnums = useTranslations("enums");
  const fmt = useFormatters();

  const duration =
    record.feedingType === "BREAST" && record.endTime
      ? calculateDurationMinutes(record.startTime, record.endTime)
      : null;

  const getSideLabel = () => {
    switch (record.side) {
      case "LEFT":
      case "RIGHT":
      case "BOTH":
        return tEnums(`breastSide.${record.side}`);
      default:
        return record.side ?? "";
    }
  };

  const getDetails = () => {
    switch (record.feedingType) {
      case "BREAST":
        return duration
          ? t("feeding.breastDetail", {
              side: getSideLabel(),
              duration: fmt.duration(duration),
            })
          : t("feeding.breastInProgress", { side: getSideLabel() });
      case "BOTTLE":
        return record.amountMl !== null ? fmt.ml(record.amountMl) : "";
      case "SOLIDS":
        return record.foodItems.join(", ");
      default:
        return "";
    }
  };

  const getLabel = () => {
    switch (record.feedingType) {
      case "BREAST":
      case "BOTTLE":
      case "SOLIDS":
        return tEnums(`feedingType.${record.feedingType}`);
      default:
        return record.feedingType;
    }
  };

  return (
    <Card>
      <CardContent className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <Baby className="h-5 w-5 text-pink-500" />
          <div>
            <p className="font-medium">{getLabel()}</p>
            <p className="text-sm text-muted-foreground">
              {showDate && `${fmt.date(record.startTime)} `}
              {fmt.time(record.startTime)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-sm">{getDetails()}</p>
          <Button variant="ghost" size="icon" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
            <span className="sr-only">{t("delete")}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
