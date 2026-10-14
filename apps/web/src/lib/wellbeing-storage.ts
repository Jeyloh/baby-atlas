const PREFIX = "baby-atlas-wellbeing-";

/**
 * localStorage key for a wellbeing preference. Keyed by user id, because the
 * check-in is private and a device can be shared between accounts.
 */
export function wellbeingStorageKey(name: "hidden" | "support-dismissed", userId: string) {
  return `${PREFIX}${name}:${userId}`;
}

/** Removes every wellbeing preference from this device (used when the owner changes). */
export function clearWellbeingStorage() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // storage unavailable
  }
}
