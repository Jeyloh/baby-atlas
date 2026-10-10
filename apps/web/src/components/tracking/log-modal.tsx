"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/provider";
import { useTimer } from "@/hooks/use-timer";
import {
  useTimerStore,
  getLeftElapsedMs,
  getRightElapsedMs,
  getTotalBreastfeedingElapsedMs,
} from "@/stores/timer-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { TimeRow } from "@/components/ui/time-row";
import { SimpleToggleGroup } from "@/components/ui/simple-toggle-group";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { useFormatters } from "@/lib/format";
import {
  Play,
  Square,
  Droplets,
  Cloud,
  CloudRain,
  Plus,
  Check,
  X,
  Bath,
  Baby as BabyIcon,
  Tv,
  Heart,
  BookOpen,
  Smile,
  Sun,
  Home,
} from "lucide-react";
import { TimerDisplay } from "@/components/tracking/timer-display";
import { BreastSideButton } from "@/components/tracking/breast-side-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type LogType = "sleep" | "breast" | "bottle" | "diaper" | "solids" | "pumping" | "medicine" | "growth" | "temperature" | "activity";

interface LogModalProps {
  childId: string;
  type: LogType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LogModal({ childId, type, open, onOpenChange }: LogModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        {type === "sleep" && (
          <SleepModal childId={childId} onClose={() => onOpenChange(false)} />
        )}
        {type === "breast" && (
          <BreastModal childId={childId} onClose={() => onOpenChange(false)} />
        )}
        {type === "bottle" && (
          <BottleModal childId={childId} onClose={() => onOpenChange(false)} />
        )}
        {type === "diaper" && (
          <DiaperModal childId={childId} onClose={() => onOpenChange(false)} />
        )}
        {type === "solids" && (
          <SolidsModal childId={childId} onClose={() => onOpenChange(false)} />
        )}
        {type === "pumping" && (
          <PumpingModal childId={childId} onClose={() => onOpenChange(false)} />
        )}
        {type === "medicine" && (
          <MedicineModal childId={childId} onClose={() => onOpenChange(false)} />
        )}
        {type === "growth" && (
          <GrowthModal childId={childId} onClose={() => onOpenChange(false)} />
        )}
        {type === "temperature" && (
          <TemperatureModal childId={childId} onClose={() => onOpenChange(false)} />
        )}
        {type === "activity" && (
          <ActivityModal childId={childId} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SleepModal({ childId, onClose }: { childId: string; onClose: () => void }) {
  const t = useTranslations("logModal");
  const tEnums = useTranslations("enums");
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const sleepTimer = useTimer(childId, "sleep");
  const stopTimer = useTimerStore((state) => state.stopTimer);

  const [sleepType, setSleepType] = useState<"NAP" | "NIGHT">("NAP");
  const [startTime, setStartTime] = useState<Date | null>(new Date());
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);

  // Sync sleepType with running timer's metadata
  useEffect(() => {
    if (sleepTimer.isRunning && sleepTimer.timer?.metadata?.sleepType) {
      setSleepType(sleepTimer.timer.metadata.sleepType);
    }
  }, [sleepTimer.isRunning, sleepTimer.timer?.metadata?.sleepType]);

  const startSleep = trpc.sleep.start.useMutation({
    onSuccess: (result) => {
      utils.sleep.getActive.invalidate({ childId });
      utils.timeline.getLastActivities.invalidate({ childId });
      sleepTimer.start({ sleepType });
      sleepTimer.update({ recordId: result.id });
      toast({ title: t("sleep.timerStarted") });
      // Don't close - stay in modal to show running timer
    },
  });

  const endSleep = trpc.sleep.end.useMutation({
    onSuccess: () => {
      utils.sleep.list.invalidate();
      utils.sleep.summary.invalidate({ childId });
      utils.timeline.getLastActivities.invalidate({ childId });
      toast({ title: t("sleep.recorded") });
      onClose();
    },
  });

  const logSleep = trpc.sleep.log.useMutation({
    onSuccess: () => {
      utils.sleep.list.invalidate();
      utils.sleep.summary.invalidate({ childId });
      utils.timeline.getLastActivities.invalidate({ childId });
      toast({ title: t("sleep.recorded") });
      onClose();
    },
  });

  const handleStart = () => {
    if (startTime) {
      startSleep.mutate({ childId, sleepType, startTime });
    }
  };

  const handleStop = async () => {
    if (sleepTimer.timer?.recordId) {
      stopTimer(sleepTimer.timer.id);
      await endSleep.mutateAsync({ id: sleepTimer.timer.recordId });
    }
  };

  const handleManualSave = () => {
    if (endTime && startTime) {
      logSleep.mutate({
        childId,
        sleepType,
        startTime,
        endTime,
      });
    }
  };

  const isLoading = startSleep.isPending || logSleep.isPending || endSleep.isPending;

  // Timer is running - show running state
  if (sleepTimer.isRunning && !showManualEntry) {
    const runningType = tEnums(
      sleepTimer.timer?.metadata?.sleepType === "NIGHT" ? "sleepType.NIGHT" : "sleepType.NAP"
    );

    return (
      <>
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-center">{t("sleep.running")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center py-8 gap-4">
          <span className="text-sm font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
            {runningType}
          </span>
          <TimerDisplay elapsedMs={sleepTimer.elapsedMs} size="large" />
        </div>

        <div className="p-6 pt-0 flex flex-col gap-3">
          <Button
            size="lg"
            variant="destructive"
            className="w-full h-14 text-lg"
            onClick={handleStop}
            disabled={isLoading}
          >
            <Square className="h-5 w-5 mr-2" />
            {t("stop")}
          </Button>
        </div>
      </>
    );
  }

  // Manual entry mode
  if (showManualEntry) {
    return (
      <>
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-center">{t("sleep.log")}</DialogTitle>
        </DialogHeader>

        <SimpleToggleGroup
          options={[
            { value: "NAP", label: tEnums("sleepType.NAP") },
            { value: "NIGHT", label: tEnums("sleepType.NIGHT") },
          ]}
          value={sleepType}
          onChange={setSleepType}
        />

        <TimeRow label={t("startTime")} value={startTime} onChange={setStartTime} />
        <TimeRow label={t("endTime")} value={endTime} onChange={setEndTime} placeholder={t("setTime")} />

        <div className="p-6 pt-4 flex flex-col gap-3">
          <Button
            size="lg"
            className="w-full h-14 text-lg"
            onClick={handleManualSave}
            disabled={isLoading || !startTime || !endTime}
          >
            {t("save")}
          </Button>
          <button
            onClick={() => setShowManualEntry(false)}
            className="text-sm min-h-12 px-4 text-muted-foreground hover:text-foreground"
          >
            {t("startTimerInstead")}
          </button>
        </div>
      </>
    );
  }

  // Default: Start timer UI
  return (
    <>
      <DialogHeader className="p-6 pb-0">
        <DialogTitle className="text-center">{t("sleep.add")}</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col items-center py-6 gap-6">
        <TimerDisplay elapsedMs={0} />

        <SimpleToggleGroup
          options={[
            { value: "NAP", label: tEnums("sleepType.NAP") },
            { value: "NIGHT", label: tEnums("sleepType.NIGHT") },
          ]}
          value={sleepType}
          onChange={setSleepType}
        />

        <button
          onClick={handleStart}
          disabled={isLoading}
          className="w-32 h-32 rounded-full bg-primary text-primary-foreground shadow-[0_8px_24px_-8px_rgba(42,91,110,0.55)] flex flex-col items-center justify-center gap-1.5 transition-transform active:scale-95 disabled:opacity-50"
        >
          <Play className="h-8 w-8 fill-current" />
          <span className="font-semibold">{t("start")}</span>
        </button>
      </div>

      <div className="p-6 pt-0 flex justify-center">
        <button
          onClick={() => setShowManualEntry(true)}
          className="text-sm min-h-12 px-4 text-muted-foreground hover:text-foreground"
        >
          {t("manualEntry")}
        </button>
      </div>
    </>
  );
}

function BreastModal({ childId, onClose }: { childId: string; onClose: () => void }) {
  const t = useTranslations("logModal");
  const tEnums = useTranslations("enums");
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const feedingTimer = useTimer(childId, "feeding");
  const stopTimer = useTimerStore((state) => state.stopTimer);
  const switchSideInStore = useTimerStore((state) => state.switchBreastfeedingSide);

  const [side, setSide] = useState<"LEFT" | "RIGHT">("LEFT");
  const [startTime, setStartTime] = useState<Date | null>(new Date());
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);

  // Force re-render every second to update elapsed time displays
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!feedingTimer.isRunning) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [feedingTimer.isRunning]);

