"use client";

import { useCallback, useRef } from "react";

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE_PX = 10;

/**
 * Tap and long-press on one element, for touch, mouse and keyboard.
 * Keyboard: Enter/Space is a tap, the context-menu key or Shift+F10 is a
 * long press. Moving the pointer more than a few pixels cancels both, so
 * scrolling over a button does not trigger it.
 */
export function useLongPress({
  onTap,
  onLongPress,
}: {
  onTap: () => void;
  onLongPress: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const firedLongPress = useRef(false);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      firedLongPress.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        firedLongPress.current = true;
        timer.current = null;
        onLongPress();
      }, LONG_PRESS_MS);
    },
    [onLongPress]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!start.current) return;
      const dx = Math.abs(e.clientX - start.current.x);
      const dy = Math.abs(e.clientY - start.current.y);
      if (dx > MOVE_TOLERANCE_PX || dy > MOVE_TOLERANCE_PX) clear();
    },
    [clear]
  );

  const onPointerUp = useCallback(() => {
    const wasPressing = start.current !== null;
    clear();
    if (wasPressing && !firedLongPress.current) onTap();
  }, [clear, onTap]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onTap();
      } else if (e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) {
        e.preventDefault();
        onLongPress();
      }
    },
    [onTap, onLongPress]
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onKeyDown,
    // Stop the browser's own long-press menu (iOS callout, Android menu)
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}
