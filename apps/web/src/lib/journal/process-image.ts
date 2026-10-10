import sharp from "sharp";

export const FULL_MAX_EDGE = 2048;
export const THUMB_MAX_EDGE = 400;
const MAX_INPUT_PIXELS = 100_000_000;

export class ImageProcessingError extends Error {
  constructor(cause: unknown) {
    super("image_unreadable", { cause });
    this.name = "ImageProcessingError";
  }
}

export interface ProcessedImage {
  full: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
  mimeType: "image/webp";
}

/**
 * Re-encodes an upload as WebP. sharp drops all metadata (EXIF, GPS, XMP,
 * ICC, IPTC) unless asked to keep it, and rotate() applies the EXIF
 * orientation first so the pixels stay upright without it.
 */
export async function processJournalImage(input: Uint8Array): Promise<ProcessedImage> {
  const source = () =>
    sharp(input, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS }).rotate();

  try {
    const [full, thumb] = await Promise.all([
      source()
        .resize({ width: FULL_MAX_EDGE, height: FULL_MAX_EDGE, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true }),
      source()
        .resize({ width: THUMB_MAX_EDGE, height: THUMB_MAX_EDGE, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer(),
    ]);
    return {
      full: full.data,
      thumb,
      width: full.info.width,
      height: full.info.height,
      mimeType: "image/webp",
    };
  } catch (error) {
    throw new ImageProcessingError(error);
  }
}
