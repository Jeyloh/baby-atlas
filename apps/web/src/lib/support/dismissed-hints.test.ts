import { describe, it, expect } from "vitest";
import { dismissHint, readDismissedHints } from "./dismissed-hints";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

const NOW = new Date("2026-01-15T11:00:00Z");

describe("dismissed hints", () => {
  it("starts empty", () => {
    expect(readDismissedHints(memoryStorage(), "c1", NOW).size).toBe(0);
  });

  it("remembers a dismissal per child", () => {
    const storage = memoryStorage();
    dismissHint(storage, "c1", "feverYoung:t1", NOW);

    expect(readDismissedHints(storage, "c1", NOW).has("feverYoung:t1")).toBe(true);
    expect(readDismissedHints(storage, "c2", NOW).has("feverYoung:t1")).toBe(false);
  });

  it("keeps earlier dismissals when a new one is added", () => {
    const storage = memoryStorage();
    dismissHint(storage, "c1", "a", NOW);
    dismissHint(storage, "c1", "b", NOW);
    expect([...readDismissedHints(storage, "c1", NOW)].sort()).toEqual(["a", "b"]);
  });

  it("forgets dismissals older than 14 days", () => {
    const storage = memoryStorage();
    dismissHint(storage, "c1", "old", new Date("2025-12-20T11:00:00Z"));
    expect(readDismissedHints(storage, "c1", NOW).size).toBe(0);

    dismissHint(storage, "c1", "new", NOW);
    expect(Object.keys(JSON.parse(storage.data["baby-atlas-health-hints-dismissed:c1"]!))).toEqual(["new"]);
  });

  it("survives broken stored data", () => {
    const storage = memoryStorage({ "baby-atlas-health-hints-dismissed:c1": "{not json" });
    expect(readDismissedHints(storage, "c1", NOW).size).toBe(0);
    const arrayStorage = memoryStorage({ "baby-atlas-health-hints-dismissed:c1": "[1,2]" });
    expect(readDismissedHints(arrayStorage, "c1", NOW).size).toBe(0);
  });
});
