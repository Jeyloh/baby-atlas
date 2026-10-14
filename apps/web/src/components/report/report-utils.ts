/** localStorage key for the free-text questions of one child's visit report. */
export function questionsStorageKey(childId: string): string {
  return `baby-atlas:report-questions:${childId}`;
}
