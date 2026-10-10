import {
  KEEP_IMAGES_IN_LAST_USER_TURNS,
  MAX_HISTORY_MESSAGES,
  OLD_IMAGE_PLACEHOLDER,
} from "./limits";
import type { ChatMessage, ChatUserPart } from "./schema";

function withoutImages(parts: ChatUserPart[]): ChatUserPart[] {
  const kept = parts.filter((part) => part.type !== "image");
  if (kept.length === parts.length) return parts;
  return [...kept, { type: "text", text: OLD_IMAGE_PLACEHOLDER }];
}

export function trimConversation(messages: ChatMessage[]): ChatMessage[] {
  const recent = messages.slice(-MAX_HISTORY_MESSAGES);
  const firstUser = recent.findIndex((message) => message.role === "user");
  const history = firstUser === -1 ? [] : recent.slice(firstUser);

  const userIndexes = history.flatMap((message, index) =>
    message.role === "user" ? [index] : []
  );
  const imageCutoff = userIndexes[userIndexes.length - KEEP_IMAGES_IN_LAST_USER_TURNS];

  return history.map((message, index) => {
    if (message.role !== "user") return message;
    if (imageCutoff === undefined || index >= imageCutoff) return message;
    return { ...message, content: withoutImages(message.content) };
  });
}
