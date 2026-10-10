import type { ThreadMessage } from "@assistant-ui/react";
import { CHAT_IMAGE_TYPES } from "./limits";
import type { ChatImagePart, ChatMessage, ChatUserPart } from "./schema";

const DATA_URL_PATTERN = /^data:([^;,]+);base64,(.+)$/s;

export function dataUrlToImagePart(dataUrl: string): ChatImagePart | null {
  const match = DATA_URL_PATTERN.exec(dataUrl);
  if (!match) return null;
  const mediaType = CHAT_IMAGE_TYPES.find((type) => type === match[1]);
  if (!mediaType) return null;
  return { type: "image", mediaType, data: match[2] };
}

function userParts(message: Extract<ThreadMessage, { role: "user" }>): ChatUserPart[] {
  const sources = [
    ...message.content,
    ...message.attachments.flatMap((attachment) => attachment.content),
  ];
  const images: ChatUserPart[] = [];
  const seen = new Set<string>();
  const texts: ChatUserPart[] = [];

  for (const part of sources) {
    if (part.type === "text" && part.text.trim()) {
      texts.push({ type: "text", text: part.text });
    } else if (part.type === "image" && !seen.has(part.image)) {
      seen.add(part.image);
      const image = dataUrlToImagePart(part.image);
      if (image) images.push(image);
    }
  }
  return [...images, ...texts];
}

export function toChatMessages(messages: readonly ThreadMessage[]): ChatMessage[] {
  return messages.flatMap((message): ChatMessage[] => {
    if (message.role === "user") {
      const content = userParts(message);
      return content.length > 0 ? [{ role: "user", content }] : [];
    }
    if (message.role === "assistant") {
      const content = message.content.flatMap((part) =>
        part.type === "text" && part.text.trim()
          ? [{ type: "text" as const, text: part.text }]
          : []
      );
      return content.length > 0 ? [{ role: "assistant", content }] : [];
    }
    return [];
  });
}
