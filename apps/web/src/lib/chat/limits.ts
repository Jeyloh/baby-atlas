export const MODEL_IDS = ["haiku", "sonnet", "opus"] as const;
export type ModelId = (typeof MODEL_IDS)[number];

export const CHAT_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
export type ChatImageType = (typeof CHAT_IMAGE_TYPES)[number];

export const MAX_IMAGES_PER_MESSAGE = 4;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_TEXT_LENGTH = 10_000;
export const MAX_ASSISTANT_TEXT_LENGTH = 50_000;
export const MAX_REQUEST_MESSAGES = 100;

export const MAX_HISTORY_MESSAGES = 20;
export const KEEP_IMAGES_IN_LAST_USER_TURNS = 2;
export const OLD_IMAGE_PLACEHOLDER =
  "[Bilde fra tidligere i samtalen er utelatt]";
