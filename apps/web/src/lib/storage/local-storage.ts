import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { assertSafeKey, type Storage, type StoredObject } from "./types";

const MIME_BY_EXTENSION: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

/** Files under a local directory. For development only. */
export function createLocalStorage(root: string): Storage {
  const base = path.resolve(root);

  const resolve = (key: string) => {
    assertSafeKey(key);
    const file = path.resolve(base, key);
    if (!file.startsWith(base + path.sep)) throw new Error("invalid_storage_key");
    return file;
  };

  return {
    async put(key, bytes) {
      const file = resolve(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, bytes);
    },

    async get(key): Promise<StoredObject | null> {
      const file = resolve(key);
      const info = await stat(file).catch(() => null);
      if (!info?.isFile()) return null;
      return {
        stream: Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>,
        mimeType: MIME_BY_EXTENSION[path.extname(file)] ?? "application/octet-stream",
        size: info.size,
      };
    },

    async delete(key) {
      await rm(resolve(key), { force: true });
    },
  };
}
