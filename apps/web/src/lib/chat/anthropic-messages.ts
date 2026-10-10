import type Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage } from "./schema";

export function toAnthropicMessages(
  messages: ChatMessage[]
): Anthropic.MessageParam[] {
  return messages.map((message): Anthropic.MessageParam => {
    if (message.role === "assistant") {
      return {
        role: "assistant",
        content: message.content.map((part) => part.text).join("\n\n"),
      };
    }

    const images = message.content.filter((part) => part.type === "image");
    const texts = message.content.filter((part) => part.type === "text");
    return {
      role: "user",
      content: [
        ...images.map(
          (part): Anthropic.ImageBlockParam => ({
            type: "image",
            source: {
              type: "base64",
              media_type: part.mediaType,
              data: part.data,
            },
          })
        ),
        ...texts.map(
          (part): Anthropic.TextBlockParam => ({ type: "text", text: part.text })
        ),
      ],
    };
  });
}
