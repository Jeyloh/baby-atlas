import { create } from "zustand";
import type { QueryClient } from "@tanstack/react-query";
import { dropBrowserPushSubscription } from "@/lib/notifications/client";
import { clearWellbeingStorage } from "@/lib/wellbeing-storage";
import { clearSavedData } from "./query-persister";

const LAST_OWNER_KEY = "baby-atlas-cache-owner";

interface DeviceOwnerState {
  // Whose saved data may be loaded and written on this device
  owner?: string;
  // The server confirmed owner as the signed-in user in this app session.
  // Only then may queued quick actions be sent.
  verified: boolean;
}

export const useDeviceOwner = create<DeviceOwnerState>(() => ({ verified: false }));

function lastConfirmedOwner(): string | undefined {
  return localStorage.getItem(LAST_OWNER_KEY) ?? undefined;
}

/**
 * Loads the saved data of the user the server confirmed last time. Only for
 * when the server cannot be asked now (offline or a very slow connection).
 */
export function fallBackToLastConfirmedOwner() {
  useDeviceOwner.setState((state) => (state.owner ? state : { owner: lastConfirmedOwner() }));
}

/**
 * The server confirmed userId. Saved data of anyone else is deleted before
 * this user's own saved data may load.
 */
export async function claimDevice(queryClient: QueryClient, userId: string) {
  const previous = lastConfirmedOwner();
  const loaded = useDeviceOwner.getState().owner;
  // Recorded before anything else, so the slow-connection fallback can no
  // longer pick the old owner while the clear below runs
  localStorage.setItem(LAST_OWNER_KEY, userId);
  if ((previous && previous !== userId) || (loaded && loaded !== userId)) {
    // Unset, so a load of the old owner's data that finishes during the
    // clear fails the persister's owner check
    useDeviceOwner.setState({ owner: undefined, verified: false });
    queryClient.clear();
    // The previous user's push notifications must not keep arriving here
    await dropBrowserPushSubscription();
    await clearSavedData();
    clearWellbeingStorage();
  }
  useDeviceOwner.setState({ owner: userId, verified: true });
}

/**
 * Removes the user's data from the device: in-memory and saved queries, and
 * cached pages. Queued quick actions stay, so nothing logged offline is lost
 * if the same person signs in again.
 */
export async function releaseDevice(queryClient: QueryClient) {
  useDeviceOwner.setState({ owner: undefined, verified: false });
  localStorage.removeItem(LAST_OWNER_KEY);
  queryClient.clear();
  await dropBrowserPushSubscription();
  await clearSavedData();
  clearWellbeingStorage();
}
