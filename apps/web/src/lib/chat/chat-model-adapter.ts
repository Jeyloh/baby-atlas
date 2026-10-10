import type { ChatModelAdapter } from "@assistant-ui/react";
import { trimConversation } from "./conversation";
import { MAX_IMAGES_PER_MESSAGE, type ModelId } from "./limits";
import { toChatMessages } from "./to-chat-messages";
import {
  applyStreamEvent,
  parseSseStream,
  type AssistantPart,
} from "./stream-events";

export class PremiumRequiredError extends Error {
  constructor() {
    super("premium_required");
    this.name = "PremiumRequiredError";
  }
}

interface ChatModelAdapterOptions {
  childId: string;
  getModel: () => ModelId;
  onPremiumRequired: () => void;
  errorMessages: { generic: string; tooManyImages: string };
}

export function createChatModelAdapter({
  childId,
  getModel,
  onPremiumRequired,
  errorMessages,
}: ChatModelAdapterOptions): ChatModelAdapter {
  return {
    async *run({ messages, abortSignal }) {
      const conversation = toChatMessages(messages);
      const last = conversation[conversation.length - 1];
      const imageCount =
        last?.role === "user"
          ? last.content.filter((part) => part.type === "image").length
          : 0;
      if (imageCount > MAX_IMAGES_PER_MESSAGE) {
        throw new Error(errorMessages.tooManyImages);
      }

      let response: Response;
      try {
        response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            childId,
            model: getModel(),
            messages: trimConversation(conversation),
          }),
          signal: abortSignal,
        });
      } catch (error) {
        if (abortSignal.aborted) return;
        throw error;
      }

      if (response.status === 402) {
        onPremiumRequired();
        throw new PremiumRequiredError();
      }
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || errorMessages.generic);
      }
      if (!response.body) throw new Error(errorMessages.generic);

      let parts: readonly AssistantPart[] = [];
      try {
        for await (const event of parseSseStream(response.body)) {
          if (event.type === "error") throw new Error(event.error);
          const next = applyStreamEvent(parts, event);
          if (next !== parts) {
            parts = next;
            yield { content: parts };
          }
        }
      } catch (error) {
        if (abortSignal.aborted) return;
        throw error;
      }
    },
  };
}
