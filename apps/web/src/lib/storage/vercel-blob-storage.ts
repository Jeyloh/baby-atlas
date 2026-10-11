import { del, get, put } from "@vercel/blob";
import { assertSafeKey, type Storage, type StoredObject } from "./types";

export interface BlobClient {
  put: typeof put;
  get: typeof get;
  del: typeof del;
}

/**
 * A private Vercel Blob store. Private blobs have no readable public URL:
 * reading needs the read-write token, which stays on the server. Every key is
 * unique per photo, so overwrites never happen in practice but are allowed to
 * keep `put` idempotent like the other drivers.
 */
export function createVercelBlobStorage(
  token: string,
  client: BlobClient = { put, get, del }
): Storage {
  return {
    async put(key, bytes, mimeType) {
      assertSafeKey(key);
      await client.put(key, Buffer.from(bytes), {
        access: "private",
        token,
        contentType: mimeType,
        addRandomSuffix: false,
        allowOverwrite: true,
      });
    },

    async get(key): Promise<StoredObject | null> {
      assertSafeKey(key);
      const result = await client.get(key, { access: "private", token });
      if (!result || result.statusCode !== 200) return null;
      return {
        stream: result.stream,
        mimeType: result.blob.contentType || "application/octet-stream",
        size: result.blob.size,
      };
    },

    async delete(key) {
      assertSafeKey(key);
      await client.del(key, { token });
    },
  };
}
