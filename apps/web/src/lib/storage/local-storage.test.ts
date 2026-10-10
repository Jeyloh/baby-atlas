// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createLocalStorage } from "./local-storage";
import type { Storage } from "./types";

async function read(stream: ReadableStream<Uint8Array>) {
  return Buffer.from(await new Response(stream).arrayBuffer());
}

describe("local storage", () => {
  let root: string;
  let storage: Storage;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "journal-test-"));
    storage = createLocalStorage(root);
  });
  afterEach(() => rm(root, { recursive: true, force: true }));

  it("stores, reads back and deletes a file", async () => {
    const key = "journal/child/entry/photo.webp";
    await storage.put(key, new Uint8Array([1, 2, 3]), "image/webp");

    const object = await storage.get(key);
    expect(object?.mimeType).toBe("image/webp");
    expect(object?.size).toBe(3);
    expect(await read(object!.stream)).toEqual(Buffer.from([1, 2, 3]));

    await storage.delete(key);
    expect(await storage.get(key)).toBeNull();
  });

  it("returns null for a missing key and deletes a missing key without error", async () => {
    expect(await storage.get("journal/a/b/missing.webp")).toBeNull();
    await expect(storage.delete("journal/a/b/missing.webp")).resolves.toBeUndefined();
  });

  it.each(["../escape.webp", "journal/../../escape.webp", "/etc/passwd", "a//b.webp", "a/./b.webp", ""])(
    "rejects the unsafe key %j",
    async (key) => {
      await expect(storage.put(key, new Uint8Array([1]), "image/webp")).rejects.toThrow(
        "invalid_storage_key"
      );
      await expect(storage.get(key)).rejects.toThrow("invalid_storage_key");
      await expect(storage.delete(key)).rejects.toThrow("invalid_storage_key");
    }
  );

  it("never writes outside its root", async () => {
    await expect(storage.put("../outside.webp", new Uint8Array([1]), "image/webp")).rejects.toThrow();
    await expect(stat(path.join(root, "..", "outside.webp"))).rejects.toThrow();
  });
});
