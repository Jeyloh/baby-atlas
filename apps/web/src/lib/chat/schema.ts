import { z } from "zod";
import {
  CHAT_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_ASSISTANT_TEXT_LENGTH,
  MAX_IMAGES_PER_MESSAGE,
  MAX_REQUEST_MESSAGES,
  MAX_TEXT_LENGTH,
  MODEL_IDS,
  type ChatImageType,
} from "./limits";

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

export function decodedBase64Size(data: string): number {
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  return (data.length / 4) * 3 - padding;
}

function matchesSignature(data: string, mediaType: ChatImageType): boolean {
  const head = atob(data.slice(0, 16));
  switch (mediaType) {
    case "image/jpeg":
      return head.startsWith("\xff\xd8\xff");
    case "image/png":
      return head.startsWith("\x89PNG");
    case "image/gif":
      return head.startsWith("GIF8");
    case "image/webp":
      return head.startsWith("RIFF") && head.slice(8, 12) === "WEBP";
  }
}

const textPartSchema = z.object({
  type: z.literal("text"),
  text: z.string().min(1).max(MAX_TEXT_LENGTH),
});

const imagePartSchema = z.object({
  type: z.literal("image"),
  mediaType: z.enum(CHAT_IMAGE_TYPES),
  data: z.string().min(1),
});

function imageProblem(part: z.infer<typeof imagePartSchema>): string | null {
  if (part.data.length % 4 !== 0 || !BASE64_PATTERN.test(part.data)) {
    return "Image data is not valid base64";
  }
  if (decodedBase64Size(part.data) > MAX_IMAGE_BYTES) {
    return `Image is larger than ${MAX_IMAGE_BYTES / (1024 * 1024)} MB`;
  }
  if (!matchesSignature(part.data, part.mediaType)) {
    return "Image data does not match its media type";
  }
  return null;
}

const userMessageSchema = z.object({
  role: z.literal("user"),
  content: z
    .array(z.discriminatedUnion("type", [textPartSchema, imagePartSchema]))
    .min(1)
    .superRefine((parts, ctx) => {
      const images = parts.filter((part) => part.type === "image");
      if (images.length > MAX_IMAGES_PER_MESSAGE) {
        ctx.addIssue({
          code: "custom",
          message: `At most ${MAX_IMAGES_PER_MESSAGE} images per message`,
        });
        return;
      }
      parts.forEach((part, index) => {
        const problem = part.type === "image" ? imageProblem(part) : null;
        if (problem) ctx.addIssue({ code: "custom", path: [index], message: problem });
      });
    }),
});

const assistantMessageSchema = z.object({
  role: z.literal("assistant"),
  content: z
    .array(
      z.object({
        type: z.literal("text"),
        text: z.string().min(1).max(MAX_ASSISTANT_TEXT_LENGTH),
      })
    )
    .min(1),
});

export const chatMessageSchema = z.discriminatedUnion("role", [
  userMessageSchema,
  assistantMessageSchema,
]);

export const chatRequestSchema = z.object({
  childId: z.string().min(1),
  model: z.enum(MODEL_IDS).default("sonnet"),
  messages: z
    .array(chatMessageSchema)
    .min(1)
    .max(MAX_REQUEST_MESSAGES)
    .refine((messages) => messages[messages.length - 1]?.role === "user", {
      message: "The last message must be from the user",
    }),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatUserPart = Extract<ChatMessage, { role: "user" }>["content"][number];
export type ChatImagePart = Extract<ChatUserPart, { type: "image" }>;
