"use client";

import { useTranslations } from "next-intl";
import type { SpeechCategory } from "@baby-atlas/schemas";
import { cn } from "@/lib/utils";
import { SPEECH_CATEGORIES } from "./speech-utils";

interface CategoryToggleProps {
  value: SpeechCategory;
  onChange: (value: SpeechCategory) => void;
  className?: string;
}

export function CategoryToggle({ value, onChange, className }: CategoryToggleProps) {
  const t = useTranslations("speech.categories");
  return (
    <div role="group" className={cn("flex overflow-hidden rounded-lg border border-border", className)}>
      {SPEECH_CATEGORIES.map((category) => (
        <button
          key={category}
          type="button"
          aria-pressed={value === category}
          onClick={() => onChange(category)}
          className={cn(
            "min-h-12 flex-1 px-4 text-sm font-medium transition-colors",
            value === category ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
          )}
        >
          {t(category)}
        </button>
      ))}
    </div>
  );
}
