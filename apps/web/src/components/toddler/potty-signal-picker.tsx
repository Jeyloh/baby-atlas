"use client";

import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { POTTY_SIGNALS, type PottySignal } from "@baby-atlas/schemas";
import { cn } from "@/lib/utils";

interface PottySignalPickerProps {
  selected: PottySignal[];
  onToggle: (signal: PottySignal) => void;
}

export function PottySignalPicker({ selected, onToggle }: PottySignalPickerProps) {
  const t = useTranslations("potty.signals");
  return (
    <ul className="space-y-2">
      {POTTY_SIGNALS.map((signal) => {
        const isSelected = selected.includes(signal);
        return (
          <li key={signal}>
            <button
              type="button"
              aria-pressed={isSelected}
              onClick={() => onToggle(signal)}
              className={cn(
                "flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-2 text-left text-base transition-colors",
                isSelected ? "border-primary bg-primary/10 font-medium" : "bg-card hover:bg-muted"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                  isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                )}
              >
                {isSelected && <Check className="h-4 w-4" />}
              </span>
              {t(signal)}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