  // Query for last side info
  const { data: summary } = trpc.feeding.summary.useQuery({
    childId,
    period: "today",
  });

  // Determine which side was used last
  const lastSide: "LEFT" | "RIGHT" | null = (() => {
    if (!summary?.lastLeftSide && !summary?.lastRightSide) return null;
    if (!summary.lastLeftSide) return "RIGHT";
    if (!summary.lastRightSide) return "LEFT";
    return new Date(summary.lastLeftSide) > new Date(summary.lastRightSide)
      ? "LEFT"
      : "RIGHT";
  })();

  const startBreastfeeding = trpc.feeding.startBreastfeeding.useMutation({
    onSuccess: (result) => {
      utils.feeding.getActive.invalidate({ childId });
      utils.timeline.getLastActivities.invalidate({ childId });
      feedingTimer.start({ feedingSide: side });
      feedingTimer.update({ recordId: result.id });
      toast({ title: t("breast.timerStarted") });
      // Don't close - stay in modal to show running timer
    },
  });

  const endBreastfeeding = trpc.feeding.endBreastfeeding.useMutation({
    onSuccess: () => {
      utils.feeding.list.invalidate();
      utils.feeding.summary.invalidate({ childId });
      utils.timeline.getLastActivities.invalidate({ childId });
      toast({ title: t("breast.recorded") });
      onClose();
    },
  });

  const logBreastfeeding = trpc.feeding.logBreastfeeding.useMutation({
    onSuccess: () => {
      utils.feeding.list.invalidate();
      utils.feeding.summary.invalidate({ childId });
      utils.timeline.getLastActivities.invalidate({ childId });
      toast({ title: t("breast.recorded") });
      onClose();
    },
  });

  const switchBreastfeedingSide = trpc.feeding.switchBreastfeedingSide.useMutation();

  const handleSideClick = (clickedSide: "LEFT" | "RIGHT") => {
    if (feedingTimer.isRunning) {
      // Switch sides - calculate current per-side times before switching
      const timer = feedingTimer.timer;
      if (!timer?.recordId) return;

      const leftMs = getLeftElapsedMs(timer);
      const rightMs = getRightElapsedMs(timer);

      // Switch side in store
      switchSideInStore(timer.id, clickedSide);

      // Update database with accumulated times
      switchBreastfeedingSide.mutate({
        id: timer.recordId,
        newSide: clickedSide,
        leftDurationSeconds: Math.round(leftMs / 1000),
        rightDurationSeconds: Math.round(rightMs / 1000),
      });
      return;
    }
    setSide(clickedSide);
    // Start the timer immediately when clicking a side
    startBreastfeeding.mutate({ childId, side: clickedSide, startTime: new Date() });
  };

  const handleStop = async () => {
    const timer = feedingTimer.timer;
    if (timer?.recordId) {
      // Calculate final per-side durations
      const leftMs = getLeftElapsedMs(timer);
      const rightMs = getRightElapsedMs(timer);

      // Determine final side based on which has more time, or BOTH if both used
      const usedBothSides = leftMs > 0 && rightMs > 0;
      const finalSide = usedBothSides ? "BOTH" : (leftMs > 0 ? "LEFT" : "RIGHT");

      stopTimer(timer.id);
      await endBreastfeeding.mutateAsync({
        id: timer.recordId,
        side: finalSide,
        leftDurationSeconds: Math.round(leftMs / 1000),
        rightDurationSeconds: Math.round(rightMs / 1000),
      });
    }
  };

  const handleManualSave = () => {
    if (endTime && startTime) {
      logBreastfeeding.mutate({
        childId,
        side,
        startTime,
        endTime,
      });
    }
  };

  const isLoading = startBreastfeeding.isPending || logBreastfeeding.isPending || endBreastfeeding.isPending || switchBreastfeedingSide.isPending;
  const activeSide = feedingTimer.timer?.metadata?.feedingSide as "LEFT" | "RIGHT" | undefined;

  // Calculate per-side elapsed times for display
  const leftElapsedMs = getLeftElapsedMs(feedingTimer.timer);
  const rightElapsedMs = getRightElapsedMs(feedingTimer.timer);
  const totalElapsedMs = getTotalBreastfeedingElapsedMs(feedingTimer.timer);

  // Timer is running - show running state
  if (feedingTimer.isRunning && !showManualEntry) {
    return (
      <>
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-center">{tEnums("feedingType.BREAST")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center py-6 gap-6">
          <TimerDisplay elapsedMs={totalElapsedMs} size="large" />

          <div className="flex gap-6">
            <BreastSideButton
              side="LEFT"
              isActive={activeSide === "LEFT"}
              isLastSide={false}
              elapsedMs={leftElapsedMs}
              onClick={() => handleSideClick("LEFT")}
              disabled={activeSide === "LEFT" || isLoading}
            />
            <BreastSideButton
              side="RIGHT"
              isActive={activeSide === "RIGHT"}
              isLastSide={false}
              elapsedMs={rightElapsedMs}
              onClick={() => handleSideClick("RIGHT")}
              disabled={activeSide === "RIGHT" || isLoading}
            />
          </div>
        </div>

        <div className="p-6 pt-0 flex flex-col gap-3">
          <Button
            size="lg"
            variant="destructive"
            className="w-full h-14 text-lg"
            onClick={handleStop}
            disabled={isLoading}
          >
            <Square className="h-5 w-5 mr-2" />
            {t("stop")}
          </Button>
        </div>
      </>
    );
  }

