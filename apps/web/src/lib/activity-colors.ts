/**
 * Activity colors. Each activity has one hue, used three ways:
 * - tint: calm card surfaces (light tint with ink text, dark tint in dark mode)
 * - solid: small chips, timeline bars and running-timer states
 * - icon: a colored glyph on a neutral surface
 * Full class strings are written out so Tailwind can find them.
 */

export type ActivityCategory =
  | "sleep"
  | "nursing"
  | "bottle"
  | "solids"
  | "diaper"
  | "diaperWet"
  | "diaperDirty"
  | "diaperBoth"
  | "diaperDry"
  | "pumping"
  | "medicine"
  | "growth"
  | "temperature"
  | "activity";

export interface ActivityColorConfig {
  tint: string;
  solid: string;
  icon: string;
}

export const activityColors: Record<ActivityCategory, ActivityColorConfig> = {
  sleep: {
    tint: "bg-indigo-50 text-indigo-950 dark:bg-indigo-400/10 dark:text-indigo-100",
    solid: "bg-indigo-500 text-white dark:bg-indigo-400 dark:text-indigo-950",
    icon: "text-indigo-500 dark:text-indigo-300",
  },
  nursing: {
    tint: "bg-rose-50 text-rose-950 dark:bg-rose-400/10 dark:text-rose-100",
    solid: "bg-rose-500 text-white dark:bg-rose-400 dark:text-rose-950",
    icon: "text-rose-500 dark:text-rose-300",
  },
  bottle: {
    tint: "bg-sky-50 text-sky-950 dark:bg-sky-400/10 dark:text-sky-100",
    solid: "bg-sky-500 text-white dark:bg-sky-400 dark:text-sky-950",
    icon: "text-sky-600 dark:text-sky-300",
  },
  solids: {
    tint: "bg-emerald-50 text-emerald-950 dark:bg-emerald-400/10 dark:text-emerald-100",
    solid: "bg-emerald-500 text-white dark:bg-emerald-400 dark:text-emerald-950",
    icon: "text-emerald-600 dark:text-emerald-300",
  },
  diaper: {
    tint: "bg-yellow-50 text-yellow-950 dark:bg-yellow-300/10 dark:text-yellow-100",
    solid: "bg-yellow-400 text-yellow-950 dark:bg-yellow-300 dark:text-yellow-950",
    icon: "text-yellow-600 dark:text-yellow-300",
  },
  diaperWet: {
    tint: "bg-yellow-50 text-yellow-950 dark:bg-yellow-300/10 dark:text-yellow-100",
    solid: "bg-yellow-400 text-yellow-950 dark:bg-yellow-300 dark:text-yellow-950",
    icon: "text-yellow-600 dark:text-yellow-300",
  },
  diaperDirty: {
    tint: "bg-amber-50 text-amber-950 dark:bg-amber-500/10 dark:text-amber-100",
    solid: "bg-amber-700 text-white dark:bg-amber-500 dark:text-amber-950",
    icon: "text-amber-700 dark:text-amber-400",
  },
  diaperBoth: {
    tint: "bg-stone-100 text-stone-900 dark:bg-stone-300/10 dark:text-stone-100",
    solid: "bg-stone-500 text-white dark:bg-stone-300 dark:text-stone-900",
    icon: "text-stone-500 dark:text-stone-300",
  },
  diaperDry: {
    tint: "bg-slate-100 text-slate-900 dark:bg-slate-300/10 dark:text-slate-100",
    solid: "bg-slate-400 text-white dark:bg-slate-300 dark:text-slate-900",
    icon: "text-slate-500 dark:text-slate-300",
  },
  pumping: {
    tint: "bg-violet-50 text-violet-950 dark:bg-violet-400/10 dark:text-violet-100",
    solid: "bg-violet-500 text-white dark:bg-violet-400 dark:text-violet-950",
    icon: "text-violet-500 dark:text-violet-300",
  },
  medicine: {
    tint: "bg-red-50 text-red-950 dark:bg-red-400/10 dark:text-red-100",
    solid: "bg-red-500 text-white dark:bg-red-400 dark:text-red-950",
    icon: "text-red-500 dark:text-red-300",
  },
  growth: {
    tint: "bg-teal-50 text-teal-950 dark:bg-teal-400/10 dark:text-teal-100",
    solid: "bg-teal-600 text-white dark:bg-teal-400 dark:text-teal-950",
    icon: "text-teal-600 dark:text-teal-300",
  },
  temperature: {
    tint: "bg-orange-50 text-orange-950 dark:bg-orange-400/10 dark:text-orange-100",
    solid: "bg-orange-500 text-white dark:bg-orange-400 dark:text-orange-950",
    icon: "text-orange-500 dark:text-orange-300",
  },
  activity: {
    tint: "bg-lime-50 text-lime-950 dark:bg-lime-400/10 dark:text-lime-100",
    solid: "bg-lime-600 text-white dark:bg-lime-400 dark:text-lime-950",
    icon: "text-lime-600 dark:text-lime-300",
  },
};

/** Calm tinted surface for a status card. */
export function getActivityCardClasses(category: ActivityCategory): string {
  return activityColors[category].tint;
}

/** Solid fill for chips, running timers and timeline bars. */
export function getActivityChipClasses(category: ActivityCategory): string {
  return activityColors[category].solid;
}

/** Solid fill for timeline bars. */
export function getActivityBarClasses(category: ActivityCategory): string {
  return activityColors[category].solid;
}

/** Colored glyph on a neutral surface. */
export function getActivityIconClasses(category: ActivityCategory): string {
  return activityColors[category].icon;
}

/**
 * Map feeding types to activity categories
 */
export function feedingTypeToCategory(
  feedingType: "BREAST" | "BOTTLE" | "SOLIDS"
): ActivityCategory {
  switch (feedingType) {
    case "BREAST":
      return "nursing";
    case "BOTTLE":
      return "bottle";
    case "SOLIDS":
      return "solids";
  }
}

/**
 * Map diaper types to activity categories for color-coding
 */
export function diaperTypeToCategory(
  diaperType: "WET" | "DIRTY" | "BOTH" | "DRY"
): ActivityCategory {
  switch (diaperType) {
    case "WET":
      return "diaperWet";
    case "DIRTY":
      return "diaperDirty";
    case "BOTH":
      return "diaperBoth";
    case "DRY":
      return "diaperDry";
  }
}
