/**
 * Home screen shortcuts (long press the app icon). The web manifest is not
 * localised, so the names are Norwegian Bokmål, the app's default language.
 *
 * Most targets need a child, which a manifest cannot know. Shortcuts open
 * `/dashboard/go/<target>`, which picks the child the app opens by default
 * (the first one, as `/dashboard` does) and forwards to the right page.
 */
export interface ShortcutTarget {
  /** Last segment of /dashboard/go/<id> */
  id: string;
  name: string;
  shortName: string;
  description: string;
  /** Path below /dashboard/<childId> */
  childPath: string;
}

export const SHORTCUT_TARGETS: ShortcutTarget[] = [
  {
    id: "sleep",
    name: "Logg søvn",
    shortName: "Søvn",
    description: "Logg søvn for barnet",
    childPath: "log?type=sleep",
  },
  {
    id: "feeding",
    name: "Logg amming",
    shortName: "Amming",
    description: "Logg amming for barnet",
    childPath: "log?type=breast",
  },
  {
    id: "diaper",
    name: "Logg bleie",
    shortName: "Bleie",
    description: "Logg bleieskift for barnet",
    childPath: "log?type=diaper",
  },
  {
    id: "chat",
    name: "Spør assistenten",
    shortName: "Chat",
    description: "Åpne chatten med AI-assistenten",
    childPath: "chat",
  },
];

export const SHORTCUT_BASE_PATH = "/dashboard/go";

export function shortcutUrl(id: string): string {
  return `${SHORTCUT_BASE_PATH}/${id}`;
}

/** Where a shortcut leads for a child, or null for an unknown shortcut. */
export function shortcutDestination(id: string, childId: string): string | null {
  const target = SHORTCUT_TARGETS.find((t) => t.id === id);
  return target ? `/dashboard/${childId}/${target.childPath}` : null;
}
