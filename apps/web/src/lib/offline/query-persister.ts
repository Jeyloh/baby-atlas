import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { Persister } from "@tanstack/react-query-persist-client";
import { del, get, keys, set } from "idb-keyval";
import SuperJSON from "superjson";

const PERSIST_KEY_BASE = "baby-atlas-query-cache";
const PERSIST_KEY_PREFIX = `${PERSIST_KEY_BASE}:`;

/** How long saved query data is shown when the app opens without a connection. */
export const OFFLINE_DATA_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Bump when a stored query shape changes in a way old data would break
export const QUERY_CACHE_BUSTER = "1";

/**
 * Saved under the owner's id, so one user's cache can never load for another.
 * isCurrentOwner is asked again after the read: the server may have confirmed
 * someone else while it ran, and then the data is dropped.
 */
export function createQueryPersister(ownerId: string, isCurrentOwner: (ownerId: string) => boolean): Persister {
  const persister = createAsyncStoragePersister({
    key: `${PERSIST_KEY_PREFIX}${ownerId}`,
    storage: {
      getItem: (key: string) => get<string>(key).then((value) => value ?? null),
      setItem: (key: string, value: string) => set(key, value),
      removeItem: (key: string) => del(key),
    },
    serialize: (client) => SuperJSON.stringify(client),
    deserialize: (raw) => SuperJSON.parse(raw),
  });
  return {
    ...persister,
    restoreClient: async () => {
      const client = await persister.restoreClient();
      return isCurrentOwner(ownerId) ? client : undefined;
    },
  };
}

/** Deletes every saved query cache and the pages the service worker cached. */
export async function clearSavedData() {
  await Promise.allSettled([
    keys().then((all) =>
      Promise.all(
        all.filter((key) => String(key).startsWith(PERSIST_KEY_BASE)).map((key) => del(key))
      )
    ),
    typeof caches === "undefined"
      ? Promise.resolve()
      : caches.keys().then((names) =>
          Promise.all(names.filter((name) => name.startsWith("pages-")).map((name) => caches.delete(name)))
        ),
  ]);
}
