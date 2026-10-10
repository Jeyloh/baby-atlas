// @vitest-environment node
import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { ImageProcessingError, processJournalImage } from "./process-image";
import { fakeHeic, jpegWithGps, plainImage } from "./test-images";

describe("processJournalImage", () => {
  it("the fixture really carries EXIF and GPS before processing", async () => {
    const input = await jpegWithGps();
    const meta = await sharp(input).metadata();
    expect(meta.exif).toBeDefined();
    expect(input.includes(Buffer.from("SecretCam"))).toBe(true);
    expect(input.includes(Buffer.from("SecretGpsDatum"))).toBe(true);
    expect(input.includes(Buffer.from("Exif"))).toBe(true);
  });

  it("strips EXIF, GPS and every other metadata block from both outputs", async () => {
    const result = await processJournalImage(await jpegWithGps());

    for (const output of [result.full, result.thumb]) {
      const meta = await sharp(output).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.exif).toBeUndefined();
      expect(meta.xmp).toBeUndefined();
      expect(meta.iptc).toBeUndefined();
      expect(meta.orientation).toBeUndefined();
      expect(output.includes(Buffer.from("SecretCam"))).toBe(false);
      expect(output.includes(Buffer.from("SecretOwner"))).toBe(false);
      expect(output.includes(Buffer.from("SecretGpsDatum"))).toBe(false);
      expect(output.includes(Buffer.from("Exif"))).toBe(false);
    }
  });

  it("applies the EXIF rotation to the pixels before dropping it", async () => {
    // 3000x1500 with orientation 6 displays as 1500x3000, then fits within 2048
    const result = await processJournalImage(await jpegWithGps(3000, 1500));
    expect(result.height).toBeGreaterThan(result.width);
    expect(result.width).toBe(1024);
    expect(result.height).toBe(2048);
  });

  it("resizes the long edge to at most 2048 px and the thumbnail to at most 400 px", async () => {
    const result = await processJournalImage(await plainImage("png", 4000, 3000));
    expect(result.width).toBe(2048);
    expect(result.height).toBe(1536);
    const thumb = await sharp(result.thumb).metadata();
    expect(Math.max(thumb.width!, thumb.height!)).toBe(400);
  });

  it("does not enlarge small images", async () => {
    const result = await processJournalImage(await plainImage("webp", 100, 50));
    expect([result.width, result.height]).toEqual([100, 50]);
  });

  it.each(["png", "webp", "jpeg"] as const)("accepts %s input", async (format) => {
    const result = await processJournalImage(await plainImage(format));
    expect(result.mimeType).toBe("image/webp");
  });

  it("throws ImageProcessingError for bytes sharp cannot decode", async () => {
    await expect(processJournalImage(fakeHeic())).rejects.toBeInstanceOf(ImageProcessingError);
    await expect(processJournalImage(new Uint8Array([1, 2, 3]))).rejects.toBeInstanceOf(
      ImageProcessingError
    );
  });
});