  // Manual entry mode
  if (showManualEntry) {
    return (
      <>
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-center">{t("breast.log")}</DialogTitle>
        </DialogHeader>

        <SimpleToggleGroup
          options={[
            { value: "LEFT", label: tEnums("breastSide.LEFT") },
            { value: "RIGHT", label: tEnums("breastSide.RIGHT") },
          ]}
          value={side}
          onChange={(val) => setSide(val as "LEFT" | "RIGHT")}
        />

        <TimeRow label={t("startTime")} value={startTime} onChange={setStartTime} />
        <TimeRow label={t("endTime")} value={endTime} onChange={setEndTime} placeholder={t("setTime")} />

        <div className="p-6 pt-4 flex flex-col gap-3">
          <Button
            size="lg"
            className="w-full h-14 text-lg"
            onClick={handleManualSave}
            disabled={isLoading || !startTime || !endTime}
          >
            {t("save")}
          </Button>
          <button
            onClick={() => setShowManualEntry(false)}
            className="text-sm min-h-12 px-4 text-muted-foreground hover:text-foreground"
          >
            {t("startTimerInstead")}
          </button>
        </div>
      </>
    );
  }

  // Default: Huckleberry-style start UI with large side buttons
  return (
    <>
      <DialogHeader className="p-6 pb-0">
        <DialogTitle className="text-center">{t("breast.add")}</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col items-center py-6 gap-6">
        <TimerDisplay elapsedMs={0} />

        <div className="flex gap-6">
          <BreastSideButton
            side="LEFT"
            isActive={false}
            isLastSide={lastSide === "LEFT"}
            onClick={() => handleSideClick("LEFT")}
            disabled={isLoading}
          />
          <BreastSideButton
            side="RIGHT"
            isActive={false}
            isLastSide={lastSide === "RIGHT"}
            onClick={() => handleSideClick("RIGHT")}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="p-6 pt-0 flex justify-center">
        <button
          onClick={() => setShowManualEntry(true)}
          className="text-sm min-h-12 px-4 text-muted-foreground hover:text-foreground"
        >
          {t("manualEntry")}
        </button>
      </div>
    </>
  );
}

const BOTTLE_MAX_ML = 350;

function BottleModal({ childId, onClose }: { childId: string; onClose: () => void }) {
  const t = useTranslations("logModal");
  const tEnums = useTranslations("enums");
  const f = useFormatters();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [contentType, setContentType] = useState<"FORMULA" | "BREAST_MILK">("FORMULA");
  const [startTime, setStartTime] = useState<Date | null>(new Date());
  const [amountMl, setAmountMl] = useState(90);

  const logBottle = trpc.feeding.logBottle.useMutation({
    onSuccess: () => {
      utils.feeding.list.invalidate();
      utils.feeding.summary.invalidate({ childId });
      toast({ title: t("bottle.logged") });
      onClose();
    },
  });

  const handleSave = () => {
    if (!startTime) return;
    logBottle.mutate({
      childId,
      startTime,
      amountMl,
      bottleContentType: contentType,
    });
  };

  return (
    <>
      <DialogHeader className="p-6 pb-0">
        <DialogTitle className="text-center">{t("bottle.add")}</DialogTitle>
      </DialogHeader>

      <SimpleToggleGroup
        options={[
          { value: "FORMULA", label: tEnums("bottleContent.FORMULA") },
          { value: "BREAST_MILK", label: tEnums("bottleContent.BREAST_MILK") },
        ]}
        value={contentType}
        onChange={setContentType}
      />

      <TimeRow label={t("startTime")} value={startTime} onChange={setStartTime} />

      <div className="py-4 px-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <span className="text-muted-foreground">{t("amount")}</span>
          <span className="text-xl font-semibold">{f.ml(amountMl)}</span>
        </div>
        <Slider
          value={[amountMl]}
          onValueChange={([val]) => setAmountMl(val)}
          max={BOTTLE_MAX_ML}
          step={10}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>0</span>
          <span>{BOTTLE_MAX_ML}</span>
        </div>
      </div>

      <div className="p-6">
        <Button
          size="lg"
          className="w-full h-14 text-lg"
          onClick={handleSave}
          disabled={logBottle.isPending || !startTime}
        >
          {t("save")}
        </Button>
      </div>
    </>
  );
}

type DiaperAmount = "SMALL" | "MEDIUM" | "LARGE";
type DiaperColor = "YELLOW" | "GREEN" | "BROWN" | "BLACK" | "OTHER";

const amountOptions: DiaperAmount[] = ["SMALL", "MEDIUM", "LARGE"];

const colorOptions: { value: DiaperColor; color: string }[] = [
  { value: "YELLOW", color: "bg-yellow-400" },
  { value: "GREEN", color: "bg-green-500" },
  { value: "BROWN", color: "bg-amber-700" },
  { value: "BLACK", color: "bg-gray-900" },
  { value: "OTHER", color: "bg-gray-400" },
];

