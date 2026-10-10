import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  downscaleImage,
  fitWithin,
  ImageTooLargeError,
  JPEG_QUALITY,
  MAX_IMAGE_EDGE,
} from "./downscale-image";
import { MAX_IMAGE_BYTES } from "./limits";

describe("fitWithin", () => {
  it("keeps images that are already small enough", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 1200)).toEqual({ width: 1600, height: 1200 });
  });

  it("scales a landscape image to 1600 px on the long edge", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
  });

  it("scales a portrait image to 1600 px on the long edge", () => {
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: MAX_IMAGE_EDGE });
  });

  it("never returns a zero dimension", () => {
    expect(fitWithin(10000, 1)).toEqual({ width: 1600, height: 1 });
  });
});

describe("downscaleImage", () => {
  const close = vi.fn();
  const drawImage = vi.fn();
  let blobSize = 1000;
  let canvas: { width: number; height: number };
  let toBlob: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    close.mockClear();
    drawImage.mockClear();
    blobSize = 1000;
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 4000, height: 3000, close }))
    );
    toBlob = vi.fn((callback: BlobCallback) =>
      callback(new Blob([new Uint8Array(blobSize)], { type: "image/jpeg" }))
    );
    const element = document.createElement("canvas");
    canvas = element;
    Object.assign(element, { toBlob });
    element.getContext = vi.fn(() => ({
      fillRect: vi.fn(),
      drawImage,
      fillStyle: "",
    })) as unknown as HTMLCanvasElement["getContext"];
    vi.spyOn(document, "createElement").mockReturnValue(element);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("draws at most 1600 px on the long edge and encodes JPEG at 0.85", async () => {
    const file = new File(["x"], "photo.heic", { type: "image/heic" });
    const result = await downscaleImage(file);

    expect(canvas).toMatchObject({ width: 1600, height: 1200 });
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 1200);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", JPEG_QUALITY);
    expect(result.type).toBe("image/jpeg");
    expect(result.name).toBe("photo.jpg");
    expect(close).toHaveBeenCalled();
  });

  it("takes the edge, size limit and quality as options", async () => {
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    await downscaleImage(file, { maxEdge: 2048, maxBytes: 2000, quality: 0.8 });

    expect(canvas).toMatchObject({ width: 2048, height: 1536 });
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.8);

    blobSize = 2001;
    await expect(downscaleImage(file, { maxBytes: 2000 })).rejects.toBeInstanceOf(ImageTooLargeError);
  });

  it("rejects when the encoded image is still over the size limit", async () => {
    blobSize = MAX_IMAGE_BYTES + 1;
    const file = new File(["x"], "big.png", { type: "image/png" });

    await expect(downscaleImage(file)).rejects.toBeInstanceOf(ImageTooLargeError);
    expect(close).toHaveBeenCalled();
  });
});
