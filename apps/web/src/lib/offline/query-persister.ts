import type { QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { signOut } from "next-auth/react";
import { del, get, set } from "idb-keyval";
import SuperJSON from "superjson";

const PERSIST_KEY = "baby-atlas-query-cache";

/** How long saved query data is shown when the app opens without a connection. */
export const OFFLINE_DATA_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Bump when a stored query shape changes in a way old data would break
export const QUERY_CACHE_BUSTER = "1";

export function createQueryPersister() {
  return createAsyncStoragePersister({
    key: PERSIST_KEY,
    storage:
      typeof window === "undefined"
        ? undefined
        : {
            getItem: (key: string) => get<string>(key).then((value) => value ?? null),
            setItem: (key: string, value: string) => set(key, value),
            removeItem: (key: string) => del(key),
          },
    serialize: (client) => SuperJSON.stringify(client),
    deserialize: (raw) => SuperJSON.parse(raw),
  });
}

/**
 * Signs out and removes this user's data from the device: saved queries and
 * the pages the service worker cached. Queued quick actions stay, so nothing
 * logged offline is lost if the same person signs in again. Rejects when
 * the sign-out request fails (offline), and then nothing is cleared.
 */
export async function signOutAndClearDevice(queryClient: QueryClient) {
  await signOut({ redirect: false });
  queryClient.clear();
  await Promise.allSettled([
    del(PERSIST_KEY),
    typeof caches === "undefined"
      ? Promise.resolve()
      : caches.keys().then((keys) =>
          Promise.all(keys.filter((key) => key.startsWith("pages-")).map((key) => caches.delete(key)))
        ),
  ]);
  window.location.assign("/");
}
