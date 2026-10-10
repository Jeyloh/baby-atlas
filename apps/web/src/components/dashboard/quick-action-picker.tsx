"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import {
  MAX_PINNED_QUICK_ACTIONS,
  QUICK_ACTIONS,
  type QuickAction,
} from "@baby-atlas/schemas";
import { trpc } from "@/lib/trpc/provider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function QuickActionPicker({
  open,
  onOpenChange,
  current,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: QuickAction[];
}) {
  const t = useTranslations("quickActions");
  const tc = useTranslations("common");
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [selected, setSelected] = useState<QuickAction[]>(current);

  useEffect(() => {
    if (open) setSelected(current);
  }, [open, current]);

  const save = trpc.user.setQuickActions.useMutation({
    onSuccess: () => {
      void utils.user.get.invalidate();
      onOpenChange(false);
    },
    onError: () => toast({ title: t("failed"), variant: "destructive" }),
  });

  const toggle = (action: QuickAction) =>
    setSelected((prev) =>
      prev.includes(action)
        ? prev.filter((a) => a !== action)
        : prev.length < MAX_PINNED_QUICK_ACTIONS
          ? [...prev, action]
          : prev
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("pickerTitle")}</DialogTitle>
          <DialogDescription>
            {t("pickerHint", { max: MAX_PINNED_QUICK_ACTIONS })}
          </DialogDescription>
        </DialogHeader>

        <ul className="grid gap-2">
          {QUICK_ACTIONS.map((action) => {
            const isSelected = selected.includes(action);
            const isFull = !isSelected && selected.length >= MAX_PINNED_QUICK_ACTIONS;
            return (
              <li key={action}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  disabled={isFull}
                  onClick={() => toggle(action)}
                  className={cn(
                    "flex min-h-12 w-full items-center justify-between rounded-lg border px-4 text-left text-sm transition-colors",
                    isSelected ? "border-primary bg-primary/10" : "hover:bg-muted",
                    isFull && "opacity-50"
                  )}
                >
                  {t(`labels.${action}`)}
                  {isSelected && <Check className="h-4 w-4 text-primary" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-between gap-3 pt-2">
          <span className="text-xs text-muted-foreground">
            {t("pickerCount", { count: selected.length, max: MAX_PINNED_QUICK_ACTIONS })}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button
              disabled={save.isPending}
              onClick={() => save.mutate({ quickActions: selected })}
            >
              {tc("save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
