import { removeKeysWithPrefix } from "./browser-storage";

const KEY_PREFIX = "baby-atlas-tip-dismissed:";

/** Dismissal is remembered per child and tip, so the next tip shows again. */
export function tipDismissKey(childId: string, tipKey: string): string {
  return `${KEY_PREFIX}${childId}:${tipKey}`;
}

/** Removes every tip dismissal from this device (used when the owner changes). */
export function clearTipDismissals(storage: Storage): void {
  removeKeysWithPrefix(storage, KEY_PREFIX);
}
