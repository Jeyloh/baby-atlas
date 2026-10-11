// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createVercelBlobStorage, type BlobClient } from "./vercel-blob-storage";

function fakeClient() {
  return {
    put: vi.fn().mockResolvedValue({}),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(undefined),
  };
}

const asClient = (client: ReturnType<typeof fakeClient>) => client as unknown as BlobClient;

describe("vercel blob storage", () => {
  const key = "journal/child/entry/photo.webp";

  it("writes private blobs under the exact key", async () => {
    const client = fakeClient();
    await createVercelBlobStorage("tok", asClient(client)).put(key, new Uint8Array([1, 2]), "image/webp");

    expect(client.put).toHaveBeenCalledWith(key, Buffer.from([1, 2]), {
      access: "private",
      token: "tok",
      contentType: "image/webp",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  });

  it("reads a blob back as a stream with its type and size", async () => {
    const client = fakeClient();
    const stream = new Response(new Uint8Array([7])).body!;
    client.get.mockResolvedValue({ statusCode: 200, stream, blob: { contentType: "image/webp", size: 1 } });

    const object = await createVercelBlobStorage("tok", asClient(client)).get(key);

    expect(client.get).toHaveBeenCalledWith(key, { access: "private", token: "tok" });
    expect(object).toEqual({ stream, mimeType: "image/webp", size: 1 });
  });

  it("returns null for a missing blob", async () => {
    const client = fakeClient();
    expect(await createVercelBlobStorage("tok", asClient(client)).get(key)).toBeNull();
  });

  it("deletes by key", async () => {
    const client = fakeClient();
    await createVercelBlobStorage("tok", asClient(client)).delete(key);
    expect(client.del).toHaveBeenCalledWith(key, { token: "tok" });
  });

  it("rejects unsafe keys before calling the store", async () => {
    const client = fakeClient();
    const storage = createVercelBlobStorage("tok", asClient(client));
    await expect(storage.put("../x.webp", new Uint8Array([1]), "image/webp")).rejects.toThrow("invalid_storage_key");
    await expect(storage.get("a//b.webp")).rejects.toThrow("invalid_storage_key");
    await expect(storage.delete("")).rejects.toThrow("invalid_storage_key");
    expect(client.put).not.toHaveBeenCalled();
    expect(client.get).not.toHaveBeenCalled();
    expect(client.del).not.toHaveBeenCalled();
  });
});
