"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/provider";
import { useTimer } from "@/hooks/use-timer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { useFormatters } from "@/lib/format";
import { Moon, Baby, Droplets, Plus, Play, Square } from "lucide-react";

type BottleContentType = "FORMULA" | "BREAST_MILK";

interface QuickLogGridProps {
  childId: string;
}

export function QuickLogGrid({ childId }: QuickLogGridProps) {
  const t = useTranslations("tracking.quickLog");
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const sleepTimer = useTimer(childId, "sleep");
  const feedingTimer = useTimer(childId, "feeding");

  const startSleep = trpc.sleep.start.useMutation({
    onSuccess: () => {
      utils.sleep.getActive.invalidate({ childId });
      toast({ title: t("toast.sleepStarted") });
    },
  });

  const endSleep = trpc.sleep.end.useMutation({
    onSuccess: () => {
      utils.sleep.list.invalidate();
      utils.sleep.getActive.invalidate({ childId });
      utils.sleep.summary.invalidate({ childId });
      toast({ title: t("toast.sleepRecorded") });
    },
  });

  const startBreastfeeding = trpc.feeding.startBreastfeeding.useMutation({
    onSuccess: () => {
      utils.feeding.getActive.invalidate({ childId });
      toast({ title: t("toast.feedingStarted") });
    },
  });

  const endBreastfeeding = trpc.feeding.endBreastfeeding.useMutation({
    onSuccess: () => {
      utils.feeding.list.invalidate();
      utils.feeding.getActive.invalidate({ childId });
      utils.feeding.summary.invalidate({ childId });
      toast({ title: t("toast.feedingRecorded") });
    },
  });

  const logDiaper = trpc.diaper.log.useMutation({
    onSuccess: () => {
      utils.diaper.list.invalidate();
      utils.diaper.summary.invalidate({ childId });
      toast({ title: t("toast.diaperLogged") });
    },
  });

  const logBottle = trpc.feeding.logBottle.useMutation({
    onSuccess: () => {
      utils.feeding.list.invalidate();
      utils.feeding.summary.invalidate({ childId });
      toast({ title: t("toast.bottleLogged") });
    },
  });

  const handleSleepToggle = async (sleepType: "NAP" | "NIGHT") => {
    if (sleepTimer.isRunning) {
      const timer = sleepTimer.stop();
      if (timer?.recordId) {
        await endSleep.mutateAsync({ id: timer.recordId });
      }
    } else {
      const result = await startSleep.mutateAsync({ childId, sleepType });
      sleepTimer.start({ sleepType });
      sleepTimer.update({ recordId: result.id });
    }
  };

  const handleFeedingToggle = async (side: "LEFT" | "RIGHT") => {
    if (feedingTimer.isRunning) {
      const timer = feedingTimer.stop();
      if (timer?.recordId) {
        await endBreastfeeding.mutateAsync({ id: timer.recordId });
      }
    } else {
      const result = await startBreastfeeding.mutateAsync({ childId, side });
      feedingTimer.start({ feedingSide: side });
      feedingTimer.update({ recordId: result.id });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SleepButton
            isRunning={sleepTimer.isRunning}
            elapsed={sleepTimer.elapsedFormatted}
            onToggle={handleSleepToggle}
          />

          <FeedingButton
            isRunning={feedingTimer.isRunning}
            elapsed={feedingTimer.elapsedFormatted}
            side={feedingTimer.timer?.metadata?.feedingSide}
            onToggle={handleFeedingToggle}
          />

          <BottleDialog childId={childId} onLog={logBottle.mutateAsync} />

          <DiaperButtons childId={childId} onLog={logDiaper.mutateAsync} />
        </div>
      </CardContent>
    </Card>
  );
}

function SleepButton({
  isRunning,
  elapsed,
  onToggle,
}: {
  isRunning: boolean;
  elapsed: string;
  onToggle: (type: "NAP" | "NIGHT") => void;
}) {
  const t = useTranslations("tracking.quickLog");
  const tEnums = useTranslations("enums");
  const [open, setOpen] = useState(false);

  if (isRunning) {
    return (
      <Button
        variant="destructive"
        className="h-20 flex-col gap-1"
        onClick={() => onToggle("NAP")}
      >
        <Square className="h-5 w-5" />
        <span className="text-xs">{elapsed}</span>
        <span className="text-xs">{t("stopSleep")}</span>
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-20 flex-col gap-1">
          <Moon className="h-5 w-5" />
          <span className="text-xs">{tEnums("trackingType.sleep")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("startSleepTitle")}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <Button
            size="lg"
            onClick={() => {
              onToggle("NAP");
              setOpen(false);
            }}
          >
            <Moon className="mr-2 h-4 w-4" />
            {tEnums("sleepType.NAP")}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => {
              onToggle("NIGHT");
              setOpen(false);
            }}
          >
            <Moon className="mr-2 h-4 w-4" />
            {tEnums("sleepType.NIGHT")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FeedingButton({
  isRunning,
  elapsed,
  side,
  onToggle,
}: {
  isRunning: boolean;
  elapsed: string;
  side?: "LEFT" | "RIGHT" | "BOTH";
  onToggle: (side: "LEFT" | "RIGHT") => void;
}) {
  const t = useTranslations("tracking.quickLog");
  const tEnums = useTranslations("enums");
  const [open, setOpen] = useState(false);

  if (isRunning) {
    return (
      <Button
        variant="destructive"
        className="h-20 flex-col gap-1"
        onClick={() => onToggle("LEFT")}
      >
        <Square className="h-5 w-5" />
        <span className="text-xs">{elapsed}</span>
        <span className="text-xs">
          {side ? t("stopSide", { side: tEnums(`breastSide.${side}`) }) : t("stopFeeding")}
        </span>
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-20 flex-col gap-1">
          <Baby className="h-5 w-5" />
          <span className="text-xs">{tEnums("trackingType.breastfeeding")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("startBreastfeedingTitle")}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <Button
            size="lg"
            onClick={() => {
              onToggle("LEFT");
              setOpen(false);
            }}
          >
            {t("leftSide")}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => {
              onToggle("RIGHT");
              setOpen(false);
            }}
          >
            {t("rightSide")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const BOTTLE_PRESETS_ML = [60, 90, 120, 150, 180];

function BottleDialog({
  childId,
  onLog,
}: {
  childId: string;
  onLog: (data: { childId: string; startTime: Date; amountMl: number; bottleContentType?: BottleContentType }) => Promise<unknown>;
}) {
  const t = useTranslations("tracking.quickLog");
  const tEnums = useTranslations("enums");
  const { ml } = useFormatters();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("120");
  const [contentType, setContentType] = useState<BottleContentType>("FORMULA");

  const handleSubmit = async () => {
    await onLog({
      childId,
      startTime: new Date(),
      amountMl: parseInt(amount, 10),
      bottleContentType: contentType,
    });
    setOpen(false);
    setAmount("120");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-20 flex-col gap-1">
          <Baby className="h-5 w-5" />
          <span className="text-xs">{tEnums("feedingType.BOTTLE")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("logBottleTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("contentType")}</Label>
            <Select value={contentType} onValueChange={(v) => setContentType(v as BottleContentType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FORMULA">{tEnums("bottleContent.FORMULA")}</SelectItem>
                <SelectItem value="BREAST_MILK">{tEnums("bottleContent.BREAST_MILK")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">{t("amount")} (ml)</Label>
            <Input
              id="amount"
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              max="500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {BOTTLE_PRESETS_ML.map((value) => (
              <Button
                key={value}
                variant={amount === String(value) ? "default" : "outline"}
                size="sm"
                onClick={() => setAmount(String(value))}
              >
                {ml(value)}
              </Button>
            ))}
          </div>
          <Button className="w-full" onClick={handleSubmit}>
            {t("logBottle")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DiaperButtons({
  childId,
  onLog,
}: {
  childId: string;
  onLog: (data: { childId: string; diaperType: "WET" | "DIRTY" | "BOTH" }) => Promise<unknown>;
}) {
  const t = useTranslations("tracking.quickLog");

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        className="min-h-12 text-xs"
        onClick={() => onLog({ childId, diaperType: "WET" })}
      >
        <Droplets className="mr-1 h-3 w-3" />
        {t("wet")}
      </Button>
      <Button
        variant="outline"
        className="min-h-12 text-xs"
        onClick={() => onLog({ childId, diaperType: "DIRTY" })}
      >
        <Droplets className="mr-1 h-3 w-3" />
        {t("dirty")}
      </Button>
    </div>
  );
}
