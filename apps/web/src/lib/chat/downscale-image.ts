import { MAX_IMAGE_BYTES } from "./limits";

export const MAX_IMAGE_EDGE = 1600;
export const JPEG_QUALITY = 0.85;

export class ImageTooLargeError extends Error {
  constructor() {
    super("image_too_large");
    this.name = "ImageTooLargeError";
  }
}

export function fitWithin(
  width: number,
  height: number,
  maxEdge: number = MAX_IMAGE_EDGE
): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge) return { width, height };
  const scale = maxEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("image_encode_failed"))),
      "image/jpeg",
      quality
    );
  });
}

export interface DownscaleOptions {
  /** Longest edge in pixels. Defaults to the chat limit. */
  maxEdge?: number;
  /** Largest encoded size in bytes. Defaults to the chat limit. */
  maxBytes?: number;
  quality?: number;
}

/**
 * Draws the image onto a canvas at most `maxEdge` px on the long edge and
 * encodes it as JPEG. The EXIF orientation is applied to the pixels, and the
 * canvas drops all metadata.
 */
export async function downscaleImage(
  file: File,
  { maxEdge = MAX_IMAGE_EDGE, maxBytes = MAX_IMAGE_BYTES, quality = JPEG_QUALITY }: DownscaleOptions = {}
): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("image_encode_failed");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, quality);
    if (blob.size > maxBytes) throw new ImageTooLargeError();

    const name = file.name.replace(/\.[^./\\]+$/, "") || "image";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}
