"use client";

import { useEffect } from "react";

// Production only: in development the worker would serve stale bundles
// between hot reloads. Set NEXT_PUBLIC_SW_IN_DEV=1 to test push notifications
// locally anyway.
const ENABLED =
  process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SW_IN_DEV === "1";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!ENABLED || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed", error);
    });
  }, []);

  return null;
}
