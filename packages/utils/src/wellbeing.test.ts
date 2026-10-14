import { describe, it, expect } from "vitest";
import { shouldShowSupport } from "./wellbeing";

const NOW = new Date("2025-03-10T10:00:00.000Z");
const day = (date: string, mood: number) => ({ date, mood });

describe("shouldShowSupport", () => {
  it("is false with fewer than 4 hard days", () => {
    const entries = [day("2025-03-10", 1), day("2025-03-09", 2), day("2025-03-08", 2)];
    expect(shouldShowSupport(entries, NOW)).toBe(false);
  });

  it("is true with 4 hard days in the last 7", () => {
    const entries = [
      day("2025-03-10", 1),
      day("2025-03-09", 2),
      day("2025-03-07", 2),
      day("2025-03-04", 1),
    ];
    expect(shouldShowSupport(entries, NOW)).toBe(true);
  });

  it("ignores days older than 7 days and better days", () => {
    const entries = [
      day("2025-03-10", 3),
      day("2025-03-09", 2),
      day("2025-03-08", 2),
      day("2025-03-07", 2),
      day("2025-03-03", 1),
    ];
    expect(shouldShowSupport(entries, NOW)).toBe(false);
  });

  it("counts a day once", () => {
    const entries = [day("2025-03-10", 1), day("2025-03-10", 1), day("2025-03-09", 1), day("2025-03-08", 1)];
    expect(shouldShowSupport(entries, NOW)).toBe(false);
  });
});
