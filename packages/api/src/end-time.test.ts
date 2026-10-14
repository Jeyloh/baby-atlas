import { describe, it, expect } from "vitest";
import { assertEndTime, assertUpdatedTimes, endTimeOrNow } from "./end-time";

const start = new Date("2026-03-01T10:00:00Z");
const now = new Date("2026-03-01T12:00:00Z");
const badRequest = expect.objectContaining({ code: "BAD_REQUEST" });

describe("assertEndTime", () => {
  it("passes an end between start and now", () => {
    const end = new Date("2026-03-01T11:00:00Z");
    expect(assertEndTime(start, end, now)).toEqual(end);
  });

  it("accepts an end equal to the start", () => {
    expect(assertEndTime(start, start, now)).toEqual(start);
  });

  it("rejects an end before the start", () => {
    expect(() => assertEndTime(start, new Date("2026-03-01T09:59:00Z"), now)).toThrowError(badRequest);
  });

  it("cuts a future end back to now", () => {
    expect(assertEndTime(start, new Date("2026-03-01T13:00:00Z"), now)).toEqual(now);
  });

  it("never cuts the end back to before the start", () => {
    const futureStart = new Date("2026-03-01T12:30:00Z");
    const end = new Date("2026-03-01T13:00:00Z");
    expect(assertEndTime(futureStart, end, now)).toEqual(futureStart);
  });

  it("passes undefined and null through", () => {
    expect(assertEndTime(start, undefined, now)).toBeUndefined();
    expect(assertEndTime(start, null, now)).toBeNull();
  });
});

describe("endTimeOrNow", () => {
  it("defaults to now", () => {
    expect(endTimeOrNow(start, undefined, now)).toEqual(now);
  });

  it("checks a given end", () => {
    expect(() => endTimeOrNow(start, new Date("2026-03-01T09:00:00Z"), now)).toThrowError(badRequest);
  });
});

describe("assertUpdatedTimes", () => {
  const existing = { startTime: start, endTime: new Date("2026-03-01T11:00:00Z") };

  it("leaves the end alone when the input has none and the start still fits", () => {
    expect(assertUpdatedTimes(existing, { startTime: new Date("2026-03-01T10:30:00Z") })).toBeUndefined();
  });

  it("rejects moving the start past the stored end", () => {
    expect(() => assertUpdatedTimes(existing, { startTime: new Date("2026-03-01T11:30:00Z") })).toThrowError(
      badRequest
    );
  });

  it("rejects a new end before the stored start", () => {
    expect(() => assertUpdatedTimes(existing, { endTime: new Date("2026-03-01T09:00:00Z") })).toThrowError(
      badRequest
    );
  });

  it("allows clearing the end and a still running record", () => {
    expect(assertUpdatedTimes(existing, { endTime: null })).toBeNull();
    const running = { startTime: start, endTime: null };
    expect(assertUpdatedTimes(running, { startTime: new Date("2026-03-01T10:30:00Z") })).toBeUndefined();
  });
});