function DiaperModal({ childId, onClose }: { childId: string; onClose: () => void }) {
  const t = useTranslations("logModal");
  const tEnums = useTranslations("enums");
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [time, setTime] = useState<Date | null>(new Date());
  const [diaperType, setDiaperType] = useState<"WET" | "DIRTY" | "BOTH" | "DRY">("WET");
  const [amount, setAmount] = useState<DiaperAmount | null>(null);
  const [color, setColor] = useState<DiaperColor | null>(null);

  const logDiaper = trpc.diaper.log.useMutation({
    onSuccess: () => {
      utils.diaper.list.invalidate();
      utils.diaper.summary.invalidate({ childId });
      toast({ title: t("diaper.logged") });
      onClose();
    },
  });

  const handleSave = () => {
    logDiaper.mutate({
      childId,
      diaperType,
      time: time ?? undefined,
      amount: amount ?? undefined,
      color: color ?? undefined,
    });
  };

  const typeOptions = [
    { value: "WET" as const, label: tEnums("diaperType.WET"), icon: Droplets },
    { value: "DIRTY" as const, label: tEnums("diaperType.DIRTY"), icon: Cloud },
    { value: "BOTH" as const, label: tEnums("diaperType.BOTH"), icon: CloudRain },
  ];

  const showColorPicker = diaperType === "DIRTY" || diaperType === "BOTH";

  return (
    <>
      <DialogHeader className="p-6 pb-0">
        <DialogTitle className="text-center">{t("diaper.add")}</DialogTitle>
      </DialogHeader>

      <TimeRow label={t("time")} value={time} onChange={setTime} />

      <div className="px-6 py-4">
        <div className="flex justify-center gap-4">
          {typeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setDiaperType(option.value)}
              className={`flex flex-col items-center justify-center gap-1 p-2 rounded-full w-24 h-24 transition-colors ${
                diaperType === option.value
                  ? "bg-primary/20 border-2 border-primary"
                  : "bg-muted border-2 border-transparent hover:bg-muted/80"
              }`}
            >
              <option.icon className={`h-6 w-6 ${diaperType === option.value ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`text-xs text-center leading-tight ${diaperType === option.value ? "text-primary" : "text-muted-foreground"}`}>
                {option.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {showColorPicker && (
        <div className="px-6 py-3 border-t border-border">
          <p className="text-sm text-muted-foreground mb-2">{t("diaper.color")}</p>
          <div className="flex gap-2 justify-center">
            {colorOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setColor(color === option.value ? null : option.value)}
                className={`w-12 h-12 rounded-full ${option.color} transition-all ${
                  color === option.value
                    ? "ring-2 ring-primary ring-offset-2"
                    : "opacity-60 hover:opacity-100"
                }`}
                title={tEnums(`diaperColor.${option.value}`)}
                aria-label={tEnums(`diaperColor.${option.value}`)}
                aria-pressed={color === option.value}
              />
            ))}
          </div>
        </div>
      )}

      <div className="px-6 py-3 border-t border-border">
        <p className="text-sm text-muted-foreground mb-2">{t("amount")}</p>
        <div className="flex gap-3 justify-center">
          {amountOptions.map((option) => (
            <button
              key={option}
              onClick={() => setAmount(amount === option ? null : option)}
              className={`min-w-12 h-12 px-4 rounded-full text-sm font-medium transition-colors ${
                amount === option
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {tEnums(`diaperAmount.${option}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 pt-4">
        <Button
          size="lg"
          className="w-full h-14 text-lg"
          onClick={handleSave}
          disabled={logDiaper.isPending}
        >
          {t("save")}
        </Button>
      </div>
    </>
  );
}

// Popular foods list for solids modal
const POPULAR_FOODS = [
  "avocado", "banana", "apple", "riceCereal",
  "sweetPotato", "oatmeal", "spinach", "chicken",
  "peas", "pear", "yogurt", "carrot",
  "broccoli", "prune", "greenBean", "mango",
] as const;

function SolidsModal({ childId, onClose }: { childId: string; onClose: () => void }) {
  const t = useTranslations("logModal");
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [selectedFoods, setSelectedFoods] = useState<string[]>([]);
  const [customFood, setCustomFood] = useState("");
  const [startTime, setStartTime] = useState<Date | null>(new Date());
  const [notes, setNotes] = useState("");

  const logSolids = trpc.feeding.logSolids.useMutation({
    onSuccess: () => {
      utils.feeding.list.invalidate();
      utils.feeding.summary.invalidate({ childId });
      utils.timeline.getLastActivities.invalidate({ childId });
      toast({ title: t("solids.logged") });
      onClose();
    },
  });

  const handleFoodToggle = (food: string) => {
    setSelectedFoods((prev) =>
      prev.includes(food)
        ? prev.filter((f) => f !== food)
        : [...prev, food]
    );
  };

  const handleAddCustomFood = () => {
    const trimmed = customFood.trim();
    if (trimmed && !selectedFoods.includes(trimmed)) {
      setSelectedFoods((prev) => [...prev, trimmed]);
      setCustomFood("");
    }
  };

  const handleSave = () => {
    if (selectedFoods.length === 0 || !startTime) return;
    logSolids.mutate({
      childId,
      startTime,
      foodItems: selectedFoods,
      notes: notes || undefined,
    });
  };

  return (
    <>
      <DialogHeader className="p-6 pb-0">
        <DialogTitle className="text-center">{t("solids.add")}</DialogTitle>
      </DialogHeader>

      <TimeRow label={t("startTime")} value={startTime} onChange={setStartTime} />

      <div className="px-6 py-4 border-b border-border">
        <p className="text-sm text-muted-foreground mb-3">{t("solids.addFood")} <span className="text-xs">{t("solids.optionalCustom")}</span></p>
        <div className="flex gap-2">
          <Input
            placeholder={t("solids.foodPlaceholder")}
            value={customFood}
            onChange={(e) => setCustomFood(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddCustomFood()}
            className="flex-1"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleAddCustomFood}
            disabled={!customFood.trim()}
            aria-label={t("solids.addFoodAria")}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Selected foods */}
      {selectedFoods.length > 0 && (
        <div className="px-6 py-3 border-b border-border">
          <p className="text-sm text-muted-foreground mb-2">{t("solids.selectedFoods")}</p>
          <div className="flex flex-wrap gap-2">
            {selectedFoods.map((food) => (
              <button
                key={food}
                onClick={() => handleFoodToggle(food)}
                className="flex items-center gap-1 px-4 min-h-12 bg-primary/20 text-primary rounded-full text-sm"
              >
                {food}
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Popular foods grid */}
      <div className="px-6 py-4 max-h-64 overflow-y-auto">
        <p className="text-sm text-muted-foreground mb-3">{t("solids.popular")}</p>
        <div className="grid grid-cols-4 gap-3">
          {POPULAR_FOODS.map((key) => {
            const food = t(`solids.foods.${key}`);
            const isSelected = selectedFoods.includes(food);
            return (
              <button
                key={food}
                onClick={() => handleFoodToggle(food)}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                  isSelected
                    ? "bg-primary/20 ring-2 ring-primary"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                  isSelected ? "bg-primary/30" : "bg-background"
                }`}>
                  {isSelected && <Check className="h-5 w-5 text-primary" />}
                </div>
                <span className="text-xs text-center leading-tight">{food}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Notes */}
      <div className="px-6 py-3 border-t border-border">
        <Textarea
          placeholder={t("notesPlaceholder")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[60px]"
        />
      </div>

      <div className="p-6 pt-0 flex items-center gap-4">
        <span className="text-sm text-muted-foreground">
          {t("solids.selectedCount")} <span className="text-primary font-medium">{selectedFoods.length}</span>
        </span>
        <Button
          size="lg"
          className="flex-1 h-14 text-lg"
          onClick={handleSave}
          disabled={logSolids.isPending || selectedFoods.length === 0}
        >
          {t("save")}
        </Button>
      </div>
    </>
  );
}

function PumpingModal({ childId, onClose }: { childId: string; onClose: () => void }) {
  const t = useTranslations("logModal");
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const pumpingTimer = useTimer(childId, "pumping");
  const stopTimer = useTimerStore((state) => state.stopTimer);
  const startTimerStore = useTimerStore((state) => state.startTimer);
  const updateTimerStore = useTimerStore((state) => state.updateTimer);

  const [startTime, setStartTime] = useState<Date | null>(new Date());
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [amountMode, setAmountMode] = useState<"total" | "left/right">("total");
  const [leftAmountMl, setLeftAmountMl] = useState(10);
  const [rightAmountMl, setRightAmountMl] = useState(10);
  const [notes, setNotes] = useState("");

  // Query for active pumping in database (started via MCP/chat)
  const { data: activePumping } = trpc.pumping.getActive.useQuery({ childId });

  // Sync local timer with database if there's an active session but no local timer
  useEffect(() => {
    if (activePumping && !pumpingTimer.isRunning) {
      // Create local timer from database record
      const timerId = startTimerStore({
        type: "pumping",
        childId,
        startTime: new Date(activePumping.startTime).getTime(),
      });
      updateTimerStore(timerId, { recordId: activePumping.id });
    }
  }, [activePumping, pumpingTimer.isRunning, childId, startTimerStore, updateTimerStore]);

  const startPumping = trpc.pumping.start.useMutation({
    onSuccess: (result) => {
      utils.pumping.list.invalidate();
      utils.timeline.getLastActivities.invalidate({ childId });
      pumpingTimer.start({});
      pumpingTimer.update({ recordId: result.id });
      toast({ title: t("pumping.timerStarted") });
    },
  });

  const endPumping = trpc.pumping.end.useMutation({
    onSuccess: () => {
      utils.pumping.list.invalidate();
      utils.pumping.summary.invalidate({ childId });
      utils.timeline.getLastActivities.invalidate({ childId });
      toast({ title: t("pumping.recorded") });
      onClose();
    },
  });

  const logPumping = trpc.pumping.log.useMutation({
    onSuccess: () => {
      utils.pumping.list.invalidate();
      utils.pumping.summary.invalidate({ childId });
      utils.timeline.getLastActivities.invalidate({ childId });
      toast({ title: t("pumping.recorded") });
      onClose();
    },
  });

  const handleStart = () => {
    startPumping.mutate({ childId, startTime: startTime ?? undefined });
  };

  const handleStop = async () => {
    if (pumpingTimer.timer?.recordId) {
      stopTimer(pumpingTimer.timer.id);
      await endPumping.mutateAsync({
        id: pumpingTimer.timer.recordId,
        amountMl: Math.round(leftAmountMl + rightAmountMl),
        notes: notes || undefined,
      });
    }
  };

  const handleManualSave = () => {
    if (!startTime) return;
    logPumping.mutate({
      childId,
      startTime,
      amountMl: Math.round(leftAmountMl + rightAmountMl),
      notes: notes || undefined,
    });
  };

  const isLoading = startPumping.isPending || logPumping.isPending || endPumping.isPending;

  // Timer is running - show amount entry
  if (pumpingTimer.isRunning && !showManualEntry) {
    return (
      <>
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-center">{t("pumping.running")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center py-6">
          <TimerDisplay elapsedMs={pumpingTimer.elapsedMs} size="large" />
        </div>

        <PumpingAmountEntry
          amountMode={amountMode}
          setAmountMode={setAmountMode}
          leftAmountMl={leftAmountMl}
          setLeftAmountMl={setLeftAmountMl}
          rightAmountMl={rightAmountMl}
          setRightAmountMl={setRightAmountMl}
        />

        <div className="px-6 py-3 border-t border-border">
          <Textarea
            placeholder={t("notesPlaceholder")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[60px]"
          />
        </div>

        <div className="p-6 pt-0">
          <Button
            size="lg"
            variant="destructive"
            className="w-full h-14 text-lg"
            onClick={handleStop}
            disabled={isLoading}
          >
            <Square className="h-5 w-5 mr-2" />
            {t("stop")}
          </Button>
        </div>
      </>
    );
  }

  // Manual entry mode
  if (showManualEntry) {
    return (
      <>
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-center">{t("pumping.add")}</DialogTitle>
        </DialogHeader>

        <TimeRow label={t("startTime")} value={startTime} onChange={setStartTime} />

        <PumpingAmountEntry
          amountMode={amountMode}
          setAmountMode={setAmountMode}
          leftAmountMl={leftAmountMl}
          setLeftAmountMl={setLeftAmountMl}
          rightAmountMl={rightAmountMl}
          setRightAmountMl={setRightAmountMl}
        />

        <div className="px-6 py-3 border-t border-border">
          <Textarea
            placeholder={t("notesPlaceholder")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[60px]"
          />
        </div>

        <div className="p-6 pt-0 flex flex-col gap-3">
          <Button
            size="lg"
            className="w-full h-14 text-lg"
            onClick={handleManualSave}
            disabled={isLoading || !startTime}
          >
            {t("save")}
          </Button>
          <button
            onClick={() => setShowManualEntry(false)}
            className="text-sm min-h-12 px-4 text-primary hover:underline"
          >
            {t("startTimerInstead")}
          </button>
        </div>
      </>
    );
  }

  // Default: Start timer UI
  return (
    <>
      <DialogHeader className="p-6 pb-0">
        <DialogTitle className="text-center">{t("pumping.add")}</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col items-center py-8 gap-6">
        <TimerDisplay elapsedMs={0} />

        <button
          onClick={handleStart}
          disabled={isLoading}
          className="w-32 h-32 rounded-full bg-primary text-primary-foreground shadow-[0_8px_24px_-8px_rgba(42,91,110,0.55)] flex flex-col items-center justify-center gap-1.5 transition-transform active:scale-95 disabled:opacity-50"
        >
          <Play className="h-8 w-8 fill-current" />
          <span className="font-semibold">{t("start")}</span>
        </button>
      </div>

      <div className="p-6 pt-0 flex justify-center">
        <button
          onClick={() => setShowManualEntry(true)}
          className="text-sm min-h-12 px-4 text-muted-foreground hover:text-foreground"
        >
          {t("manualEntry")}
        </button>
      </div>
    </>
  );
}

// Sub-component for pumping amount entry (used in timer running and manual modes)
function PumpingAmountEntry({
  amountMode,
  setAmountMode,
  leftAmountMl,
  setLeftAmountMl,
  rightAmountMl,
  setRightAmountMl,
}: {
  amountMode: "total" | "left/right";
  setAmountMode: (mode: "total" | "left/right") => void;
  leftAmountMl: number;
  setLeftAmountMl: (val: number) => void;
  rightAmountMl: number;
  setRightAmountMl: (val: number) => void;
}) {
  const t = useTranslations("logModal");
  const f = useFormatters();
  const totalMl = leftAmountMl + rightAmountMl;
  const maxSlider = 240;

  return (
    <div className="px-6 py-4 border-t border-border space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex rounded overflow-hidden border border-border">
          <button
            onClick={() => setAmountMode("total")}
            className={`px-4 min-h-12 text-sm sm:min-h-10 ${amountMode === "total" ? "bg-primary text-primary-foreground" : ""}`}
          >
            {t("pumping.modeTotal")}
          </button>
          <button
            onClick={() => setAmountMode("left/right")}
            className={`px-4 min-h-12 text-sm sm:min-h-10 ${amountMode === "left/right" ? "bg-primary text-primary-foreground" : ""}`}
          >
            {t("pumping.modeLeftRight")}
          </button>
        </div>
      </div>

      {amountMode === "total" ? (
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-muted-foreground">{t("pumping.total")}</span>
            <span className="font-semibold">{f.ml(totalMl)}</span>
          </div>
          <Slider
            value={[totalMl]}
            onValueChange={([val]) => {
              setLeftAmountMl(val / 2);
              setRightAmountMl(val / 2);
            }}
            max={maxSlider}
            step={5}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0</span>
            <span>{maxSlider}</span>
          </div>
        </div>
      ) : (
        <>
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-muted-foreground">{t("pumping.left")}</span>
              <span className="font-semibold">{f.ml(leftAmountMl)}</span>
            </div>
            <Slider
              value={[leftAmountMl]}
              onValueChange={([val]) => setLeftAmountMl(val)}
              max={maxSlider}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>0</span>
              <span>{maxSlider}</span>
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-muted-foreground">{t("pumping.right")}</span>
              <span className="font-semibold">{f.ml(rightAmountMl)}</span>
            </div>
            <Slider
              value={[rightAmountMl]}
              onValueChange={([val]) => setRightAmountMl(val)}
              max={maxSlider}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>0</span>
              <span>{maxSlider}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

type MedicineUnit = "ml" | "drops" | "tsp";
const MEDICINE_UNITS: MedicineUnit[] = ["ml", "drops", "tsp"];

function MedicineModal({ childId, onClose }: { childId: string; onClose: () => void }) {
  const t = useTranslations("logModal");
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [startTime, setStartTime] = useState<Date | null>(new Date());
  const [selectedMedicineId, setSelectedMedicineId] = useState<string | null>(null);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newMedicineName, setNewMedicineName] = useState("");
  const [newMedicineDosage, setNewMedicineDosage] = useState("");
  const [unit, setUnit] = useState<MedicineUnit>("ml");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch existing medicines for this child
  const { data: medicines } = trpc.medicine.list.useQuery({
    childId,
    activeOnly: true,
  });

  const createMedicine = trpc.medicine.create.useMutation({
    onSuccess: (result) => {
      utils.medicine.list.invalidate({ childId });
      setSelectedMedicineId(result.id);
      setShowCreateNew(false);
      toast({ title: t("medicine.created") });
    },
  });

  const logMedicineRecord = trpc.medicine.logRecord.useMutation({
    onSuccess: () => {
      utils.medicine.list.invalidate({ childId });
      utils.timeline.getLastActivities.invalidate({ childId });
      toast({ title: t("medicine.logged") });
      onClose();
    },
  });

  const handleCreateMedicine = () => {
    if (!newMedicineName.trim() || !newMedicineDosage.trim()) return;
    createMedicine.mutate({
      childId,
      name: newMedicineName.trim(),
      dosage: newMedicineDosage.trim(),
    });
  };

  const handleSave = () => {
    if (!selectedMedicineId || !startTime) return;

    const dosageGiven = amount ? `${amount} ${t(`medicine.units.${unit}`)}` : undefined;

    logMedicineRecord.mutate({
      medicineId: selectedMedicineId,
      time: startTime,
      dosageGiven,
      notes: notes || undefined,
    });
  };

  const selectedMedicine = medicines?.find((m: { id: string }) => m.id === selectedMedicineId);
  const isLoading = createMedicine.isPending || logMedicineRecord.isPending;

  return (
    <>
      <DialogHeader className="p-6 pb-0">
        <DialogTitle className="text-center">{t("medicine.title")}</DialogTitle>
      </DialogHeader>

      <TimeRow label={t("startTime")} value={startTime} onChange={setStartTime} />

      {/* Medicine type selection */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-muted-foreground">{t("medicine.type")}</span>
          {showCreateNew ? (
            <button
              onClick={() => setShowCreateNew(false)}
              className="text-sm text-primary hover:underline min-h-12 px-2"
            >
              {t("medicine.selectExisting")}
            </button>
          ) : (
            <button
              onClick={() => setShowCreateNew(true)}
              className="text-sm text-primary hover:underline min-h-12 px-2"
            >
              {t("medicine.addNew")}
            </button>
          )}
        </div>

        {showCreateNew ? (
          <div className="space-y-3">
            <Input
              placeholder={t("medicine.namePlaceholder")}
              value={newMedicineName}
              onChange={(e) => setNewMedicineName(e.target.value)}
            />
            <Input
              placeholder={t("medicine.dosagePlaceholder")}
              value={newMedicineDosage}
              onChange={(e) => setNewMedicineDosage(e.target.value)}
            />
            <Button
              onClick={handleCreateMedicine}
              disabled={!newMedicineName.trim() || !newMedicineDosage.trim() || createMedicine.isPending}
              className="w-full min-h-12"
            >
              {t("medicine.create")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {medicines?.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("medicine.none")}</p>
            ) : (
              medicines?.map((medicine: { id: string; name: string }) => (
                <button
                  key={medicine.id}
                  onClick={() => setSelectedMedicineId(medicine.id)}
                  className={`px-4 min-h-12 rounded-lg text-sm transition-colors ${
                    selectedMedicineId === medicine.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  {medicine.name}
                </button>
              ))
            )}
          </div>
        )}

        {selectedMedicine && (
          <p className="text-xs text-muted-foreground mt-2">
            {t("medicine.defaultDosage", { dosage: selectedMedicine.dosage })}
          </p>
        )}
      </div>

      {/* Amount with unit selection */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <span className="text-muted-foreground">{t("amount")}</span>
          <div className="flex rounded overflow-hidden border border-border">
            {MEDICINE_UNITS.map((u) => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className={`px-3 min-h-12 min-w-12 text-sm sm:min-h-10 ${unit === u ? "bg-primary text-primary-foreground" : ""}`}
              >
                {t(`medicine.units.${u}`)}
              </button>
            ))}
          </div>
        </div>
        <Input
          placeholder={t("medicine.amountPlaceholder")}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
          step="0.1"
          min="0"
        />
      </div>

      {/* Notes */}
      <div className="px-6 py-3">
        <Textarea
          placeholder={t("notesPlaceholder")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[60px]"
        />
      </div>

      <div className="p-6 pt-0">
        <Button
          size="lg"
          className="w-full h-14 text-lg"
          onClick={handleSave}
          disabled={isLoading || !selectedMedicineId}
        >
          {t("save")}
        </Button>
      </div>
    </>
  );
}

function GrowthModal({ childId, onClose }: { childId: string; onClose: () => void }) {
  const t = useTranslations("logModal");
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [date, setDate] = useState<Date | null>(new Date());
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [headCm, setHeadCm] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  // Fetch latest growth record to pre-fill
  const { data: latestGrowth } = trpc.growth.getLatest.useQuery({ childId });

  // Pre-fill with latest values when data loads
  useEffect(() => {
    if (latestGrowth) {
      if (latestGrowth.weightKg) {
        setWeightKg(latestGrowth.weightKg);
      }
      if (latestGrowth.heightCm) {
        setHeightCm(latestGrowth.heightCm);
      }
      if (latestGrowth.headCircumferenceCm) {
        setHeadCm(latestGrowth.headCircumferenceCm);
      }
    }
  }, [latestGrowth]);

  const logGrowth = trpc.growth.log.useMutation({
    onSuccess: () => {
      utils.growth.list.invalidate();
      utils.growth.getLatest.invalidate({ childId });
      utils.timeline.getLastActivities.invalidate({ childId });
      toast({ title: t("growth.recorded") });
      onClose();
    },
  });

  const handleSave = () => {
    if (!date) return;

    logGrowth.mutate({
      childId,
      date,
      weightKg: weightKg ?? undefined,
      heightCm: heightCm ?? undefined,
      headCircumferenceCm: headCm ?? undefined,
      notes: notes || undefined,
    });
  };

  const isLoading = logGrowth.isPending;

  return (
    <>
      <DialogHeader className="p-6 pb-0">
        <DialogTitle className="text-center">{t("growth.add")}</DialogTitle>
      </DialogHeader>

      <TimeRow label={t("date")} value={date} onChange={setDate} />

      <div className="px-6 py-4 border-b border-border">
        <p className="text-sm text-muted-foreground mb-2">{t("growth.weight")}</p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={weightKg ?? ""}
            onChange={(e) => setWeightKg(e.target.value ? Number(e.target.value) : null)}
            step="0.01"
            min="0"
            max="50"
          />
          <span className="text-muted-foreground">kg</span>
        </div>
      </div>

      <div className="px-6 py-4 border-b border-border">
        <p className="text-sm text-muted-foreground mb-2">{t("growth.height")}</p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0.0"
            value={heightCm ?? ""}
            onChange={(e) => setHeightCm(e.target.value ? Number(e.target.value) : null)}
            step="0.1"
            min="0"
            max="200"
          />
          <span className="text-muted-foreground">cm</span>
        </div>
      </div>

      <div className="px-6 py-4 border-b border-border">
        <p className="text-sm text-muted-foreground mb-2">{t("growth.headCircumference")}</p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="0.0"
            value={headCm ?? ""}
            onChange={(e) => setHeadCm(e.target.value ? Number(e.target.value) : null)}
            step="0.1"
            min="0"
            max="100"
          />
          <span className="text-muted-foreground">cm</span>
        </div>
      </div>

      {/* Notes */}
      <div className="px-6 py-3">
        <Textarea
          placeholder={t("notesPlaceholder")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[60px]"
        />
      </div>

      <div className="p-6 pt-0">
        <Button
          size="lg"
          className="w-full h-14 text-lg"
          onClick={handleSave}
          disabled={isLoading}
        >
          {t("save")}
        </Button>
      </div>
    </>
  );
}

const MIN_TEMP = 30;
const MAX_TEMP = 45;

function TemperatureModal({ childId, onClose }: { childId: string; onClose: () => void }) {
  const t = useTranslations("logModal");
  const f = useFormatters();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [time, setTime] = useState<Date | null>(new Date());
  const [temperatureCelsius, setTemperatureCelsius] = useState(37.0); // Normal body temp
  const [notes, setNotes] = useState("");

  const logTemperature = trpc.temperature.log.useMutation({
    onSuccess: () => {
      utils.temperature.list.invalidate();
      utils.temperature.getLatest.invalidate({ childId });
      utils.timeline.getLastActivities.invalidate({ childId });
      toast({ title: t("temperature.recorded") });
      onClose();
    },
  });

  const handleSave = () => {
    if (!time) return;

    logTemperature.mutate({
      childId,
      time,
      temperatureCelsius,
      notes: notes || undefined,
    });
  };

  // Temperature status and color
  const getTemperatureStatus = () => {
    if (temperatureCelsius < 36.1) return { label: t("temperature.low"), color: "text-blue-500" };
    if (temperatureCelsius <= 37.2) return { label: t("temperature.normal"), color: "text-green-500" };
    if (temperatureCelsius <= 38.0) return { label: t("temperature.elevated"), color: "text-yellow-500" };
    if (temperatureCelsius <= 39.0) return { label: t("temperature.fever"), color: "text-orange-500" };
    return { label: t("temperature.highFever"), color: "text-red-500" };
  };

  const status = getTemperatureStatus();
  const isLoading = logTemperature.isPending;

  return (
    <>
      <DialogHeader className="p-6 pb-0">
        <DialogTitle className="text-center">{t("temperature.add")}</DialogTitle>
      </DialogHeader>

      <TimeRow label={t("time")} value={time} onChange={setTime} />

      <div className="flex flex-col items-center py-6 gap-2">
        <span className="text-5xl font-bold">{f.temperatureC(temperatureCelsius)}</span>
        <span className={`text-sm font-medium ${status.color}`}>{status.label}</span>
      </div>

      <div className="px-6 py-4 border-b border-border">
        <Slider
          value={[temperatureCelsius]}
          onValueChange={([val]) => setTemperatureCelsius(val)}
          min={MIN_TEMP}
          max={MAX_TEMP}
          step={0.1}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{MIN_TEMP}°</span>
          <span>{MAX_TEMP}°</span>
        </div>
      </div>

      {/* Notes */}
      <div className="px-6 py-3">
        <Textarea
          placeholder={t("notesPlaceholder")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[60px]"
        />
      </div>

      <div className="p-6 pt-0">
        <Button
          size="lg"
          className="w-full h-14 text-lg"
          onClick={handleSave}
          disabled={isLoading}
        >
          {t("save")}
        </Button>
      </div>
    </>
  );
}

type ActivityType =
  | "TUMMY_TIME"
  | "BATH"
  | "OUTDOOR_PLAY"
  | "INDOOR_PLAY"
  | "SCREEN_TIME"
  | "SKIN_TO_SKIN"
  | "STORYTIME"
  | "TEETH_BRUSHING"
  | "OTHER";

const ACTIVITY_OPTIONS: { type: ActivityType; icon: typeof Bath }[] = [
  { type: "TUMMY_TIME", icon: BabyIcon },
  { type: "BATH", icon: Bath },
  { type: "OUTDOOR_PLAY", icon: Sun },
  { type: "INDOOR_PLAY", icon: Home },
  { type: "SCREEN_TIME", icon: Tv },
  { type: "SKIN_TO_SKIN", icon: Heart },
  { type: "STORYTIME", icon: BookOpen },
  { type: "TEETH_BRUSHING", icon: Smile },
];

function ActivityModal({ childId, onClose }: { childId: string; onClose: () => void }) {
  const t = useTranslations("logModal");
  const tEnums = useTranslations("enums");
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const activityTimer = useTimer(childId, "activity");
  const stopTimer = useTimerStore((state) => state.stopTimer);

  const [selectedType, setSelectedType] = useState<ActivityType | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(new Date());
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [notes, setNotes] = useState("");

  const startActivity = trpc.activity.start.useMutation({
    onSuccess: (result) => {
      utils.activity.list.invalidate();
      utils.timeline.getLastActivities.invalidate({ childId });
      activityTimer.start({ activityType: selectedType ?? undefined });
      activityTimer.update({ recordId: result.id });
      toast({ title: t("activity.timerStarted") });
    },
  });

  const endActivity = trpc.activity.end.useMutation({
    onSuccess: () => {
      utils.activity.list.invalidate();
      utils.timeline.getLastActivities.invalidate({ childId });
      toast({ title: t("activity.recorded") });
      onClose();
    },
  });

  const logActivity = trpc.activity.log.useMutation({
    onSuccess: () => {
      utils.activity.list.invalidate();
      utils.timeline.getLastActivities.invalidate({ childId });
      toast({ title: t("activity.recorded") });
      onClose();
    },
  });

  const handleTypeSelect = (type: ActivityType) => {
    if (activityTimer.isRunning) return;
    setSelectedType(type);
  };

  const handleStart = () => {
    if (!selectedType) return;
    startActivity.mutate({ childId, activityType: selectedType, startTime: startTime ?? undefined });
  };

  const handleStop = async () => {
    if (activityTimer.timer?.recordId) {
      stopTimer(activityTimer.timer.id);
      await endActivity.mutateAsync({
        id: activityTimer.timer.recordId,
        notes: notes || undefined,
      });
    }
  };

  const handleManualSave = () => {
    if (!selectedType || !startTime) return;
    logActivity.mutate({
      childId,
      activityType: selectedType,
      startTime,
      endTime: endTime ?? undefined,
      notes: notes || undefined,
    });
  };

  const isLoading = startActivity.isPending || endActivity.isPending || logActivity.isPending;
  const runningType = activityTimer.timer?.metadata?.activityType as ActivityType | undefined;

  // Timer is running
  if (activityTimer.isRunning && !showManualEntry) {
    const runningOption = ACTIVITY_OPTIONS.find(o => o.type === runningType);

    return (
      <>
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-center">{t("activity.running")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center py-6 gap-4">
          {runningOption && (
            <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full">
              <runningOption.icon className="h-5 w-5 text-primary" />
              <span className="text-primary font-medium">{tEnums(`activityType.${runningOption.type}`)}</span>
            </div>
          )}
          <TimerDisplay elapsedMs={activityTimer.elapsedMs} size="large" />
        </div>

        <div className="px-6 py-3 border-t border-border">
          <Textarea
            placeholder={t("notesPlaceholder")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[60px]"
          />
        </div>

        <div className="p-6 pt-0">
          <Button
            size="lg"
            variant="destructive"
            className="w-full h-14 text-lg"
            onClick={handleStop}
            disabled={isLoading}
          >
            <Square className="h-5 w-5 mr-2" />
            {t("stop")}
          </Button>
        </div>
      </>
    );
  }

  // Manual entry mode
  if (showManualEntry) {
    return (
      <>
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-center">{t("activity.log")}</DialogTitle>
        </DialogHeader>

        {/* Activity type grid */}
        <div className="px-6 py-4">
          <p className="text-sm text-muted-foreground mb-3">{t("activity.type")}</p>
          <div className="grid grid-cols-4 gap-3">
            {ACTIVITY_OPTIONS.map((option) => {
              const isSelected = selectedType === option.type;
              return (
                <button
                  key={option.type}
                  onClick={() => setSelectedType(option.type)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                    isSelected
                      ? "bg-primary/20 ring-2 ring-primary"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  <option.icon className={`h-6 w-6 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-xs text-center leading-tight">{tEnums(`activityType.${option.type}`)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <TimeRow label={t("startTime")} value={startTime} onChange={setStartTime} />
        <TimeRow label={t("endTime")} value={endTime} onChange={setEndTime} placeholder={t("setTime")} />

        <div className="px-6 py-3 border-t border-border">
          <Textarea
            placeholder={t("notesPlaceholder")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[60px]"
          />
        </div>

        <div className="p-6 pt-0 flex flex-col gap-3">
          <Button
            size="lg"
            className="w-full h-14 text-lg"
            onClick={handleManualSave}
            disabled={isLoading || !selectedType || !startTime}
          >
            {t("save")}
          </Button>
          <button
            onClick={() => setShowManualEntry(false)}
            className="text-sm min-h-12 px-4 text-muted-foreground hover:text-foreground"
          >
            {t("startTimerInstead")}
          </button>
        </div>
      </>
    );
  }

  // Default: Activity selection with start timer UI
  return (
    <>
      <DialogHeader className="p-6 pb-0">
        <DialogTitle className="text-center">{t("activity.add")}</DialogTitle>
      </DialogHeader>

      {/* Activity type grid */}
      <div className="px-6 py-4">
        <p className="text-sm text-muted-foreground mb-3">{t("activity.select")}</p>
        <div className="grid grid-cols-4 gap-3">
          {ACTIVITY_OPTIONS.map((option) => {
            const isSelected = selectedType === option.type;
            return (
              <button
                key={option.type}
                onClick={() => handleTypeSelect(option.type)}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                  isSelected
                    ? "bg-primary/20 ring-2 ring-primary"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                <option.icon className={`h-6 w-6 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-xs text-center leading-tight">{tEnums(`activityType.${option.type}`)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col items-center py-4 gap-4">
        <TimerDisplay elapsedMs={0} />

        <button
          onClick={handleStart}
          disabled={isLoading || !selectedType}
          className="w-28 h-28 rounded-full bg-primary text-primary-foreground shadow-[0_8px_24px_-8px_rgba(42,91,110,0.55)] flex flex-col items-center justify-center gap-1.5 transition-transform active:scale-95 disabled:opacity-50"
        >
          <Play className="h-6 w-6 fill-current" />
          <span className="font-semibold text-sm">{t("start")}</span>
        </button>
      </div>

      <div className="p-6 pt-0 flex justify-center">
        <button
          onClick={() => setShowManualEntry(true)}
          className="text-sm min-h-12 px-4 text-muted-foreground hover:text-foreground"
        >
          {t("manualEntry")}
        </button>
      </div>
    </>
  );
}
