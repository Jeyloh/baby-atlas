import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertSafeKey, type Storage, type StoredObject } from "./types";

export const JOURNAL_BUCKET = "journal";

/**
 * A private Supabase Storage bucket, reached with the service role key. The
 * key must stay on the server. Objects are never signed or made public.
 */
export function createSupabaseStorage(url: string, serviceRoleKey: string): Storage {
  const client: SupabaseClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const bucket = () => client.storage.from(JOURNAL_BUCKET);

  let ready: Promise<void> | null = null;
  const ensureBucket = () => {
    ready ??= (async () => {
      const { data } = await client.storage.getBucket(JOURNAL_BUCKET);
      if (data) return;
      const { error } = await client.storage.createBucket(JOURNAL_BUCKET, { public: false });
      if (error && !/already exists/i.test(error.message)) throw error;
    })().catch((error) => {
      ready = null;
      throw error;
    });
    return ready;
  };

  return {
    async put(key, bytes, mimeType) {
      assertSafeKey(key);
      await ensureBucket();
      const { error } = await bucket().upload(key, bytes, { contentType: mimeType, upsert: true });
      if (error) throw error;
    },

    async get(key): Promise<StoredObject | null> {
      assertSafeKey(key);
      await ensureBucket();
      const { data, error } = await bucket().download(key);
      if (error || !data) return null;
      return {
        stream: data.stream() as ReadableStream<Uint8Array>,
        mimeType: data.type || "application/octet-stream",
        size: data.size,
      };
    },

    async delete(key) {
      assertSafeKey(key);
      await ensureBucket();
      const { error } = await bucket().remove([key]);
      if (error) throw error;
    },
  };
}
