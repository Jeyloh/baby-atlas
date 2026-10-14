import { browserStorage } from "./browser-storage";
import { clearDismissedHints } from "./dismissed-hints";
import { clearTimerFixDismissals } from "./timer-fix-dismissed";
import { clearTipDismissals } from "./tip-dismissed";

/** Removes everything the support cards saved on this device (used when the owner changes). */
export function clearSupportStorage(): void {
  const storage = browserStorage();
  if (!storage) return;
  clearDismissedHints(storage);
  clearTipDismissals(storage);
  clearTimerFixDismissals(storage);
}
