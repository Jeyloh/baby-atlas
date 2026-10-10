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

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("image_encode_failed"))),
      "image/jpeg",
      JPEG_QUALITY
    );
  });
}

export async function downscaleImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("image_encode_failed");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await canvasToBlob(canvas);
    if (blob.size > MAX_IMAGE_BYTES) throw new ImageTooLargeError();

    const name = file.name.replace(/\.[^./\\]+$/, "") || "image";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}
