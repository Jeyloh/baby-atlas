import { removeKeysWithPrefix } from "./browser-storage";

const KEY_PREFIX = "baby-atlas-health-hints-dismissed:";
/** A dismissal is forgotten after this long (hint ids carry a record or a time, so they do not come back). */
const KEEP_DAYS = 14;

type Dismissed = Record<string, string>;

function keyFor(childId: string): string {
  return `${KEY_PREFIX}${childId}`;
}

function read(storage: Pick<Storage, "getItem"> | null, childId: string): Dismissed {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(keyFor(childId)) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string")
    );
  } catch {
    return {};
  }
}

/** The ids of hints this device has dismissed for a child. */
export function readDismissedHints(
  storage: Pick<Storage, "getItem"> | null,
  childId: string,
  now: Date
): Set<string> {
  const cutoff = now.getTime() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  return new Set(
    Object.entries(read(storage, childId))
      .filter(([, at]) => new Date(at).getTime() >= cutoff)
      .map(([id]) => id)
  );
}

/** Removes every health hint dismissal from this device (used when the owner changes). */
export function clearDismissedHints(storage: Storage): void {
  removeKeysWithPrefix(storage, KEY_PREFIX);
}

/** Remembers a dismissal on this device and forgets old ones. */
export function dismissHint(
  storage: Pick<Storage, "getItem" | "setItem">,
  childId: string,
  id: string,
  now: Date
): void {
  const cutoff = now.getTime() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  const kept = Object.fromEntries(
    Object.entries(read(storage, childId)).filter(([, at]) => new Date(at).getTime() >= cutoff)
  );
  kept[id] = now.toISOString();
  try {
    storage.setItem(keyFor(childId), JSON.stringify(kept));
  } catch {
    // Storage full or blocked: the hint comes back on reload, which is harmless
  }
}
