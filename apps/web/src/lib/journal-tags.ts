import {
  Laugh,
  Sparkles,
  Stethoscope,
  Sun,
  Thermometer,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import type { JournalTagValue } from "@baby-atlas/schemas";

/**
 * Journal tag colors, in the same three roles as activity-colors.ts:
 * tint for calm surfaces, solid for selected chips, icon for a glyph on a
 * neutral surface. Every class has a dark variant or is a theme token.
 * Full class strings are written out so Tailwind can find them.
 */
export interface JournalTagConfig {
  icon: LucideIcon;
  tint: string;
  solid: string;
  iconColor: string;
}

export const journalTags: Record<JournalTagValue, JournalTagConfig> = {
  SICKNESS: {
    icon: Thermometer,
    tint: "bg-red-50 text-red-950 dark:bg-red-400/10 dark:text-red-100",
    solid: "bg-red-500 text-white dark:bg-red-400 dark:text-red-950",
    iconColor: "text-red-500 dark:text-red-300",
  },
  MILESTONE: {
    icon: Trophy,
    tint: "bg-highlight/20 text-foreground",
    solid: "bg-highlight text-highlight-foreground",
    iconColor: "text-highlight-foreground dark:text-highlight",
  },
  FIRST_TIME: {
    icon: Sparkles,
    tint: "bg-violet-50 text-violet-950 dark:bg-violet-400/10 dark:text-violet-100",
    solid: "bg-violet-500 text-white dark:bg-violet-400 dark:text-violet-950",
    iconColor: "text-violet-500 dark:text-violet-300",
  },
  CLINIC: {
    icon: Stethoscope,
    tint: "bg-teal-50 text-teal-950 dark:bg-teal-400/10 dark:text-teal-100",
    solid: "bg-teal-600 text-white dark:bg-teal-400 dark:text-teal-950",
    iconColor: "text-teal-600 dark:text-teal-300",
  },
  FUNNY: {
    icon: Laugh,
    tint: "bg-pink-50 text-pink-950 dark:bg-pink-400/10 dark:text-pink-100",
    solid: "bg-pink-500 text-white dark:bg-pink-400 dark:text-pink-950",
    iconColor: "text-pink-500 dark:text-pink-300",
  },
  EVERYDAY: {
    icon: Sun,
    tint: "bg-stone-100 text-stone-900 dark:bg-stone-300/10 dark:text-stone-100",
    solid: "bg-stone-500 text-white dark:bg-stone-300 dark:text-stone-900",
    iconColor: "text-stone-500 dark:text-stone-300",
  },
};
