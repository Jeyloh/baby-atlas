import { describe, it, expect, beforeEach } from "vitest";
import { clearReportQuestions, questionsStorageKey } from "./report-questions";

describe("report questions storage", () => {
  beforeEach(() => localStorage.clear());

  it("removes only the report notes", () => {
    localStorage.setItem(questionsStorageKey("a"), "Hvorfor?");
    localStorage.setItem(questionsStorageKey("b"), "Når?");
    localStorage.setItem("baby-atlas:other", "keep");

    clearReportQuestions();

    expect(localStorage.getItem(questionsStorageKey("a"))).toBeNull();
    expect(localStorage.getItem(questionsStorageKey("b"))).toBeNull();
    expect(localStorage.getItem("baby-atlas:other")).toBe("keep");
  });
});
