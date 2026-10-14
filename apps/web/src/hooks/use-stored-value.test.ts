import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useStoredValue } from "./use-stored-value";

describe("useStoredValue", () => {
  afterEach(() => localStorage.clear());

  it("has the saved value on the very first render", () => {
    localStorage.setItem("k", "saved");
    const seen: Array<string | null> = [];
    renderHook(() => {
      const [value] = useStoredValue("k");
      seen.push(value);
    });
    expect(seen[0]).toBe("saved");
  });

  it("saves and removes values", () => {
    const { result } = renderHook(() => useStoredValue("k"));
    expect(result.current[0]).toBeNull();

    act(() => result.current[1]("x"));
    expect(result.current[0]).toBe("x");
    expect(localStorage.getItem("k")).toBe("x");

    act(() => result.current[1](null));
    expect(result.current[0]).toBeNull();
    expect(localStorage.getItem("k")).toBeNull();
  });

  it("reads the new key when it changes", () => {
    localStorage.setItem("b", "second");
    const { result, rerender } = renderHook(({ k }) => useStoredValue(k), {
      initialProps: { k: undefined as string | undefined },
    });
    expect(result.current[0]).toBeNull();

    rerender({ k: "b" });
    expect(result.current[0]).toBe("second");
  });
});
