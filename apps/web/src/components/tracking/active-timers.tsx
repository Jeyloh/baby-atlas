"use client";

import { useTranslations } from "next-intl";
import enumMessages from "../../../messages/nb/enums.json";
import { useAllTimers } from "@/hooks/use-timer";
import { useTimerStore, formatElapsedTime } from "@/stores/timer-store";
import { trpc } from "@/lib/trpc/provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Square, Moon, Baby, Dumbbell, Milk } from "lucide-react";
import { useEffect, useState } from "react";

interface ActiveTimersProps {
  childId: string;
}

export function ActiveTimers({ childId }: ActiveTimersProps) {
  const t = useTranslations("tracking.activeTimers");
  const tEnums = useTranslations("enums");
  const timers = useAllTimers(childId);
  const stopTimer = useTimerStore((state) => state.stopTimer);
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [, setTick] = useState(0);

  const endSleep = trpc.sleep.end.useMutation({
    onSuccess: () => {
      utils.sleep.list.invalidate();
      utils.sleep.summary.invalidate({ childId });
      toast({ title: t("toast.sleepRecorded") });
    },
  });

  const endBreastfeeding = trpc.feeding.endBreastfeeding.useMutation({
    onSuccess: () => {
      utils.feeding.list.invalidate();
      utils.feeding.summary.invalidate({ childId });
      toast({ title: t("toast.feedingRecorded") });
    },
  });

  const endPumping = trpc.pumping.end.useMutation({
    onSuccess: () => {
      utils.pumping.list.invalidate({ childId });
      utils.pumping.summary.invalidate({ childId });
      toast({ title: t("toast.pumpingRecorded") });
    },
  });

  const endActivity = trpc.activity.end.useMutation({
    onSuccess: () => {
      utils.activity.list.invalidate({ childId });
      utils.activity.summary.invalidate({ childId });
      toast({ title: t("toast.activityRecorded") });
    },
  });

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  if (timers.length === 0) return null;

  const handleStop = async (timer: (typeof timers)[0]) => {
    stopTimer(timer.id);

    if (timer.recordId) {
      switch (timer.type) {
        case "sleep":
          await endSleep.mutateAsync({ id: timer.recordId });
          break;
        case "feeding":
          await endBreastfeeding.mutateAsync({ id: timer.recordId });
          break;
        case "pumping":
          await endPumping.mutateAsync({ id: timer.recordId });
          break;
        case "activity":
          await endActivity.mutateAsync({ id: timer.recordId });
          break;
      }
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "sleep":
        return <Moon className="h-4 w-4" />;
      case "feeding":
        return <Baby className="h-4 w-4" />;
      case "pumping":
        return <Milk className="h-4 w-4" />;
      case "activity":
        return <Dumbbell className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const sideLabel = (side: string) =>
    side === "LEFT" || side === "RIGHT" || side === "BOTH"
      ? tEnums(`breastSide.${side}`)
      : side;

  const getLabel = (timer: (typeof timers)[0]) => {
    switch (timer.type) {
      case "sleep":
        return tEnums(
          timer.metadata?.sleepType === "NIGHT" ? "sleepType.NIGHT" : "sleepType.NAP"
        );
      case "feeding":
        return t("breastfeeding", {
          side: timer.metadata?.feedingSide
            ? `(${sideLabel(timer.metadata.feedingSide)})`
            : "",
        }).trim();
      case "pumping":
        return timer.metadata?.pumpingSide
          ? t("pumpingSide", { side: sideLabel(timer.metadata.pumpingSide) })
          : t("pumping");
      case "activity": {
        const type = timer.metadata?.activityType;
        return type && type in enumMessages.activityType
          ? tEnums(`activityType.${type as keyof typeof enumMessages.activityType}`)
          : t("activity");
      }
      default:
        return timer.type;
    }
  };

  return (
    <Card className="border-primary/50 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {timers.map((timer) => (
            <div
              key={timer.id}
              className="flex items-center justify-between p-3 rounded-lg bg-background border"
            >
              <div className="flex items-center gap-3">
                {getIcon(timer.type)}
                <div>
                  <p className="font-medium">{getLabel(timer)}</p>
                  <p className="text-2xl font-mono">
                    {formatElapsedTime(Date.now() - timer.startTime)}
                  </p>
                </div>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="min-h-12 min-w-12"
                onClick={() => handleStop(timer)}
              >
                <Square className="h-4 w-4 mr-1" />
                {t("stop")}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
