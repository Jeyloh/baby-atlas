"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { TimeRow } from "@/components/ui/time-row";
import { SimpleToggleGroup } from "@/components/ui/simple-toggle-group";
import { useToast } from "@/hooks/use-toast";
import {
  getActivityIconClasses,
  feedingTypeToCategory,
  type ActivityCategory,
} from "@/lib/activity-colors";
import { lbsToKg, inchesToCm } from "@baby-atlas/utils";
import { useTranslations } from "next-intl";
import { useFormatters } from "@/lib/format";
import { Moon, Baby, Milk, Utensils, Droplets, ChevronRight, Trash2, Cloud, CloudRain, Heart, Pill, Ruler, Thermometer, Star } from "lucide-react";

interface SleepRecord {
  id: string;
  startTime: Date;
  endTime: Date | null;
  sleepType: string;
  quality?: number | null;
  notes?: string | null;
}

interface FeedingRecord {
  id: string;
  startTime: Date;
  endTime: Date | null;
  feedingType: string;
  side?: string | null;
  leftDurationSeconds?: number | null;
  rightDurationSeconds?: number | null;
  amountMl?: number | null;
  bottleContentType?: string | null;
  foodItems?: string[] | null;
  notes?: string | null;
}

interface DiaperRecord {
  id: string;
  time: Date;
  diaperType: string;
  color?: string | null;
  amount?: string | null;
  notes?: string | null;
}

interface PumpingRecord {
  id: string;
  startTime: Date;
  endTime: Date | null;
  amountMl?: number | null;
  notes?: string | null;
}

interface MedicineRecord {
  id: string;
  time: Date;
  amount?: number | null;
  unit?: string | null;
  notes?: string | null;
  medicine: {
    id: string;
    name: string;
    defaultDosage?: string | null;
  };
}

interface GrowthRecord {
  id: string;
  date: Date;
  weightOz?: number | null;
  heightIn?: number | null;
  headCircumferenceCm?: number | null;
  notes?: string | null;
}

interface TemperatureRecord {
  id: string;
  time: Date;
  temperatureCelsius: number;
  notes?: string | null;
}

interface ActivityRecordType {
  id: string;
  activityType: string;
  startTime: Date;
  endTime: Date | null;
  notes?: string | null;
}

type Activity =
  | { type: "SLEEP"; record: SleepRecord; time: Date }
  | { type: "FEEDING"; record: FeedingRecord; time: Date }
  | { type: "DIAPER"; record: DiaperRecord; time: Date }
  | { type: "PUMPING"; record: PumpingRecord; time: Date }
  | { type: "MEDICINE"; record: MedicineRecord; time: Date }
  | { type: "GROWTH"; record: GrowthRecord; time: Date }
  | { type: "TEMPERATURE"; record: TemperatureRecord; time: Date }
  | { type: "ACTIVITY"; record: ActivityRecordType; time: Date };

interface ActivityRowProps {
  activity: Activity;
  childId: string;
  childName?: string;
  autoOpenEdit?: boolean;
  onEditClose?: () => void;
}

const iconMap = {
  sleep: Moon,
  nursing: Baby,
  bottle: Milk,
  solids: Utensils,
  diaper: Droplets,
  pumping: Heart,
  medicine: Pill,
  growth: Ruler,
  temperature: Thermometer,
  activity: Star,
};

type DiaperAmount = "SMALL" | "MEDIUM" | "LARGE";
type DiaperColor = "YELLOW" | "GREEN" | "BROWN" | "BLACK" | "OTHER";
type ActivityTypeValue =
  | "TUMMY_TIME" | "BATH" | "OUTDOOR_PLAY" | "INDOOR_PLAY" | "SCREEN_TIME"
  | "SKIN_TO_SKIN" | "STORYTIME" | "TEETH_BRUSHING" | "OTHER";

const amountOptions: DiaperAmount[] = ["SMALL", "MEDIUM", "LARGE"];

