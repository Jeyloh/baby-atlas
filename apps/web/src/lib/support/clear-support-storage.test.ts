import { afterEach, describe, expect, it } from "vitest";
import { dismissHint, readDismissedHints } from "./dismissed-hints";
import { clearSupportStorage } from "./clear-support-storage";
import { tipDismissKey } from "./tip-dismissed";
import { TIMER_FIX_DISMISSED_KEY } from "./timer-fix-dismissed";

describe("clearSupportStorage", () => {
  afterEach(() => localStorage.clear());

  it("removes hint, tip and timer dismissals but nothing else", () => {
    dismissHint(localStorage, "c1", "feverYoung:t1", new Date());
    dismissHint(localStorage, "c2", "feverYoung:t2", new Date());
    localStorage.setItem(tipDismissKey("c1", "week.3"), "x");
    localStorage.setItem(tipDismissKey("c2", "month.14"), "x");
    localStorage.setItem(TIMER_FIX_DISMISSED_KEY, "{}");
    localStorage.setItem("baby-atlas-cache-owner", "u1");

    clearSupportStorage();

    expect(readDismissedHints(localStorage, "c1", new Date()).size).toBe(0);
    expect(readDismissedHints(localStorage, "c2", new Date()).size).toBe(0);
    expect(localStorage.getItem(tipDismissKey("c1", "week.3"))).toBeNull();
    expect(localStorage.getItem(tipDismissKey("c2", "month.14"))).toBeNull();
    expect(localStorage.getItem(TIMER_FIX_DISMISSED_KEY)).toBeNull();
    expect(localStorage.getItem("baby-atlas-cache-owner")).toBe("u1");
  });
});
