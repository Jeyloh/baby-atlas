"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { trpc } from "@/lib/trpc/provider";
import { detectInstallHint, type InstallHint } from "@/lib/pwa/install-platform";
import {
  PUSH_OWNER_KEY,
  browserSupportsPush,
  urlBase64ToUint8Array,
  usesApplicationServerKey,
} from "@/lib/notifications/client";
import { toLocale } from "@/i18n/config";

export type PushState =
  /** Still checking the browser */
  | "loading"
  /** No push support in this browser */
  | "unsupported"
  /** Supported, but no service worker runs (development mode) */
  | "noWorker"
  /** The server has no VAPID keys */
  | "notConfigured"
  /** iPhone or iPad where the app is not on the Home Screen yet */
  | "iosNeedsInstall"
  /** The user blocked notifications for the site */
  | "denied"
  | "off"
  | "on";

export type TestResult = "sent" | "noSubscription" | "unavailable" | "rateLimited" | "failed";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

async function getRegistration() {
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

/** Push notification state for this device, and the actions to change it. */
export function usePushSubscription() {
  const locale = toLocale(useLocale());
  const utils = trpc.useUtils();
  const subscribeMutation = trpc.notifications.subscribe.useMutation();
  const unsubscribeMutation = trpc.notifications.unsubscribe.useMutation();
  const { data: me } = trpc.user.get.useQuery();
  const userId = me?.id;

  // The browser can only be asked after mount
  const [browserState, setBrowserState] = useState<{
    status: "loading" | "ready" | PushState;
    endpoint: string | null;
    installHint: InstallHint;
  }>({ status: "loading", endpoint: null, installHint: null });
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const installHint = detectInstallHint();
    if (installHint) {
      setBrowserState({ status: "iosNeedsInstall", endpoint: null, installHint });
      return;
    }
    if (!browserSupportsPush()) {
      setBrowserState({ status: "unsupported", endpoint: null, installHint });
      return;
    }
    if (!VAPID_PUBLIC_KEY) {
      setBrowserState({ status: "notConfigured", endpoint: null, installHint });
      return;
    }
    const registration = await getRegistration();
    if (!registration) {
      setBrowserState({ status: "noWorker", endpoint: null, installHint });
      return;
    }
    if (Notification.permission === "denied") {
      setBrowserState({ status: "denied", endpoint: null, installHint });
      return;
    }
    let subscription = await registration.pushManager.getSubscription();
    // Made with another VAPID key (the keys were rotated): the push service
    // would reject our messages, so drop it and subscribe again
    if (subscription && !usesApplicationServerKey(subscription, VAPID_PUBLIC_KEY)) {
      await subscription.unsubscribe();
      subscription = null;
    }
    setBrowserState({ status: "ready", endpoint: subscription?.endpoint ?? null, installHint });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Whether the server still knows this device's subscription
  const serverStatus = trpc.notifications.status.useQuery(
    { endpoint: browserState.endpoint ?? undefined },
    { enabled: browserState.status === "ready" && browserState.endpoint !== null }
  );

  let state: PushState;
  if (browserState.status === "loading") {
    state = "loading";
  } else if (browserState.status !== "ready") {
    state = browserState.status;
  } else if (browserState.endpoint === null) {
    state = "off";
  } else if (serverStatus.isLoading) {
    state = "loading";
  } else {
    state = serverStatus.data?.thisDevice ? "on" : "off";
  }

  /** Subscribes the browser (permission already granted) and stores it on the server. */
  const register = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    try {
      const registration = await getRegistration();
      if (!registration) return false;

      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }));

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
        await subscription.unsubscribe();
        return false;
      }
      try {
        await subscribeMutation.mutateAsync({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          userAgent: navigator.userAgent.slice(0, 512),
          locale,
        });
      } catch (error) {
        // Do not keep a browser subscription the server does not know about
        await subscription.unsubscribe();
        throw error;
      }
      if (userId) localStorage.setItem(PUSH_OWNER_KEY, userId);
      await Promise.all([
        refresh(),
        utils.notifications.status.invalidate(),
        utils.notifications.getSettings.invalidate(),
      ]);
      return true;
    } finally {
      setBusy(false);
    }
  }, [locale, refresh, subscribeMutation, userId, utils]);

  /** Asks for permission, then registers. Returns whether it worked. */
  const subscribe = useCallback(async (): Promise<boolean> => {
    // Must run inside the tap handler: iOS only shows the prompt for a user gesture
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      await refresh();
      return false;
    }
    return register();
  }, [refresh, register]);

  // Push was on for this user on this device, but the server lost track of it
  // (the subscription was replaced, or pruned): register again without asking
  const reRegistered = useRef(false);
  useEffect(() => {
    if (reRegistered.current || browserState.status !== "ready" || !userId) return;
    if (localStorage.getItem(PUSH_OWNER_KEY) !== userId) return;
    if (Notification.permission !== "granted") return;

    const missingOnServer =
      browserState.endpoint === null || (serverStatus.isSuccess && !serverStatus.data.thisDevice);
    if (!missingOnServer) return;

    reRegistered.current = true;
    void register().catch(() => {
      // Left as "off": the user can turn it on again by hand
    });
  }, [browserState, register, serverStatus.data, serverStatus.isSuccess, userId]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      const registration = await getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await unsubscribeMutation.mutateAsync({ endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      localStorage.removeItem(PUSH_OWNER_KEY);
      await Promise.all([refresh(), utils.notifications.status.invalidate()]);
    } finally {
      setBusy(false);
    }
  }, [refresh, unsubscribeMutation, utils]);

  /** Asks the server to push a test notification to this user's devices. */
  const sendTest = useCallback(async (): Promise<TestResult> => {
    setBusy(true);
    try {
      const response = await fetch("/api/notifications/test", { method: "POST" });
      if (response.ok) return "sent";
      if (response.status === 409) return "noSubscription";
      if (response.status === 503) return "unavailable";
      if (response.status === 429) return "rateLimited";
      return "failed";
    } catch {
      return "failed";
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, installHint: browserState.installHint, subscribe, unsubscribe, sendTest };
}
