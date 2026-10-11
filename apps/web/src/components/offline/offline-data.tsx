"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { TRPCClientError } from "@trpc/client";
import { trpc } from "@/lib/trpc/provider";
import {
  claimDevice,
  fallBackToLastConfirmedOwner,
  releaseDevice,
  useDeviceOwner,
} from "@/lib/offline/device-owner";
import {
  createQueryPersister,
  OFFLINE_DATA_MAX_AGE_MS,
  QUERY_CACHE_BUSTER,
} from "@/lib/offline/query-persister";

// How long to wait for the server before loading the last confirmed user's
// saved data on a connection that is up but very slow
const CONFIRM_TIMEOUT_MS = 3000;

/**
 * Decides whose saved data may load, then loads and saves it. Online, the
 * server is asked who is signed in first, so another user's data is deleted
 * before it can show. Offline, the last confirmed user's data loads.
 */
export function OfflineData() {
  const queryClient = useQueryClient();
  const utils = trpc.useUtils();
  const owner = useDeviceOwner((state) => state.owner);

  useEffect(() => {
    let stopped = false;
    const confirm = async () => {
      try {
        // Called directly: the saved cache may belong to someone else
        const user = await utils.client.user.get.query();
        if (!stopped && user) await claimDevice(queryClient, user.id);
      } catch (error) {
        if (stopped) return;
        if (error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED") {
          await releaseDevice(queryClient);
        } else {
          fallBackToLastConfirmedOwner();
        }
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void confirm();
    };

    const slow = setTimeout(fallBackToLastConfirmedOwner, CONFIRM_TIMEOUT_MS);
    if (!navigator.onLine) fallBackToLastConfirmedOwner();
    void confirm().finally(() => clearTimeout(slow));
    window.addEventListener("online", confirm);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(slow);
      window.removeEventListener("online", confirm);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [utils, queryClient]);

  // Restored in the background instead of through PersistQueryClientProvider,
  // which holds every query idle until the restore ends. That made isLoading
  // false with no data on the server and first paint, so pages flashed their
  // empty states. Hydrating never replaces data newer than the saved copy.
  useEffect(() => {
    if (!owner) return;
    const [unsubscribe] = persistQueryClient({
      queryClient,
      persister: createQueryPersister(owner, (id) => useDeviceOwner.getState().owner === id),
      maxAge: OFFLINE_DATA_MAX_AGE_MS,
      buster: QUERY_CACHE_BUSTER,
    });
    return unsubscribe;
  }, [queryClient, owner]);

  return null;
}
