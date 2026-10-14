"use client";

import { useState } from "react";
import { browserStorage } from "@/lib/support/browser-storage";

function read(key: string | undefined): string | null {
  if (!key) return null;
  try {
    return browserStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/**
 * A localStorage value kept in state. It is read when the component first
 * renders and again when the key changes, so there is no frame with the wrong
 * value. Set `null` to remove it. With no key the value is null and writes
 * are ignored.
 */
export function useStoredValue(key: string | undefined) {
  const [state, setState] = useState(() => ({ key, value: read(key) }));
  let current = state;
  if (state.key !== key) {
    // The key changed during this render: read the new one right away
    current = { key, value: read(key) };
    setState(current);
  }

  const update = (next: string | null) => {
    if (!key) return;
    try {
      const storage = browserStorage();
      if (next === null) storage?.removeItem(key);
      else storage?.setItem(key, next);
    } catch {
      // storage unavailable: the choice only lasts for this page
    }
    setState({ key, value: next });
  };

  return [current.value, update] as const;
}
