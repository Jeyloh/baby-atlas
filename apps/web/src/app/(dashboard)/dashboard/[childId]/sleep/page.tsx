"use client";

import { use, useState } from "react";
import { trpc } from "@/lib/trpc/provider";
import { useRealtimeSync } from "@/hooks/use-realtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { calculateDurationMinutes } from "@baby-atlas/utils";
import { useTranslations } from "next-intl";
import { useFormatters } from "@/lib/format";
import Link from "next/link";
import { ArrowLeft, Moon, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function SleepPage({
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
  const { data: todayRecords } = trpc.sleep.list.useQuery({
    childId,
    period: "today",
  });
  const { data: weekRecords } = trpc.sleep.list.useQuery({
    childId,
    period: "week",
  });
  const { data: summary } = trpc.sleep.summary.useQuery({
    childId,
    period: "today",
  });

  const deleteSleep = trpc.sleep.delete.useMutation({
    onSuccess: () => {
      utils.sleep.list.invalidate();
      utils.sleep.summary.invalidate({ childId });
      toast({ title: t("sleep.deleted") });
    },
  });

  const logSleep = trpc.sleep.log.useMutation({
    onSuccess: () => {
      utils.sleep.list.invalidate();
      utils.sleep.summary.invalidate({ childId });
      toast({ title: t("sleep.logged") });
    },
  });

  const [logOpen, setLogOpen] = useState(false);
  const [logData, setLogData] = useState({
    startTime: "",
    endTime: "",
    sleepType: "NAP" as "NAP" | "NIGHT",
  });

  const handleLogSleep = () => {
    if (logData.startTime && logData.endTime) {
      logSleep.mutate({
        childId,
        startTime: new Date(logData.startTime),
        endTime: new Date(logData.endTime),
        sleepType: logData.sleepType,
      });
      setLogOpen(false);
      setLogData({ startTime: "", endTime: "", sleepType: "NAP" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href={`/dashboard/${childId}`}>
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">{t("back")}</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{t("sleep.title")}</h1>
            <p className="text-sm text-muted-foreground">{child?.name}</p>
          </div>
        </div>
        <Dialog open={logOpen} onOpenChange={setLogOpen}>
          <DialogTrigger asChild>
            <Button>{t("sleep.logButton")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("sleep.dialogTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("sleep.sleepType")}</Label>
                <Select
                  value={logData.sleepType}
                  onValueChange={(v) =>
                    setLogData((d) => ({ ...d, sleepType: v as "NAP" | "NIGHT" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NAP">{tEnums("sleepType.NAP")}</SelectItem>
                    <SelectItem value="NIGHT">{tEnums("sleepType.NIGHT")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("sleep.startTime")}</Label>
                <Input
                  type="datetime-local"
                  value={logData.startTime}
                  onChange={(e) =>
                    setLogData((d) => ({ ...d, startTime: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t("sleep.endTime")}</Label>
                <Input
                  type="datetime-local"
                  value={logData.endTime}
                  onChange={(e) =>
                    setLogData((d) => ({ ...d, endTime: e.target.value }))
                  }
                />
              </div>
              <Button className="w-full" onClick={handleLogSleep}>
                {t("sleep.logButton")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>{t("todaySummary")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">
                  {fmt.duration(summary.totalMinutes)}
                </p>
                <p className="text-sm text-muted-foreground">{t("sleep.totalSleep")}</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.napCount}</p>
                <p className="text-sm text-muted-foreground">{t("sleep.naps")}</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.nightCount}</p>
                <p className="text-sm text-muted-foreground">{t("sleep.night")}</p>
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
              {t("sleep.emptyToday")}
            </p>
          )}
          {todayRecords?.map((record) => (
            <SleepRecordCard
              key={record.id}
              record={record}
              onDelete={() => deleteSleep.mutate({ id: record.id })}
            />
          ))}
        </TabsContent>

        <TabsContent value="week" className="space-y-2">
          {weekRecords?.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              {t("sleep.emptyWeek")}
            </p>
          )}
          {weekRecords?.map((record) => (
            <SleepRecordCard
              key={record.id}
              record={record}
              onDelete={() => deleteSleep.mutate({ id: record.id })}
              showDate
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SleepRecordCard({
  record,
  onDelete,
  showDate = false,
}: {
  record: {
    id: string;
    startTime: Date;
    endTime: Date | null;
    sleepType: string;
    quality: number | null;
  };
  onDelete: () => void;
  showDate?: boolean;
}) {
  const t = useTranslations("activities");
  const tEnums = useTranslations("enums");
  const fmt = useFormatters();
  const duration = record.endTime
    ? calculateDurationMinutes(record.startTime, record.endTime)
    : null;

  return (
    <Card>
      <CardContent className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <Moon className="h-5 w-5 text-indigo-500" />
          <div>
            <p className="font-medium">
              {record.sleepType === "NAP"
                ? tEnums("sleepType.NAP")
                : tEnums("sleepType.NIGHT")}
            </p>
            <p className="text-sm text-muted-foreground">
              {showDate && `${fmt.date(record.startTime)} `}
              {fmt.time(record.startTime)}
              {record.endTime && ` – ${fmt.time(record.endTime)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-mono text-lg">
              {duration !== null ? fmt.duration(duration) : t("sleep.inProgress")}
            </p>
            {record.quality && (
              <p className="text-xs text-muted-foreground">
                {t("sleep.quality", { quality: record.quality })}
              </p>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
            <span className="sr-only">{t("delete")}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
