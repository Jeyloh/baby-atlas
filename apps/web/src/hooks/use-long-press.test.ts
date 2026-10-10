import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useLongPress } from "./use-long-press";
import { sleepTypeFor } from "./use-quick-actions";

const pointer = (x = 0, y = 0, button = 0) =>
  ({ clientX: x, clientY: y, button }) as unknown as React.PointerEvent;

describe("useLongPress", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = () => {
    const onTap = vi.fn();
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onTap, onLongPress }));
    return { h: result.current, onTap, onLongPress };
  };

  it("calls onTap on a short press", () => {
    const { h, onTap, onLongPress } = setup();
    h.onPointerDown(pointer());
    vi.advanceTimersByTime(200);
    h.onPointerUp();
    expect(onTap).toHaveBeenCalledOnce();
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("calls only onLongPress when held", () => {
    const { h, onTap, onLongPress } = setup();
    h.onPointerDown(pointer());
    vi.advanceTimersByTime(600);
    h.onPointerUp();
    expect(onLongPress).toHaveBeenCalledOnce();
    expect(onTap).not.toHaveBeenCalled();
  });

  it("cancels when the pointer moves, so scrolling does not log", () => {
    const { h, onTap, onLongPress } = setup();
    h.onPointerDown(pointer(0, 0));
    h.onPointerMove(pointer(0, 30));
    vi.advanceTimersByTime(600);
    h.onPointerUp();
    expect(onTap).not.toHaveBeenCalled();
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("ignores non-primary buttons", () => {
    const { h, onTap } = setup();
    h.onPointerDown(pointer(0, 0, 2));
    h.onPointerUp();
    expect(onTap).not.toHaveBeenCalled();
  });

  it("supports keyboard tap and long press", () => {
    const { h, onTap, onLongPress } = setup();
    const key = (k: string, shiftKey = false) =>
      ({ key: k, shiftKey, preventDefault: vi.fn() }) as unknown as React.KeyboardEvent;
    h.onKeyDown(key("Enter"));
    h.onKeyDown(key("F10", true));
    expect(onTap).toHaveBeenCalledOnce();
    expect(onLongPress).toHaveBeenCalledOnce();
  });
});

describe("sleepTypeFor", () => {
  it("treats 19:00 to 06:59 as night", () => {
    expect(sleepTypeFor(new Date(2026, 0, 1, 19, 0))).toBe("NIGHT");
    expect(sleepTypeFor(new Date(2026, 0, 1, 6, 59))).toBe("NIGHT");
    expect(sleepTypeFor(new Date(2026, 0, 1, 7, 0))).toBe("NAP");
    expect(sleepTypeFor(new Date(2026, 0, 1, 13, 30))).toBe("NAP");
  });
});