const colorOptions: { value: DiaperColor; color: string }[] = [
  { value: "YELLOW", color: "bg-yellow-400" },
  { value: "GREEN", color: "bg-green-500" },
  { value: "BROWN", color: "bg-amber-700" },
  { value: "BLACK", color: "bg-gray-900" },
  { value: "OTHER", color: "bg-gray-400" },
];

const DEFAULT_BOTTLE_ML = 90;
const MAX_BOTTLE_ML = 350;

const FEVER_THRESHOLD_CELSIUS = 38;

export function ActivityRow({ activity, childId, childName: childNameProp, autoOpenEdit = false, onEditClose }: ActivityRowProps) {
  const t = useTranslations("reports");
  const te = useTranslations("enums");
  const f = useFormatters();
  const childName = childNameProp ?? t("defaultChildName");
  const [editOpen, setEditOpen] = useState(autoOpenEdit);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const deletedToast = (kind: "sleep" | "feeding" | "diaper" | "pumping" | "medicine" | "growth" | "temperature" | "activity") =>
    toast({ title: t(`toast.deleted.${kind}`) });
  const updatedToast = (kind: "sleep" | "feeding" | "diaper") =>
    toast({ title: t(`toast.updated.${kind}`) });

  // Edit state for sleep
  const [editSleepType, setEditSleepType] = useState<"NAP" | "NIGHT">("NAP");
  const [editSleepStart, setEditSleepStart] = useState<Date | null>(null);
  const [editSleepEnd, setEditSleepEnd] = useState<Date | null>(null);

  // Edit state for breast feeding
  const [editBreastSide, setEditBreastSide] = useState<"LEFT" | "RIGHT" | "BOTH">("LEFT");
  const [editBreastStart, setEditBreastStart] = useState<Date | null>(null);
  const [editBreastEnd, setEditBreastEnd] = useState<Date | null>(null);
  const [editLeftDurationSeconds, setEditLeftDurationSeconds] = useState<number>(0);
  const [editRightDurationSeconds, setEditRightDurationSeconds] = useState<number>(0);

  // Edit state for bottle
  const [editBottleContentType, setEditBottleContentType] = useState<"FORMULA" | "BREAST_MILK">("FORMULA");
  const [editBottleAmountMl, setEditBottleAmountMl] = useState(DEFAULT_BOTTLE_ML);
  const [editBottleTime, setEditBottleTime] = useState<Date | null>(null);

  // Edit state for diaper
  const [editDiaperType, setEditDiaperType] = useState<"WET" | "DIRTY" | "BOTH" | "DRY">("WET");
  const [editDiaperColor, setEditDiaperColor] = useState<DiaperColor | null>(null);
  const [editDiaperAmount, setEditDiaperAmount] = useState<DiaperAmount | null>(null);
  const [editDiaperTime, setEditDiaperTime] = useState<Date | null>(null);

  // Helper to close edit dialog and notify parent
  const closeEditDialog = () => {
    setEditOpen(false);
    onEditClose?.();
  };

  // Initialize edit state when dialog opens
  useEffect(() => {
    if (editOpen) {
      if (activity.type === "SLEEP") {
        const r = activity.record;
        setEditSleepType(r.sleepType as "NAP" | "NIGHT");
        setEditSleepStart(new Date(r.startTime));
        setEditSleepEnd(r.endTime ? new Date(r.endTime) : null);
      } else if (activity.type === "FEEDING") {
        const r = activity.record;
        if (r.feedingType === "BREAST") {
          setEditBreastSide((r.side as "LEFT" | "RIGHT" | "BOTH") || "LEFT");
          setEditBreastStart(new Date(r.startTime));
          setEditBreastEnd(r.endTime ? new Date(r.endTime) : null);

          // Initialize per-side durations from record or calculate from total duration
          if (r.leftDurationSeconds != null || r.rightDurationSeconds != null) {
            setEditLeftDurationSeconds(r.leftDurationSeconds ?? 0);
            setEditRightDurationSeconds(r.rightDurationSeconds ?? 0);
          } else if (r.endTime) {
            // Backwards compatibility: split based on side field
            const totalSeconds = Math.floor((new Date(r.endTime).getTime() - new Date(r.startTime).getTime()) / 1000);
            if (r.side === "LEFT") {
              setEditLeftDurationSeconds(totalSeconds);
              setEditRightDurationSeconds(0);
            } else if (r.side === "RIGHT") {
              setEditLeftDurationSeconds(0);
              setEditRightDurationSeconds(totalSeconds);
            } else {
              // BOTH - split evenly
              setEditLeftDurationSeconds(Math.floor(totalSeconds / 2));
              setEditRightDurationSeconds(totalSeconds - Math.floor(totalSeconds / 2));
            }
          }
        } else if (r.feedingType === "BOTTLE") {
          setEditBottleContentType((r.bottleContentType as "FORMULA" | "BREAST_MILK") || "FORMULA");
          setEditBottleAmountMl(r.amountMl ?? DEFAULT_BOTTLE_ML);
          setEditBottleTime(new Date(r.startTime));
        }
      } else if (activity.type === "DIAPER") {
        const r = activity.record;
        setEditDiaperType((r.diaperType as "WET" | "DIRTY" | "BOTH" | "DRY") || "WET");
        setEditDiaperColor((r.color as DiaperColor) || null);
        setEditDiaperAmount((r.amount as DiaperAmount) || null);
        setEditDiaperTime(new Date(r.time));
      }
    }
  }, [editOpen, activity]);

  // Delete mutations
  const deleteSleep = trpc.sleep.delete.useMutation({
    onSuccess: () => {
      utils.sleep.list.invalidate();
      utils.timeline.getList.invalidate({ childId });
      utils.timeline.getDay.invalidate({ childId });
      utils.timeline.getWeek.invalidate({ childId });
      deletedToast("sleep");
      setDeleteConfirmOpen(false);
      closeEditDialog();
    },
  });

  const deleteFeeding = trpc.feeding.delete.useMutation({
    onSuccess: () => {
      utils.feeding.list.invalidate();
      utils.timeline.getList.invalidate({ childId });
      utils.timeline.getDay.invalidate({ childId });
      utils.timeline.getWeek.invalidate({ childId });
      deletedToast("feeding");
      setDeleteConfirmOpen(false);
      closeEditDialog();
    },
  });

  const deleteDiaper = trpc.diaper.delete.useMutation({
    onSuccess: () => {
      utils.diaper.list.invalidate();
      utils.timeline.getList.invalidate({ childId });
      utils.timeline.getDay.invalidate({ childId });
      utils.timeline.getWeek.invalidate({ childId });
      deletedToast("diaper");
      setDeleteConfirmOpen(false);
      closeEditDialog();
    },
  });

  const deletePumping = trpc.pumping.delete.useMutation({
    onSuccess: () => {
      utils.pumping.list.invalidate();
      utils.timeline.getList.invalidate({ childId });
      utils.timeline.getDay.invalidate({ childId });
      utils.timeline.getWeek.invalidate({ childId });
      utils.timeline.getLastActivities.invalidate({ childId });
      deletedToast("pumping");
      setDeleteConfirmOpen(false);
      closeEditDialog();
    },
  });

  const deleteMedicine = trpc.medicine.deleteRecord.useMutation({
    onSuccess: () => {
      utils.medicine.list.invalidate();
      utils.timeline.getList.invalidate({ childId });
      utils.timeline.getDay.invalidate({ childId });
      utils.timeline.getWeek.invalidate({ childId });
      utils.timeline.getLastActivities.invalidate({ childId });
      deletedToast("medicine");
      setDeleteConfirmOpen(false);
      closeEditDialog();
    },
  });

  const deleteGrowth = trpc.growth.delete.useMutation({
    onSuccess: () => {
      utils.growth.list.invalidate();
      utils.timeline.getList.invalidate({ childId });
      utils.timeline.getDay.invalidate({ childId });
      utils.timeline.getWeek.invalidate({ childId });
      utils.timeline.getLastActivities.invalidate({ childId });
      deletedToast("growth");
      setDeleteConfirmOpen(false);
      closeEditDialog();
    },
  });

  const deleteTemperature = trpc.temperature.delete.useMutation({
    onSuccess: () => {
      utils.temperature.list.invalidate();
      utils.timeline.getList.invalidate({ childId });
      utils.timeline.getDay.invalidate({ childId });
      utils.timeline.getWeek.invalidate({ childId });
      utils.timeline.getLastActivities.invalidate({ childId });
      deletedToast("temperature");
      setDeleteConfirmOpen(false);
      closeEditDialog();
    },
  });

  const deleteActivity = trpc.activity.delete.useMutation({
    onSuccess: () => {
      utils.activity.list.invalidate();
      utils.timeline.getList.invalidate({ childId });
      utils.timeline.getDay.invalidate({ childId });
      utils.timeline.getWeek.invalidate({ childId });
      utils.timeline.getLastActivities.invalidate({ childId });
      deletedToast("activity");
      setDeleteConfirmOpen(false);
      closeEditDialog();
    },
  });

  // Update mutations
  const updateSleep = trpc.sleep.update.useMutation({
    onSuccess: () => {
      utils.sleep.list.invalidate();
      utils.timeline.getList.invalidate({ childId });
      utils.timeline.getDay.invalidate({ childId });
      utils.timeline.getWeek.invalidate({ childId });
      updatedToast("sleep");
      closeEditDialog();
    },
  });

  const updateFeeding = trpc.feeding.update.useMutation({
    onSuccess: () => {
      utils.feeding.list.invalidate();
      utils.timeline.getList.invalidate({ childId });
      utils.timeline.getDay.invalidate({ childId });
      utils.timeline.getWeek.invalidate({ childId });
      updatedToast("feeding");
      closeEditDialog();
    },
  });

  const updateDiaper = trpc.diaper.update.useMutation({
    onSuccess: () => {
      utils.diaper.list.invalidate();
      utils.timeline.getList.invalidate({ childId });
      utils.timeline.getDay.invalidate({ childId });
      utils.timeline.getWeek.invalidate({ childId });
      updatedToast("diaper");
      closeEditDialog();
    },
  });

  const handleDelete = () => {
    switch (activity.type) {
      case "SLEEP":
        deleteSleep.mutate({ id: activity.record.id });
        break;
      case "FEEDING":
        deleteFeeding.mutate({ id: activity.record.id });
        break;
      case "DIAPER":
        deleteDiaper.mutate({ id: activity.record.id });
        break;
      case "PUMPING":
        deletePumping.mutate({ id: activity.record.id });
        break;
      case "MEDICINE":
        deleteMedicine.mutate({ id: activity.record.id });
        break;
      case "GROWTH":
        deleteGrowth.mutate({ id: activity.record.id });
        break;
      case "TEMPERATURE":
        deleteTemperature.mutate({ id: activity.record.id });
        break;
      case "ACTIVITY":
        deleteActivity.mutate({ id: activity.record.id });
        break;
    }
  };

  const handleSave = () => {
    switch (activity.type) {
      case "SLEEP":
        if (editSleepStart) {
          updateSleep.mutate({
            id: activity.record.id,
            sleepType: editSleepType,
            startTime: editSleepStart,
            endTime: editSleepEnd,
          });
        }
        break;
      case "FEEDING":
        const r = activity.record as FeedingRecord;
        if (r.feedingType === "BREAST" && editBreastStart) {
          updateFeeding.mutate({
            id: activity.record.id,
            side: editBreastSide,
            startTime: editBreastStart,
            endTime: editBreastEnd,
            leftDurationSeconds: editLeftDurationSeconds,
            rightDurationSeconds: editRightDurationSeconds,
          });
        } else if (r.feedingType === "BOTTLE" && editBottleTime) {
          updateFeeding.mutate({
            id: activity.record.id,
            bottleContentType: editBottleContentType,
            amountMl: Math.round(editBottleAmountMl),
            startTime: editBottleTime,
          });
        }
        break;
      case "DIAPER":
        if (editDiaperTime) {
          updateDiaper.mutate({
            id: activity.record.id,
            diaperType: editDiaperType,
            color: editDiaperColor,
            amount: editDiaperAmount,
            time: editDiaperTime,
          });
        }
        break;
    }
  };

  const isDeleting =
    deleteSleep.isPending || deleteFeeding.isPending || deleteDiaper.isPending ||
    deletePumping.isPending || deleteMedicine.isPending || deleteGrowth.isPending ||
    deleteTemperature.isPending || deleteActivity.isPending;
  const isSaving =
    updateSleep.isPending || updateFeeding.isPending || updateDiaper.isPending;

  // Determine category and display info
  let category: ActivityCategory;
  let description: string;
  let timeDisplay: string;
  let details: string;

  switch (activity.type) {
    case "SLEEP": {
      category = "sleep";
      const r = activity.record;
      const duration = r.endTime ? f.durationPrecise(r.startTime, r.endTime) : "";
      description = duration
        ? t("description.sleepDone", { name: childName, duration })
        : t("description.sleepOngoing", { name: childName });
      timeDisplay = f.timeRange(r.startTime, r.endTime);
      details = te(`sleepType.${r.sleepType === "NIGHT" ? "NIGHT" : "NAP"}`);
      break;
    }
    case "FEEDING": {
      const r = activity.record;
      if (r.feedingType === "BREAST") {
        category = "nursing";
        const duration = r.endTime ? f.durationPrecise(r.startTime, r.endTime) : "";
        description = duration
          ? t("description.breastDone", { name: childName, duration })
          : t("description.breastOngoing", { name: childName });
        timeDisplay = f.timeRange(r.startTime, r.endTime);
        const left = r.leftDurationSeconds ?? 0;
        const right = r.rightDurationSeconds ?? 0;
        if (r.leftDurationSeconds != null && r.rightDurationSeconds != null && (left > 0 || right > 0)) {
          const formatSecs = (s: number) => {
            const mins = Math.floor(s / 60);
            const secs = s % 60;
            return secs > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : f.duration(mins);
          };
          if (left > 0 && right > 0) {
            details = t("details.sideSplit", { left: formatSecs(left), right: formatSecs(right) });
          } else if (left > 0) {
            details = te("breastSide.LEFT");
          } else {
            details = te("breastSide.RIGHT");
          }
        } else {
          details = te(`breastSide.${r.side === "LEFT" ? "LEFT" : r.side === "RIGHT" ? "RIGHT" : "BOTH"}`);
        }
      } else if (r.feedingType === "BOTTLE") {
        category = "bottle";
        const content = te(
          `bottleContent.${r.bottleContentType === "BREAST_MILK" ? "BREAST_MILK" : "FORMULA"}`
        ).toLowerCase();
        description = r.amountMl
          ? t("description.bottleWithAmount", { name: childName, amount: f.ml(r.amountMl), content })
          : t("description.bottle", { name: childName, content });
        timeDisplay = f.time(r.startTime);
        details = "";
      } else {
        category = "solids";
        const foods = r.foodItems?.join(", ") || t("description.solidsFallback");
        description = t("description.solids", { name: childName, foods });
        timeDisplay = f.time(r.startTime);
        details = "";
      }
      break;
    }
    case "DIAPER": {
      category = "diaper";
      const r = activity.record;
      if (r.diaperType === "WET") {
        description = t("description.diaperWet", { name: childName });
      } else if (r.diaperType === "DIRTY") {
        description = t("description.diaperDirty", { name: childName });
      } else if (r.diaperType === "BOTH") {
        description = t("description.diaperBoth", { name: childName });
      } else {
        description = t("description.diaperDry", { name: childName });
      }
      timeDisplay = f.time(r.time);
      details = r.amount ? te(`diaperAmount.${r.amount as DiaperAmount}`) : "";
      break;
    }
    case "PUMPING": {
      category = "pumping";
      const r = activity.record;
      const duration = r.endTime ? f.durationPrecise(r.startTime, r.endTime) : "";
      const amount = r.amountMl ? f.ml(r.amountMl) : "";
      description = duration
        ? amount
          ? t("description.pumpingAmountDuration", { amount, duration })
          : t("description.pumpingDuration", { duration })
        : t("description.pumpingOngoing");
      timeDisplay = f.timeRange(r.startTime, r.endTime);
      details = amount;
      break;
    }
    case "MEDICINE": {
      category = "medicine";
      const r = activity.record;
      const amountStr = r.amount && r.unit ? `${r.amount} ${r.unit}` : "";
      description = amountStr
        ? t("description.medicineWithAmount", { name: childName, medicine: r.medicine.name, amount: amountStr })
        : t("description.medicine", { name: childName, medicine: r.medicine.name });
      timeDisplay = f.time(r.time);
      details = "";
      break;
    }
    case "GROWTH": {
      category = "growth";
      const r = activity.record;
      const parts: string[] = [];
      if (r.weightOz) parts.push(f.weightKg(lbsToKg(r.weightOz / 16)));
      if (r.heightIn) parts.push(f.heightCm(inchesToCm(r.heightIn)));
      description = t("description.growth", {
        name: childName,
        value: parts.join(", ") || t("description.growthRecorded"),
      });
      timeDisplay = f.time(r.date);
      details = "";
      break;
    }
    case "TEMPERATURE": {
      category = "temperature";
      const r = activity.record;
      description = t("description.temperature", {
        name: childName,
        value: f.temperatureC(r.temperatureCelsius),
      });
      timeDisplay = f.time(r.time);
      details = r.temperatureCelsius >= FEVER_THRESHOLD_CELSIUS ? t("details.fever") : "";
      break;
    }
    case "ACTIVITY": {
      category = "activity";
      const r = activity.record;
      const duration = r.endTime ? f.durationPrecise(r.startTime, r.endTime) : "";
      const activityName = te(`activityType.${r.activityType as ActivityTypeValue}`).toLowerCase();
      description = duration
        ? t("description.activityDone", { name: childName, activity: activityName, duration })
        : t("description.activityOngoing", { name: childName, activity: activityName });
      timeDisplay = f.timeRange(r.startTime, r.endTime);
      details = "";
      break;
    }
  }

  const Icon = iconMap[category];
  const iconClasses = getActivityIconClasses(category);

  // Render edit form based on activity type
  const renderEditForm = () => {
    if (activity.type === "SLEEP") {
      return (
        <div className="space-y-4">
          <SimpleToggleGroup
            options={[
              { value: "NAP", label: te("sleepType.NAP") },
              { value: "NIGHT", label: te("sleepType.NIGHT") },
            ]}
            value={editSleepType}
            onChange={setEditSleepType}
            className="mx-0 my-0"
          />
          <TimeRow label={t("edit.startTime")} value={editSleepStart} onChange={setEditSleepStart} />
          <TimeRow label={t("edit.endTime")} value={editSleepEnd} onChange={setEditSleepEnd} placeholder={t("edit.setTime")} />
        </div>
      );
    }

    if (activity.type === "FEEDING") {
      const r = activity.record as FeedingRecord;

      if (r.feedingType === "BREAST") {
        const totalSeconds = editLeftDurationSeconds + editRightDurationSeconds;
        const sliderValue = totalSeconds > 0 ? (editLeftDurationSeconds / totalSeconds) * 100 : 50;

        const formatDuration = (seconds: number) => {
          const mins = Math.floor(seconds / 60);
          const secs = seconds % 60;
          return `${mins}:${String(secs).padStart(2, "0")}`;
        };

        const handleSliderChange = (value: number[]) => {
          const leftPercent = value[0] / 100;
          const newLeftSeconds = Math.round(totalSeconds * leftPercent);
          const newRightSeconds = totalSeconds - newLeftSeconds;
          setEditLeftDurationSeconds(newLeftSeconds);
          setEditRightDurationSeconds(newRightSeconds);

          // Update side based on where the time is
          if (newLeftSeconds > 0 && newRightSeconds > 0) {
            setEditBreastSide("BOTH");
          } else if (newLeftSeconds > 0) {
            setEditBreastSide("LEFT");
          } else {
            setEditBreastSide("RIGHT");
          }
        };

        return (
          <div className="space-y-4">
            <TimeRow label={t("edit.startTime")} value={editBreastStart} onChange={setEditBreastStart} />
            <TimeRow label={t("edit.endTime")} value={editBreastEnd} onChange={setEditBreastEnd} placeholder={t("edit.setTime")} />

            {totalSeconds > 0 && (
              <div className="py-4 border-t border-border">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-muted-foreground">{t("edit.durationSplit")}</span>
                  <span className="text-sm font-medium">
                    {t("edit.total", { value: formatDuration(totalSeconds) })}
                  </span>
                </div>

                <div className="flex justify-between text-sm mb-2">
                  <span className="text-primary font-medium">{t("edit.leftValue", { value: formatDuration(editLeftDurationSeconds) })}</span>
                  <span className="text-primary font-medium">{t("edit.rightValue", { value: formatDuration(editRightDurationSeconds) })}</span>
                </div>

                <Slider
                  value={[sliderValue]}
                  onValueChange={handleSliderChange}
                  min={0}
                  max={100}
                  step={1}
                  className="w-full"
                  aria-label={t("edit.durationSlider")}
                />

                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{t("edit.allLeft")}</span>
                  <span>{t("edit.allRight")}</span>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-border">
              <p className="text-sm text-muted-foreground mb-2">{t("edit.lastBreast")}</p>
              <SimpleToggleGroup
                options={[
                  { value: "LEFT", label: te("breastSide.LEFT") },
                  { value: "RIGHT", label: te("breastSide.RIGHT") },
                  { value: "BOTH", label: te("breastSide.BOTH") },
                ]}
                value={editBreastSide}
                onChange={setEditBreastSide}
                className="mx-0 my-0"
              />
            </div>
          </div>
        );
      }

      if (r.feedingType === "BOTTLE") {
        return (
          <div className="space-y-4">
            <SimpleToggleGroup
              options={[
                { value: "FORMULA", label: te("bottleContent.FORMULA") },
                { value: "BREAST_MILK", label: te("bottleContent.BREAST_MILK") },
              ]}
              value={editBottleContentType}
              onChange={setEditBottleContentType}
              className="mx-0 my-0"
            />
            <TimeRow label={t("edit.time")} value={editBottleTime} onChange={setEditBottleTime} />
            <div className="py-4 border-t border-border">
              <div className="flex items-center justify-between mb-4">
                <span className="text-muted-foreground">{t("edit.amount")}</span>
                <span className="text-xl font-semibold">{f.ml(Math.round(editBottleAmountMl))}</span>
              </div>
              <Slider
                value={[editBottleAmountMl]}
                onValueChange={([val]) => setEditBottleAmountMl(val)}
                max={MAX_BOTTLE_ML}
                step={10}
                className="w-full"
                aria-label={t("edit.amountSlider")}
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0</span>
                <span>{MAX_BOTTLE_ML}</span>
              </div>
            </div>
          </div>
        );
      }

      // Solids - just show read-only for now
      return (
        <div className="flex items-center gap-3">
          <div className={iconClasses}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <p className="font-medium">{description}</p>
            <p className="text-sm text-muted-foreground">{timeDisplay}</p>
          </div>
        </div>
      );
    }

    if (activity.type === "DIAPER") {
      const typeOptions = [
        { value: "WET" as const, icon: Droplets },
        { value: "DIRTY" as const, icon: Cloud },
        { value: "BOTH" as const, icon: CloudRain },
      ];

      const showColorPicker = editDiaperType === "DIRTY" || editDiaperType === "BOTH";

      return (
        <div className="space-y-4">
          <TimeRow label={t("edit.time")} value={editDiaperTime} onChange={setEditDiaperTime} />

          <div className="py-4 border-t border-border">
            <div className="flex justify-center gap-3">
              {typeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setEditDiaperType(option.value)}
                  className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl w-24 min-h-20 transition-colors ${
                    editDiaperType === option.value
                      ? "bg-primary/20 border-2 border-primary"
                      : "bg-muted border-2 border-transparent hover:bg-muted/80"
                  }`}
                >
                  <option.icon className={`h-6 w-6 ${editDiaperType === option.value ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-xs text-center ${editDiaperType === option.value ? "text-primary" : "text-muted-foreground"}`}>
                    {te(`diaperType.${option.value}`)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {showColorPicker && (
            <div className="py-3 border-t border-border">
              <p className="text-sm text-muted-foreground mb-2">{t("edit.color")}</p>
              <div className="flex gap-2 justify-center">
                {colorOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setEditDiaperColor(editDiaperColor === option.value ? null : option.value)}
                    className={`w-12 h-12 rounded-full ${option.color} transition-all ${
                      editDiaperColor === option.value
                        ? "ring-2 ring-primary ring-offset-2"
                        : "opacity-60 hover:opacity-100"
                    }`}
                    title={te(`diaperColor.${option.value}`)}
                    aria-label={te(`diaperColor.${option.value}`)}
                    aria-pressed={editDiaperColor === option.value}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="py-3 border-t border-border">
            <p className="text-sm text-muted-foreground mb-2">{t("edit.amount")}</p>
            <div className="flex gap-3 justify-center">
              {amountOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => setEditDiaperAmount(editDiaperAmount === option ? null : option)}
                  className={`min-w-12 min-h-12 px-4 rounded-full text-sm font-medium transition-colors ${
                    editDiaperAmount === option
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {te(`diaperAmount.${option}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Read-only view for pumping, medicine, growth, temperature, activity
    // These types support delete but not edit (yet)
    if (activity.type === "PUMPING" || activity.type === "MEDICINE" ||
        activity.type === "GROWTH" || activity.type === "TEMPERATURE" ||
        activity.type === "ACTIVITY") {
      return (
        <div className="flex items-center gap-3">
          <div className={iconClasses}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <p className="font-medium">{description}</p>
            <p className="text-sm text-muted-foreground">{timeDisplay}</p>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <button
        onClick={() => setEditOpen(true)}
        className="w-full min-h-12 flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
      >
        <div className={`${iconClasses}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{description}</p>
          <p className="text-xs text-muted-foreground">{timeDisplay}</p>
        </div>
        {details && (
          <span className="text-sm text-muted-foreground">{details}</span>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      </button>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { if (!open) closeEditDialog(); else setEditOpen(true); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("edit.title")}</DialogTitle>
          </DialogHeader>

          {renderEditForm()}

          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button
              variant="destructive"
              onClick={() => setDeleteConfirmOpen(true)}
              className="w-full sm:w-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t("edit.delete")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full sm:w-auto"
            >
              {isSaving ? t("edit.saving") : t("edit.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteDialog.title")}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">{t("deleteDialog.message")}</p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
            >
              {t("edit.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? t("edit.deleting") : t("edit.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
