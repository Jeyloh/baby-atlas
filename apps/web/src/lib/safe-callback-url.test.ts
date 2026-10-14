import { describe, it, expect } from "vitest";
import { loginUrlFor, safeCallbackUrl } from "./safe-callback-url";

describe("safeCallbackUrl", () => {
  it("keeps paths on this site", () => {
    expect(safeCallbackUrl("/dashboard/go/sleep")).toBe("/dashboard/go/sleep");
    expect(safeCallbackUrl("/dashboard/abc/digest?week=2026-10-12")).toBe(
      "/dashboard/abc/digest?week=2026-10-12"
    );
  });

  it("falls back to the dashboard for anything else", () => {
    expect(safeCallbackUrl(null)).toBe("/dashboard");
    expect(safeCallbackUrl("https://evil.example")).toBe("/dashboard");
    expect(safeCallbackUrl("//evil.example")).toBe("/dashboard");
    expect(safeCallbackUrl("/\\evil.example")).toBe("/dashboard");
    expect(safeCallbackUrl("evil")).toBe("/dashboard");
  });
});

describe("loginUrlFor", () => {
  it("returns to the page the person came from", () => {
    expect(loginUrlFor("/dashboard/go/sleep")).toBe("/login?callbackUrl=%2Fdashboard%2Fgo%2Fsleep");
  });

  it("has no callback for the dashboard or for unsafe paths", () => {
    expect(loginUrlFor("/dashboard")).toBe("/login");
    expect(loginUrlFor(null)).toBe("/login");
    expect(loginUrlFor("//evil.example")).toBe("/login");
  });
});
