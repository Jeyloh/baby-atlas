import { describe, it, expect } from "vitest";
import { canEditJournalEntry, journalPhotoKey, journalThumbKey } from "./journal";

describe("canEditJournalEntry", () => {
  it("lets owners and admins edit anything, even an entry without an author", () => {
    for (const role of ["OWNER", "ADMIN"] as const) {
      expect(canEditJournalEntry(role, "other", "me")).toBe(true);
      expect(canEditJournalEntry(role, null, "me")).toBe(true);
    }
  });

  it("lets caregivers edit only their own entries", () => {
    expect(canEditJournalEntry("CAREGIVER", "me", "me")).toBe(true);
    expect(canEditJournalEntry("CAREGIVER", "other", "me")).toBe(false);
    expect(canEditJournalEntry("CAREGIVER", null, "me")).toBe(false);
  });

  it("never lets viewers edit", () => {
    expect(canEditJournalEntry("VIEWER", "me", "me")).toBe(false);
  });
});

describe("journal storage keys", () => {
  it("builds the photo key and derives the thumbnail key", () => {
    const key = journalPhotoKey("child1", "entry1", "photo1");
    expect(key).toBe("journal/child1/entry1/photo1.webp");
    expect(journalThumbKey(key)).toBe("journal/child1/entry1/photo1.thumb.webp");
  });
});
