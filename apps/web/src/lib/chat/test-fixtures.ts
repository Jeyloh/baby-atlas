import type { ChatImageType } from "./limits";
import type { ChatImagePart } from "./schema";

const SIGNATURES: Record<ChatImageType, number[]> = {
  "image/jpeg": [0xff, 0xd8, 0xff, 0xe0],
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  "image/gif": [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
  "image/webp": [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
};

export function fakeImage(
  mediaType: ChatImageType = "image/jpeg",
  size = 64
): ChatImagePart {
  const bytes = Buffer.alloc(Math.max(size, 16));
  Buffer.from(SIGNATURES[mediaType]).copy(bytes);
  return { type: "image", mediaType, data: bytes.toString("base64") };
}
