export type HouseholdRoleValue = "OWNER" | "ADMIN" | "CAREGIVER" | "VIEWER";

/**
 * Owners and admins edit every entry. Caregivers edit their own. Viewers
 * never write. An entry whose author is gone (authorId null) is only
 * editable by owners and admins.
 */
export function canEditJournalEntry(
  role: HouseholdRoleValue,
  authorId: string | null,
  userId: string
): boolean {
  if (role === "OWNER" || role === "ADMIN") return true;
  if (role === "CAREGIVER") return authorId !== null && authorId === userId;
  return false;
}

export function journalPhotoKey(childId: string, entryId: string, photoId: string): string {
  return `journal/${childId}/${entryId}/${photoId}.webp`;
}

export function journalThumbKey(photoKey: string): string {
  return photoKey.replace(/\.webp$/, ".thumb.webp");
}
