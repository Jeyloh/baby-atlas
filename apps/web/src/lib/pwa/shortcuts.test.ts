import { describe, it, expect } from "vitest";
import { SHORTCUT_TARGETS, shortcutDestination, shortcutUrl } from "./shortcuts";
import manifest from "@/app/manifest";

describe("shortcuts", () => {
  it("builds the redirect url and the destination for a child", () => {
    expect(shortcutUrl("sleep")).toBe("/dashboard/go/sleep");
    expect(shortcutDestination("sleep", "abc")).toBe("/dashboard/abc/log?type=sleep");
    expect(shortcutDestination("chat", "abc")).toBe("/dashboard/abc/chat");
  });

  it("returns null for an unknown shortcut", () => {
    expect(shortcutDestination("nope", "abc")).toBeNull();
  });

  it("has unique ids and at most four shortcuts, as Android shows", () => {
    const ids = SHORTCUT_TARGETS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeLessThanOrEqual(4);
  });
});

describe("web app manifest shortcuts", () => {
  it("lists every shortcut inside the app scope", () => {
    const { shortcuts } = manifest();
    expect(shortcuts).toHaveLength(SHORTCUT_TARGETS.length);
    for (const shortcut of shortcuts ?? []) {
      expect(shortcut.url.startsWith("/dashboard/go/")).toBe(true);
      expect(shortcut.name).toBeTruthy();
    }
  });
});
