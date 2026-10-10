export interface StoredObject {
  stream: ReadableStream<Uint8Array>;
  mimeType: string;
  size?: number;
}

/**
 * Private blob storage. There are no public URLs: bytes only leave through
 * `get`, which callers must put behind an access check.
 */
export interface Storage {
  put(key: string, bytes: Uint8Array, mimeType: string): Promise<void>;
  /** Resolves to null when the key does not exist. */
  get(key: string): Promise<StoredObject | null>;
  /** Resolves when the key is gone, also when it never existed. */
  delete(key: string): Promise<void>;
}

const SAFE_KEY = /^[A-Za-z0-9_-]+(?:[./][A-Za-z0-9_-]+)*$/;

export function assertSafeKey(key: string): void {
  if (!SAFE_KEY.test(key) || key.split("/").some((part) => part === "." || part === "..")) {
    throw new Error("invalid_storage_key");
  }
}
