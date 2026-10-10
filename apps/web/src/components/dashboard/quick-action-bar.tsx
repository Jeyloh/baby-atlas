"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { useTranslations } from "next-intl";
import { Baby, Droplets, HeartPulse, Milk, Moon, Settings2, type LucideIcon } from "lucide-react";
import type { QuickAction } from "@baby-atlas/schemas";
import { trpc } from "@/lib/trpc/provider";
import { useToast } from "@/hooks/use-toast";
import { useLongPress } from "@/hooks/use-long-press";
import { useQuickActions, type QuickActionState } from "@/hooks/use-quick-actions";
import { getActivityCardClasses, type ActivityCategory } from "@/lib/activity-colors";
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
  const [busy, setBusy] = useState<QuickAction | null>(null);
  const [detailsFor, setDetailsFor] = useState<LogType | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const { duration } = useFormatters();
  const pinned = user?.quickActions ?? [];
  const formatDuration = (ms: number) => duration(Math.max(1, ms / 60000));

  const handleTap = async (action: QuickAction) => {
    if (busy) return;
    setBusy(action);
    const label = t(`labels.${action}`);
    try {
      const result = await run(action);
      vibrate();

      if (result.kind === "needsDetails") {
        toast({ title: t("bottleNeedsAmount") });
        setDetailsFor(QUICK_ACTION_CONFIG[action].logType);
        return;
      }
      if (result.kind === "stopped") {
        toast({ title: t("stopped", { action: label, duration: formatDuration(result.durationMs) }) });
        return;
      }

      const undo = result.undo;
      toast({
        title: t(result.kind === "logged" ? "logged" : "started", { action: label }),
        action: (
          <ToastAction
            altText={t("undo")}
            onClick={async () => {
              await undo();
              toast({ title: t("undone") });
            }}
          >
            {t("undo")}
          </ToastAction>
        ),
      });
    } catch {
      toast({ title: t("failed"), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="quick-actions-title" className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h2 id="quick-actions-title" className="text-base font-semibold">
            {t("title")}
          </h2>
          <p className="text-xs text-muted-foreground">{t("hint")}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("edit")}
          onClick={() => setPickerOpen(true)}
        >
          <Settings2 className="h-5 w-5" />
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {pinned.map((action) => (
          <QuickActionButton
            key={action}
            action={action}
            state={state[action]}
            busy={busy === action}
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
  busy,
  onTap,
  onLongPress,
}: {
  action: QuickAction;
  state: QuickActionState;
  busy: boolean;
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
      disabled={busy}
      aria-label={state.active ? t("stopLabel", { action: label }) : label}
      aria-pressed={state.active}
      className={`relative min-h-[88px] w-full rounded-xl p-3 text-left select-none touch-manipulation transition-transform active:scale-[0.97] disabled:opacity-60 [-webkit-touch-callout:none] ${getActivityCardClasses(category)} ${state.active ? "ring-4 ring-white/70" : ""}`}
    >
      <Icon className="h-6 w-6" aria-hidden />
      <span className="mt-2 block text-sm font-semibold leading-tight">{label}</span>
      {state.active && (
        <span className="mt-1 flex items-center gap-1.5 text-xs font-medium tabular-nums">
          <span className="h-2 w-2 rounded-full bg-white animate-pulse" aria-hidden />
          {elapsed ?? t("running")}
        </span>
      )}
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
