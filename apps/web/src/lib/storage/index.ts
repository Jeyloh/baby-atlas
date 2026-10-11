import "server-only";

import path from "node:path";
import { createLocalStorage } from "./local-storage";
import { createSupabaseStorage } from "./supabase-storage";
import type { Storage } from "./types";

export type { Storage, StoredObject } from "./types";

let instance: Storage | undefined;

/**
 * STORAGE_DRIVER=supabase uses a private Supabase bucket. Otherwise files go
 * to apps/web/.uploads, which only works in development because serverless
 * hosts have no writable disk.
 */
export function getStorage(): Storage {
  if (instance) return instance;

  if (process.env.STORAGE_DRIVER === "supabase") {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("STORAGE_DRIVER=supabase needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    }
    instance = createSupabaseStorage(url, key);
  } else {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Set STORAGE_DRIVER=supabase in production, the local driver is for development");
    }
    instance = createLocalStorage(
      process.env.STORAGE_LOCAL_DIR ?? path.join(process.cwd(), ".uploads")
    );
  }
  return instance;
}

/**
 * What the tRPC context gets: storage is only resolved when a file is
 * actually deleted, so a missing storage config cannot break every other
 * API call (logging must keep working).
 */
export const lazyStoredFileRemover = {
  delete: (key: string) => getStorage().delete(key),
};
