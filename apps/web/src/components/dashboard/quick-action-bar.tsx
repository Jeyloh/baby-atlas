"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { useTranslations } from "next-intl";
import { Baby, Droplets, HeartPulse, Milk, Moon, Settings2, type LucideIcon } from "lucide-react";
import type { QuickAction } from "@baby-atlas/schemas";
import { trpc } from "@/lib/trpc/provider";
import { useToast } from "@/hooks/use-toast";
import { useLongPress } from "@/hooks/use-long-press";
import { useQuickActions, type QuickActionState } from "@/hooks/use-quick-actions";
import { usePendingCount } from "@/hooks/use-last-activities";
import { getActivityChipClasses, type ActivityCategory } from "@/lib/activity-colors";
import { formatElapsedTime } from "@/stores/timer-store";
import { useFormatters } from "@/lib/format";
import { LogModal } from "@/components/tracking/log-modal";
import { ToastAction } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { QuickActionPicker } from "./quick-action-picker";

type LogType = ComponentProps<typeof LogModal>["type"];

export const QUICK_ACTION_CONFIG: Record<
  QuickAction,
  { icon: LucideIcon; category: ActivityCategory; logType: LogType }
> = {
  diaperWet: { icon: Droplets, category: "diaperWet", logType: "diaper" },
  diaperDirty: { icon: Droplets, category: "diaperDirty", logType: "diaper" },
  diaperBoth: { icon: Droplets, category: "diaperBoth", logType: "diaper" },
  sleep: { icon: Moon, category: "sleep", logType: "sleep" },
  breastLeft: { icon: Baby, category: "nursing", logType: "breast" },
  breastRight: { icon: Baby, category: "nursing", logType: "breast" },
  bottle: { icon: Milk, category: "bottle", logType: "bottle" },
  pumping: { icon: HeartPulse, category: "pumping", logType: "pumping" },
};

function vibrate() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(15);
}

export function QuickActionBar({ childId }: { childId: string }) {
  const t = useTranslations("quickActions");
  const { toast } = useToast();
  const { data: user } = trpc.user.get.useQuery();
  const { state, run } = useQuickActions(childId);
  const pendingCount = usePendingCount(childId);
  const [detailsFor, setDetailsFor] = useState<LogType | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const { duration } = useFormatters();
  const pinned = user?.quickActions ?? [];
  const formatDuration = (ms: number) =>
    ms < 60_000 ? t("lessThanMinute") : duration(ms / 60000);

  const handleTap = (action: QuickAction) => {
    const label = t(`labels.${action}`);
    const result = run(action);
    if (result.kind === "unavailable") {
      toast({ title: t("failed"), variant: "destructive" });
      return;
    }
    vibrate();
    const description = navigator.onLine ? undefined : t("savedOffline");

    if (result.kind === "needsDetails") {
      toast({ title: t("bottleNeedsAmount") });
      setDetailsFor(QUICK_ACTION_CONFIG[action].logType);
      return;
    }
    if (result.kind === "stopped") {
      toast({
        title: t("stopped", { action: label, duration: formatDuration(result.durationMs) }),
        description,
      });
      return;
    }
    if (result.kind === "switched") {
      toast({ title: t("switched", { side: t(`sides.${result.side}`) }), description });
      return;
    }

    const undo = result.undo;
    toast({
      title: t(result.kind === "logged" ? "logged" : "started", { action: label }),
      description,
      action: (
        <ToastAction
          altText={t("undo")}
          onClick={() => {
            undo();
            toast({ title: t("undone") });
          }}
        >
          {t("undo")}
        </ToastAction>
      ),
    });
  };

  return (
    // The one bold surface on the home screen: fjord blue in both themes
    <section
      aria-labelledby="quick-actions-title"
      className="space-y-3 rounded-2xl bg-[#2a5b6e] p-3 text-white dark:bg-[#1c4352]"
    >
      <div className="flex items-center justify-between pl-1">
        <div>
          <h2 id="quick-actions-title" className="font-display text-lg font-semibold tracking-tight">
            {t("title")}
          </h2>
          <p className="text-xs text-white/70">
            {pendingCount > 0 ? t("pendingSync", { count: pendingCount }) : t("hint")}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("edit")}
          onClick={() => setPickerOpen(true)}
          className="text-white hover:bg-white/10 hover:text-white"
        >
          <Settings2 className="h-5 w-5" />
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {pinned.map((action) => (
          <QuickActionButton
            key={action}
            action={action}
            state={state[action]}
            onTap={() => handleTap(action)}
            onLongPress={() => {
              vibrate();
              setDetailsFor(QUICK_ACTION_CONFIG[action].logType);
            }}
          />
        ))}
      </div>

      {detailsFor && (
        <LogModal
          childId={childId}
          type={detailsFor}
          open
          onOpenChange={(open) => !open && setDetailsFor(null)}
        />
      )}

      <QuickActionPicker open={pickerOpen} onOpenChange={setPickerOpen} current={pinned} />
    </section>
  );
}

function QuickActionButton({
  action,
  state,
  onTap,
  onLongPress,
}: {
  action: QuickAction;
  state: QuickActionState;
  onTap: () => void;
  onLongPress: () => void;
}) {
  const t = useTranslations("quickActions");
  const { icon: Icon, category } = QUICK_ACTION_CONFIG[action];
  const handlers = useLongPress({ onTap, onLongPress });
  const elapsed = useElapsed(state.active ? state.startedAt : undefined);
  const label = t(`labels.${action}`);

  return (
    <button
      type="button"
      {...handlers}
      aria-label={state.active ? t("stopLabel", { action: label }) : label}
      aria-pressed={state.active}
      // Neutral action buttons, so they read differently from the colored status
      // cards below. A running timer fills the button with its activity color.
      className={`flex min-h-16 w-full items-center gap-3 rounded-xl p-2 pr-3 text-left select-none touch-manipulation transition-transform active:scale-[0.97] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white [-webkit-touch-callout:none] ${
        state.active
          ? "bg-highlight text-highlight-foreground"
          : "bg-white text-[#17242b] dark:bg-white/10 dark:text-white"
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
          state.active ? "bg-white/40" : getActivityChipClasses(category)
        }`}
        aria-hidden
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-tight">{label}</span>
        {state.active && (
          <span className="mt-0.5 flex items-center gap-1.5 text-xs font-medium tabular-nums">
            <span className="h-2 w-2 rounded-full bg-current animate-pulse" aria-hidden />
            {elapsed ?? t("running")}
          </span>
        )}
      </span>
    </button>
  );
}

function useElapsed(startedAt: Date | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return startedAt ? formatElapsedTime(Math.max(0, now - startedAt.getTime())) : undefined;
}
