/** Converts the VAPID public key (URL-safe base64) to the bytes the browser wants. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** localStorage: the user who turned push on for this device (cleared when it is turned off) */
export const PUSH_OWNER_KEY = "baby-atlas-push-user";

/** Whether a browser subscription was made with this VAPID public key. */
export function usesApplicationServerKey(
  subscription: Pick<PushSubscription, "options">,
  publicKey: string
): boolean {
  const current = subscription.options?.applicationServerKey;
  if (!current) return false;
  const a = new Uint8Array(current);
  const b = urlBase64ToUint8Array(publicKey);
  return a.length === b.length && a.every((byte, index) => byte === b[index]);
}

/**
 * Removes this browser's push subscription and the "push is on for this user"
 * flag. For when someone else takes over the device or the user signs out:
 * afterwards the old user's notifications can no longer reach it. Best effort,
 * never throws. Returns the endpoint that was removed, if any.
 */
export async function dropBrowserPushSubscription(): Promise<string | undefined> {
  try {
    localStorage.removeItem(PUSH_OWNER_KEY);
    if (!("serviceWorker" in navigator)) return undefined;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager?.getSubscription();
    if (!subscription) return undefined;
    await subscription.unsubscribe();
    return subscription.endpoint;
  } catch {
    return undefined;
  }
}

/** The endpoint of this browser's push subscription, if it has one. Never throws. */
export async function currentPushEndpoint(): Promise<string | undefined> {
  try {
    if (!("serviceWorker" in navigator)) return undefined;
    const registration = await navigator.serviceWorker.getRegistration();
    return (await registration?.pushManager?.getSubscription())?.endpoint;
  } catch {
    return undefined;
  }
}

/** Whether this browser can do web push at all (iOS only inside an installed app). */
export function browserSupportsPush(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}
