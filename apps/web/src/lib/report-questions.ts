const PREFIX = "baby-atlas:report-questions:";

/** localStorage key for the free-text questions of one child's visit report. */
export function questionsStorageKey(childId: string): string {
  return `${PREFIX}${childId}`;
}

/**
 * Removes every saved visit-report note. The notes are about someone's child,
 * so they go when the device changes owner or the user signs out.
 */
export function clearReportQuestions(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // Storage can be blocked; nothing was saved then
  }
}
